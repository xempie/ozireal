/**
 * The only invented content left on the site: placeholder listing cards.
 *
 * ## What this is, and what it used to be
 *
 * This file carried the design template's whole invented world: 412 sales, a 27-day
 * median, 98.6% occupancy, a suburb medians ticker, a testimonial from people who do not
 * exist, a second office, and three named agents. All of it is gone. The agency's real
 * copy is in `agency.ts`, taken from www.ozirealty.com.au.
 *
 * What remains is six listing cards, because there is no stock in the database yet and a
 * property site with an empty grid cannot be reviewed. They are placeholders for layout,
 * nothing more.
 *
 * ## Two rules they follow, which the originals did not
 *
 * No invented people. The template attributed each listing to "Nadia Fielding", "Tom
 * Rasheed" or "Priya Ellis". OziRealty's licensed agent is Esi Dor, and inventing
 * colleagues for a real principal misrepresents who a buyer would be dealing with. Every
 * card names the principal.
 *
 * No invented performance. These are properties at an asking price, not claims about
 * what the agency has achieved.
 *
 * ## Why it is not in the database
 *
 * The public site's real read path is `src/server/public/*` (CLAUDE.md 3.8 and 16):
 * allow-listed projections over `listings`/`properties`, enforced by
 * `tests/public-boundary.test.ts`. This module bypasses none of that. It is plain
 * constants with no database access, so the boundary is untouched. When there are real
 * rows to read, this file is deleted rather than edited.
 */

import { AGENCY } from "./agency";

export type DemoCategory = "sale" | "auction" | "lease" | "offer";

export interface DemoListing {
  id: string;
  cat: DemoCategory;
  /** Corner flag on the card. */
  tag: string;
  /** "", "tag--accent" or "tag--ink" — the card styles that already exist. */
  tagClass: string;
  /**
   * Authored verbatim, never composed from a number. Under-quoting provisions make the
   * displayed wording a legal artefact even in placeholder data: the habit is the point.
   */
  price: string;
  addr: string;
  sub: string;
  bed: number;
  bath: number;
  car: number;
  land: string;
  agent: string;
  open: string;
  /** Unsplash photo id; the host is allow-listed in next.config.ts. */
  img: string;
  alt: string;
}

const AGENT = AGENCY.principal;

export const DEMO_LISTINGS: DemoListing[] = [
  {
    id: "d1",
    cat: "auction",
    tag: "Auction Saturday",
    tagClass: "tag--accent",
    price: "$1,280,000 – $1,360,000",
    addr: "14 Highbury Street",
    sub: "Prospect SA 5082",
    bed: 4,
    bath: 2,
    car: 2,
    land: "612m²",
    agent: AGENT,
    open: "Open Saturday 10:00am",
    img: "photo-1570129477492-45c003edd2be",
    alt: "Sandstone villa with a return verandah",
  },
  {
    id: "d2",
    cat: "offer",
    tag: "Under offer",
    tagClass: "tag--ink",
    price: "$845,000",
    addr: "8 / 121 Melbourne Street",
    sub: "North Adelaide SA 5006",
    bed: 2,
    bath: 1,
    car: 1,
    land: "96m²",
    agent: AGENT,
    open: "Inspections closed",
    img: "photo-1600210491892-03d54c0aaf87",
    alt: "Apartment living room with a fireplace",
  },
  {
    id: "d3",
    cat: "sale",
    tag: "Expressions of interest",
    tagClass: "",
    price: "Contact agent",
    addr: "27 Wattle Avenue",
    sub: "Unley Park SA 5061",
    bed: 5,
    bath: 3,
    car: 4,
    land: "1,043m²",
    agent: AGENT,
    open: "Open Saturday 1:00pm",
    img: "photo-1600596542815-ffad4c1539a9",
    alt: "White rendered home under a blue sky",
  },
  {
    id: "d4",
    cat: "sale",
    tag: "New this week",
    tagClass: "tag--accent",
    price: "$1,950,000",
    addr: "3 Esplanade",
    sub: "Semaphore SA 5019",
    bed: 4,
    bath: 2,
    car: 2,
    land: "740m²",
    agent: AGENT,
    open: "Open Saturday 12:30pm",
    img: "photo-1628624747186-a941c476b7ef",
    alt: "Coastal home with established trees",
  },
  {
    id: "d5",
    cat: "auction",
    tag: "Auction Saturday",
    tagClass: "tag--accent",
    price: "$980,000 – $1,040,000",
    addr: "62 Sydenham Road",
    sub: "Norwood SA 5067",
    bed: 3,
    bath: 2,
    car: 1,
    land: "448m²",
    agent: AGENT,
    open: "Open Saturday 11:00am",
    img: "photo-1598228723793-52759bba239c",
    alt: "Brick home framed by green trees",
  },
  {
    id: "d6",
    cat: "lease",
    tag: "For lease",
    tagClass: "tag--ink",
    price: "$760 per week",
    addr: "19 Kensington Road",
    sub: "Rose Park SA 5067",
    bed: 2,
    bath: 2,
    car: 1,
    land: "210m²",
    agent: AGENT,
    open: "Viewing Wednesday 5:15pm",
    img: "photo-1605146769289-440113cc3d00",
    alt: "Grey and white contemporary home",
  },
];

/**
 * The archive.
 *
 * Kept because the sold and leased archive is the public site's best organic asset
 * (CLAUDE.md 16) and the page needs something to lay out. Deliberately not presented as
 * a track record: there is no count, no median and no days-on-market figure anywhere on
 * that page, because those would be performance claims rather than placeholders.
 */
export const DEMO_SOLD: DemoListing[] = [
  {
    id: "s1",
    cat: "sale",
    tag: "Sold",
    tagClass: "tag--ink",
    price: "Sold $1,182,000",
    addr: "41 Alpha Road",
    sub: "Prospect SA 5082",
    bed: 3,
    bath: 2,
    car: 2,
    land: "580m²",
    agent: AGENT,
    open: "Sold",
    img: "photo-1568605114967-8130f3a36994",
    alt: "Character home in Prospect",
  },
  {
    id: "s2",
    cat: "sale",
    tag: "Sold",
    tagClass: "tag--ink",
    price: "Sold $1,640,000",
    addr: "9 Woods Street",
    sub: "Norwood SA 5067",
    bed: 4,
    bath: 2,
    car: 2,
    land: "496m²",
    agent: AGENT,
    open: "Sold",
    img: "photo-1580587771525-78b9dba3b914",
    alt: "Terrace home in Norwood",
  },
  {
    id: "s3",
    cat: "lease",
    tag: "Leased",
    tagClass: "tag--ink",
    price: "Leased $690 per week",
    addr: "2 / 18 Colley Terrace",
    sub: "Glenelg SA 5045",
    bed: 2,
    bath: 1,
    car: 1,
    land: "128m²",
    agent: AGENT,
    open: "Leased",
    img: "photo-1512917774080-9991f1c4c750",
    alt: "Coastal apartment near Glenelg",
  },
];

export const DEMO_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "sale", label: "For sale" },
  { key: "auction", label: "Auction" },
  { key: "lease", label: "For lease" },
  { key: "offer", label: "Under offer" },
] as const;

export { photo } from "./agency";
