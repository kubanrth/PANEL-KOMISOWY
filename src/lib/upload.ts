import { createClient } from "@/lib/supabase/client";
import type { Photo } from "@/lib/types";

export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_PHOTOS_PER_PRODUCT = 6;
export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type UploadError = { error: string };
export type UploadResult = { ok: true; photo: Photo } | { ok: false; error: string };

/**
 * Validate a file before upload.
 */
export function validateImage(file: File): UploadError | null {
  if (!ACCEPTED_IMAGE_MIME.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
    return { error: `${file.name}: niedozwolony format (akceptujemy JPG, PNG, WEBP, HEIC).` };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: `${file.name}: za duży plik (max 5 MB).` };
  }
  return null;
}

/**
 * Upload a single image to Supabase Storage under {user_id}/{folderHint}/{rand}.{ext}.
 * Returns Photo { url, name, size } on success.
 */
export async function uploadProductPhoto(file: File, folderHint: string): Promise<UploadResult> {
  const v = validateImage(file);
  if (v) return { ok: false, error: v.error };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesja wygasła. Zaloguj się ponownie." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const rand = crypto.randomUUID();
  const path = `${user.id}/${folderHint}/${rand}.${ext}`;

  const { error } = await supabase.storage
    .from("product-photos")
    .upload(path, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    return { ok: false, error: `Upload failed: ${error.message}` };
  }

  const { data } = supabase.storage.from("product-photos").getPublicUrl(path);

  return {
    ok: true,
    photo: {
      url: data.publicUrl,
      name: file.name,
      size: file.size,
    },
  };
}

/**
 * Delete a photo from Storage by its public URL.
 * Best-effort — failures are logged but not surfaced.
 */
export async function deleteProductPhoto(url: string): Promise<void> {
  try {
    const supabase = createClient();
    // Extract path after /product-photos/
    const match = url.match(/\/product-photos\/(.+?)(?:\?|$)/);
    if (!match) return;
    await supabase.storage.from("product-photos").remove([match[1]]);
  } catch (e) {
    console.warn("[deleteProductPhoto]", e);
  }
}
