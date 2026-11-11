/**
 * Building-check vocabulary shared by the browser (the photo tagger and coverage bar)
 * and the server (the job and the upload routes).
 */

export const AREAS = [
  { key: "exterior", label: "Exterior" },
  { key: "roof", label: "Roof" },
  { key: "gutters", label: "Gutters & downpipes" },
  { key: "subfloor", label: "Subfloor / slab edge" },
  { key: "switchboard", label: "Switchboard & meter" },
  { key: "hot_water", label: "Hot water" },
  { key: "wet_areas", label: "Bathroom / laundry" },
  { key: "kitchen", label: "Kitchen" },
  { key: "living", label: "Living & bedrooms" },
  { key: "ceilings", label: "Ceilings" },
  { key: "yard", label: "Yard, fences & retaining" },
  { key: "pool", label: "Pool / spa" },
] as const;

/** The areas that hide the expensive problems; the coverage bar asks for these. */
export const KEY_AREAS = ["exterior", "roof", "gutters", "subfloor", "switchboard", "wet_areas", "ceilings"] as const;

export const CONTEXTS = [
  {
    key: "buyer",
    title: "Buyer advocacy",
    note: "What kills the deal, what is a negotiation lever, what needs a specialist before settlement.",
  },
  {
    key: "pre_listing",
    title: "Pre-listing / appraisal",
    note: "What to fix before market, what must be disclosed, what will drag the price.",
  },
  {
    key: "property_management",
    title: "Property management",
    note: "Landlord obligations, urgent repairs, tenant damage vs fair wear and tear.",
  },
] as const;
