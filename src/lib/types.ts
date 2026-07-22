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

/** migration 017 — etap pipeline'u magazynowego (ustawiany przez admina) */
export type ProductStage =
  | "introduction"
  | "verification"
  | "attributes"
  | "quality_control"
  | "valuation_decision"
  | "dimensions"
  | "photos"
  | "description"
  | "listing";

/** Kolejność = kolejność etapów w pipeline. */
export const PRODUCT_STAGES: Array<{ key: ProductStage; label: string }> = [
  { key: "introduction", label: "Introduction" },
  { key: "verification", label: "Verification" },
  { key: "attributes", label: "Atrybuty" },
  { key: "quality_control", label: "Quality Control" },
  { key: "valuation_decision", label: "Wycena – Decyzja" },
  { key: "dimensions", label: "Wymiary" },
  { key: "photos", label: "Zdjęcia" },
  { key: "description", label: "Opis" },
  { key: "listing", label: "Listing" },
];

export const PRODUCT_STAGE_LABEL: Record<ProductStage, string> = Object.fromEntries(
  PRODUCT_STAGES.map((s) => [s.key, s.label]),
) as Record<ProductStage, string>;

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
  /** Master Umowa Komisowa signed once per klient (migration 007). Legacy DBs return null. */
  master_agreement_signed_at: string | null;
  master_agreement_signed_method: string | null;
  master_agreement_signed_ip: string | null;
  master_agreement_version: string | null;
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

export type PricingMode = "commission" | "payout";

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
  /** migration 007 */
  pricing_mode: PricingMode;
  /** migration 007: required when pricing_mode === 'payout' */
  payout_price_cents: number | null;
  /** migration 008 */
  vat_rate: number;            // 0.000 (zw), 0.050, 0.080, 0.230
  published_at: string | null;
  sold_at: string | null;
  settlement_at: string | null;
  /** migration 017 — etap pipeline'u magazynowego */
  stage: ProductStage;
  /** migration 012 — Fakturownia integration */
  sku: string;                 // KCB-{YY}-{6hex}
  fakturownia_product_id: number | null;
  fakturownia_pushed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Derived "operational" status shown in Magazyn — mapped from raw ProductStatus
 * + submissions.status + aqc decisions. UI-only; not a DB enum. */
export type DerivedStatus =
  | "w_trakcie_dostawy"
  | "przyjeto"
  | "zdjecia"
  | "oczekuje_publikacji"
  | "aktywny";

export const DERIVED_STATUS_LABEL: Record<DerivedStatus, string> = {
  w_trakcie_dostawy: "W trakcie dostawy",
  przyjeto: "Przyjęto na magazyn",
  zdjecia: "Processing",
  oczekuje_publikacji: "Oczekuje na publikację",
  aktywny: "Aktywny w sprzedaży",
};

