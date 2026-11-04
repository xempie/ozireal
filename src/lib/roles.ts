/**
 * Contact roles: the one list every form, filter, import and bulk action reads, and the
 * order they are offered in. Must match the `contact_role` enum in the database;
 * `developer` arrived in migration 0021 (owner's request, 2026-11-04).
 */
export const CONTACT_ROLES = [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
  "developer",
  "business_vendor",
  "agent",
] as const;

export type ContactRoleName = (typeof CONTACT_ROLES)[number];

/** What a person reads. The stored value stays `agent`; the business calls it Estate agent. */
export const ROLE_LABELS: Record<ContactRoleName, string> = {
  buyer: "Buyer",
  vendor: "Vendor",
  landlord: "Landlord",
  tenant: "Tenant",
  referrer: "Referrer",
  investor: "Investor",
  developer: "Developer",
  business_vendor: "Business vendor",
  agent: "Estate agent",
};

export const roleLabel = (r: string) => ROLE_LABELS[r as ContactRoleName] ?? r;
