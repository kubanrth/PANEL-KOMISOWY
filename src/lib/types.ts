/**
 * Shared TypeScript types — mirror the DB schema in supabase/migrations.
 * (We'll switch to generated types from `supabase gen types typescript` later.)
 */

export type AccountType = "individual" | "business";
export type UserRole = "klient" | "admin" | "super_admin";

export type SubmissionStatus =
  | "draft"
  | "signed"
  | "in_transit"
  | "aqc"
  | "listed"
  | "sold"
  | "payout"
  | "withdrawn"
  | "returned";

export type ProductStatus =
  | "draft"
  | "aqc"
  | "listed"
  | "offer"
  | "sold"
  | "withdrawn"
  | "returned";

export type Photo = { url: string; name: string; size?: number };

export type Profile = {
  id: string;
  role: UserRole;
  account_type: AccountType | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  pesel_or_id: string | null;
  company_name: string | null;
  nip: string | null;
  vat_id: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Submission = {
  id: string; // SUB-XXXXX
  klient_id: string;
  status: SubmissionStatus;
  signed_at: string | null;
  signed_method: string | null;
  signed_ip: string | null;
  shipping_label_url: string | null;
  contract_pdf_url: string | null;
  commission_rate: number; // 0..1
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  submission_id: string;
  brand: string;
  model: string;
  category: string | null;
  size: string | null;
  condition: number | null;
  description: string | null;
  expected_price_cents: number | null;
  min_price_cents: number | null;
  listing_price_cents: number | null;
  status: ProductStatus;
  photos: Photo[];
  created_at: string;
  updated_at: string;
};

/** Polski label dla statusu submission (UI). */
export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  draft: "Szkic",
  signed: "Podpisana",
  in_transit: "W transporcie",
  aqc: "A&QC",
  listed: "W sprzedaży",
  sold: "Sprzedane",
  payout: "Wypłata",
  withdrawn: "Wycofane",
  returned: "Zwrot",
};

export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  draft: "Szkic",
  aqc: "A&QC",
  listed: "W sprzedaży",
  offer: "Oferta",
  sold: "Sprzedane",
  withdrawn: "Wycofane",
  returned: "Zwrot",
};