export const PRICING_MODE_LABEL: Record<PricingMode, { title: string; sub: string }> = {
  commission: {
    title: "Prowizja 20%",
    sub: "Kickback sprzedaje, prowizja od ceny sprzedaży.",
  },
  payout: {
    title: "Stała wypłata",
    sub: "Ty deklarujesz ile chcesz dostać — my sprzedajemy za dowolną cenę powyżej.",
  },
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

/* =========================================================== */
/* Sesja 4: Wallet, payouts, documents, notifications          */
/* =========================================================== */

export type WalletTxType =
  | "sale_pending"
  | "sale_unlocked"
  | "payout_request"
  | "payout_done"
  | "payout_cancelled"
  | "return_fee"
  | "deposit_topup"
  | "manual_adjustment";

export type WalletTransaction = {
  id: string;
  klient_id: string;
  type: WalletTxType;
  amount_cents: number; // signed
  reference_id: string | null;
  available_at: string | null;
  description: string | null;
  created_at: string;
};

export type PayoutStatus = "requested" | "authorized" | "executing" | "done" | "failed" | "cancelled";

export type Payout = {
  id: string;
  klient_id: string;
  amount_cents: number;
  bank_account_id: string | null;
  status: PayoutStatus;
  requested_at: string;
  authorized_by: string | null;
  authorized_at: string | null;
  executed_at: string | null;
  bank_ref: string | null;
  notes: string | null;
};

export type BankAccount = {
  id: string;
  klient_id: string;
  bank_name: string;
  iban: string;
  is_default: boolean;
  created_at: string;
};

export type DocumentType = "umowa_komisowa" | "umowa_ks" | "faktura" | "inne";

export type AppDocument = {
  id: string;
  klient_id: string;
  submission_id: string | null;
  type: DocumentType;
  file_url: string | null;
  signed_at: string | null;
  signed_method: string | null;
  created_at: string;
};

export type NotificationType =
  | "submission_signed"
  | "submission_received"
  | "aqc_started"
  | "aqc_complete"
  | "valuation_ready"
  | "price_reduction_suggestion"
  | "offer_received"
  | "offer_accepted"
  | "offer_rejected"
  | "sale"
  | "sale_unlocked"
  | "payout_pending"
  | "payout_done"
  | "payout_failed"
  | "return_decision"
  | "document_required";

export type AppNotification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  ref_id: string | null;
  read_at: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

/* =========================================================== */
/* Sesja 6/7: AQC + Offers + Returns + QR                      */
/* =========================================================== */

export type AqcVerdict = "pass" | "warn" | "fail";

export type AqcAudit = {
  id: string;
  product_id: string;
  inspector_id: string | null;
  scores: Record<string, number>;
  score_total: number | null;
  verdict: AqcVerdict | null;
  notes: string | null;
  recommended_price_cents: number | null;
  decided_at: string | null;
  created_at: string;
};

/** 12 punktów audytu (klucze pasują do scores jsonb). */
export const AQC_CHECKLIST: Array<{ key: string; label: string }> = [
  { key: "stitching",    label: "Stitching · regularność" },
  { key: "leather",      label: "Leather / materiał" },
  { key: "hardware",     label: "Hardware · klamry, suwak" },
  { key: "logo",         label: "Logo · grawer, wyciski" },
  { key: "lining",       label: "Lining · podszewka" },
  { key: "heat_stamp",   label: "Heat stamp · numer seryjny" },
  { key: "wear",         label: "Stan ogólny · ślady noszenia" },
  { key: "box",          label: "Box · oryginalne pudełko" },
  { key: "tags",         label: "Tagi · metki produktowe" },
  { key: "dust_bag",     label: "Worek pyłowy" },
  { key: "accessories",  label: "Kompletność akcesoriów" },
  { key: "congruence",   label: "Kongruencja z deklaracją" },
];

export type OfferStatus = "pending" | "accepted" | "countered" | "rejected" | "expired" | "withdrawn";

export type Offer = {
  id: string;
  product_id: string;
  listing_id: string | null;
  buyer_token: string | null;
  buyer_name: string | null;
  amount_cents: number;
  message: string | null;
  status: OfferStatus;
  parent_offer_id: string | null;
  expires_at: string | null;
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
  is_seller_message: boolean;
};

export type ReturnReason =
  | "not_authentic"
  | "damaged_irreparable"
  | "below_standards"
  | "client_rejection"
  | "withdraw_short_term"
  | "withdraw_long_term";

export type ReturnResolution = "pending" | "pickup_paid" | "disposal_free" | "returned" | "cancelled";

export type AppReturn = {
  id: string;
  product_id: string;
  reason: ReturnReason;
  fee_cents: number;
  decision_deadline: string | null;
  resolution: ReturnResolution;
  notes: string | null;
  initiated_by: string | null;
  resolved_at: string | null;
  created_at: string;
};

export const RETURN_REASON_LABEL: Record<ReturnReason, { title: string; fee: number; description: string }> = {
  not_authentic:        { title: "Produkt nieoryginalny",          fee: 0,    description: "Wykryto cechy niegrające z autentykiem. Zwrot bez opłat." },
  damaged_irreparable:  { title: "Uszkodzenia poza naprawialnym",  fee: 0,    description: "Stan poniżej minimum, naprawa niemożliwa. Zwrot bez opłat." },
  below_standards:      { title: "Poniżej standardów Kickback",    fee: 0,    description: "Produkt nie spełnia naszych kryteriów jakości. Zwrot bez opłat." },
  client_rejection:     { title: "Klient nie akceptuje warunków",  fee: 4900, description: "Klient odmawia akceptacji wyceny lub kosztu napraw. Opłata 49 zł." },
  withdraw_short_term:  { title: "Wycofanie < 3 miesiące",          fee: 9900, description: "Wycofanie produktu w okresie do 3 miesięcy. Opłata 99 zł (magazyn + obsługa)." },
  withdraw_long_term:   { title: "Wycofanie > 3 miesiące",          fee: 19900,description: "Wycofanie produktu po 3 miesiącach. Opłata 199 zł (długie magazynowanie)." },
};

export type QrCode = {
  id: string;
  product_id: string;
  slug: string;
  scans_count: number;
  last_scanned_at: string | null;
  created_at: string;
};

/* =========================================================== */
/* Migration 008/009/010/011 — Phase 2-5 additions             */
/* =========================================================== */

export type PriceChangeStatus = "pending" | "accepted" | "rejected" | "cancelled";

export type PriceChangeRequest = {
  id: string;
  product_id: string;
  requested_by: string;
  current_price_cents: number | null;
  suggested_price_cents: number;
  status: PriceChangeStatus;
  decided_by: string | null;
  decided_at: string | null;
  notes: string | null;
  created_at: string;
};

export type InvoiceType = "faktura_vat" | "uks" | "inne";
export type InvoiceStatus = "uploaded" | "verified" | "rejected";

export type Invoice = {
  id: string;
  klient_id: string;
  type: InvoiceType;
  file_url: string;
  invoice_number: string | null;
  issued_at: string | null;
  amount_cents: number | null;
  sale_product_ids: string[];
  status: InvoiceStatus;
  uploaded_at: string;
  verified_at: string | null;
  verified_by: string | null;
  rejection_reason: string | null;
};

export type Club = {
  id: string;
  name: string;
  country: string | null;
  league: string | null;
  crest_url: string | null;
};

export type NationalTeam = {
  id: string;
  name: string;
  region: string | null;
  flag_url: string | null;
};

export type Player = {
  id: string;
  full_name: string;
  club_id: string | null;
  position: string | null;
  is_legendary: boolean;
};

export type DemandKind = "club" | "national_team" | "player";

export type DemandListing = {
  id: string;
  kind: DemandKind;
  club_id: string | null;
  national_team_id: string | null;
  player_id: string | null;
  raw_label: string | null;
  retro: boolean;
  season: string | null;
  target_price_cents: number | null;
  notes: string | null;
  /** migration 013 */
  sizes: string[];
  notes_admin: string | null;
  published_by: string | null;
  published_at: string;
  expires_at: string | null;
  active: boolean;
};

/** migration 013 — manualnie kurowana lista "Co warto dodać do komisu" */
export type KickbackPick = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: number;
  image_url: string | null;
  cta_label: string | null;
  cta_href: string | null;
  active: boolean;
  published_at: string;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FulfillmentOrder = {
  id: string;
  klient_id: string;
  product_id: string | null;
  buyer_name: string | null;
  tracking_number: string | null;
  carrier: string | null;
  shipping_cost_cents: number | null;
  status: string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type InventorySnapshot = {
  klient_id: string;
  day: string;
  total_value_cents: number;
  item_count: number;
};

export type SalesPlan = {
  id: string;
  klient_id: string;
  marketing_budget_cents: number;
  planned_items_text: string | null;
  expected_value_cents: number | null;
  submitted_at: string;
  status: string;
  admin_notes: string | null;
};

/** Map VAT rate (0.230, 0.080, 0.050, 0.000) to label. */
export function vatLabel(rate: number | null | undefined): string {
  if (rate == null) return "—";
  if (rate === 0) return "zw";
  return `${Math.round(rate * 100)}%`;
}

/* =========================================================== */
/* Migration 012 — Fakturownia integration                     */
/* =========================================================== */

export type FakturowniaEventStatus = "processed" | "failed" | "skipped" | "replayed";

export type FakturowniaEvent = {
  id: string;
  fakturownia_event_id: string;
  event_kind: string;
  payload: Record<string, unknown>;
  signature_valid: boolean;
  status: FakturowniaEventStatus;
  error_message: string | null;
  processed_at: string | null;
  received_at: string;
};

export type FakturowniaWarehouseMap = {
  klient_id: string;
  fakturownia_warehouse_id: number;
  warehouse_name: string | null;
  created_at: string;
  updated_at: string;
};

export type FakturowniaPushQueueStatus = "pending" | "done" | "failed";

export type FakturowniaPushQueueItem = {
  id: string;
  product_id: string;
  attempts: number;
  last_error: string | null;
  status: FakturowniaPushQueueStatus;
  next_attempt_at: string;
  created_at: string;
};
