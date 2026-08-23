/**
 * Display labels and pure formatters.
 *
 * These moved out of sample-data because they are presentation, not data - they stay
 * exactly as they are once the screens read from the database.
 */

export const statusLabel: Record<string, string> = {
  draft: "Draft",
  live: "Live",
  under_offer: "Under offer",
  sold: "Sold",
  leased: "Leased",
  withdrawn: "Withdrawn",
};

export const approvalKindLabel: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  social: "Social",
  article: "Article",
  proposal: "Proposal",
  digest: "Vendor update",
};

export const channelLabel: Record<string, string> = {
  web_form: "Web form",
  email: "Email",
  sms: "SMS",
  social: "Social",
  phone: "Phone",
  voice_note: "Voice note",
  manual: "Manual",
  portal: "Portal",
};

export const propertyTypeLabel: Record<string, string> = {
  house: "House",
  unit: "Unit",
  townhouse: "Townhouse",
  land: "Land",
  acreage: "Acreage",
  commercial: "Commercial",
};

/** "12 Powell Street, Norwood" from the parts the query returns. */
export function formatAddress(p: {
  streetNumber: string | null;
  street: string | null;
  suburb?: string | null;
}) {
  const street = [p.streetNumber, p.street].filter(Boolean).join(" ");
  return p.suburb ? `${street}, ${p.suburb}` : street;
}
