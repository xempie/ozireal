/**
 * "20 Omer St" and "20 Omer Street" are one house. The duplicate-address checks used to
 * compare street names exactly, so the abbreviation slipped past and the same property
 * was created twice, each with its own live listing. This is the comparison key: case,
 * dots and spacing ignored, and the street-type word expanded.
 */

const TYPES: Record<string, string> = {
  st: "street",
  str: "street",
  rd: "road",
  ave: "avenue",
  av: "avenue",
  tce: "terrace",
  ter: "terrace",
  dr: "drive",
  drv: "drive",
  cres: "crescent",
  cr: "crescent",
  ct: "court",
  crt: "court",
  pl: "place",
  pde: "parade",
  hwy: "highway",
  blvd: "boulevard",
  bvd: "boulevard",
  cct: "circuit",
  cl: "close",
  gr: "grove",
  gve: "grove",
  ln: "lane",
  la: "lane",
  sq: "square",
  esp: "esplanade",
  wy: "way",
  cnr: "corner",
};

export function streetKey(street: string | null | undefined): string {
  const words = (street ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length > 1) {
    const last = words[words.length - 1];
    words[words.length - 1] = TYPES[last] ?? last;
  }
  return words.join(" ");
}
