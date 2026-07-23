import "server-only";

/* Packshoty ze sklepu kickback.pl — po unikalnym SKU (brak wariantów).
   WooCommerce Store API jest publiczne i filtruje po sku, zwraca images[].
   Cache: Next fetch revalidate 24h per SKU; błędy sieci = brak zdjęcia
   (fail-soft — panel nigdy nie może się wywalić przez sklep). */

const STORE_API = "https://kickback.pl/wp-json/wc/store/v1/products";

type StoreProduct = { sku?: string; images?: Array<{ src?: string; thumbnail?: string }> };

async function fetchOne(sku: string): Promise<string | null> {
  try {
    const res = await fetch(`${STORE_API}?sku=${encodeURIComponent(sku)}`, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(4_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as StoreProduct[];
    const img = data?.[0]?.images?.[0];
    return img?.thumbnail ?? img?.src ?? null;
  } catch {
    return null;
  }
}

/** Mapa SKU → URL miniatury packshota (brakujące SKU po prostu nie występują). */
export async function getSiteImagesBySkus(skus: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(skus.filter(Boolean)));
  const out = new Map<string, string>();
  await Promise.all(
    unique.map(async (sku) => {
      const url = await fetchOne(sku);
      if (url) out.set(sku, url);
    }),
  );
  return out;
}
