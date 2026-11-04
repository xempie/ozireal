/**
 * Is an imported address where someone LIVES, or where they want to buy or rent?
 * (owner's request, 2026-11-04). Shared by the import dialog, which shows the answer
 * per row, and its tests.
 *
 * The column heading decides when it says ("Looking in", "Home address"). A plain
 * "Address" heading falls to the row: a street line is a home, a list of suburbs or
 * postcodes is a search area.
 */

export type AddressKind = "lives" | "looking";

export function kindFromHeading(heading: string): AddressKind | null {
  const s = heading.toLowerCase().replace(/[^a-z]/g, "");
  if (/(looking|prefer|interest|wanted|search|target|desired|buyin|rentin|wishlist)/.test(s)) return "looking";
  if (/(home|residential|postal|mailing|street|current|lives|livein|billing)/.test(s)) return "lives";
  return null;
}

const STREET =
  /\b(st|street|rd|road|ave|avenue|ct|court|dr|drive|tce|terrace|pl|place|cres|crescent|way|lane|ln|hwy|highway|pde|parade|bvd|blvd|boulevard|cl|close|gr|grove|cct|circuit|esp|esplanade|sq|square)\b\.?/i;

export function kindFromValue(value: string): AddressKind {
  const v = value.trim();
  // A street number ("12", "3/40", "12A", "Unit 3", "Lot 7") followed later by a street type.
  const numbered = /^(?:(?:unit|apt|apartment|lot|shop|suite)\s*)?\d+[a-z]?(?:\s*\/\s*\d+[a-z]?)?\b/i.test(v);
  if (numbered && STREET.test(v)) return "lives";
  if (/\b(po box|gpo box|locked bag)\b/i.test(v)) return "lives";
  return "looking";
}

export function detectAddressKind(heading: string, value: string): AddressKind {
  return kindFromHeading(heading) ?? kindFromValue(value);
}
