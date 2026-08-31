/**
 * Sample data for the public site, carried across verbatim from the supplied template.
 *
 * ## Read this before wiring anything to it
 *
 * Every figure in this file is invented. The six listings are not stock the agency
 * holds, the medians are not RP Data, the 412 sales and 27-day median were never
 * achieved, and Molly & Dan Rasheed are not clients. It is here so the site can be
 * reviewed and signed off looking finished, and it is deliberately quarantined in one
 * module so that approval is a deletion rather than an archaeology exercise.
 *
 * ## Why it is not in the database
 *
 * The public site's real read path is `src/server/public/*` (CLAUDE.md 3.8 and 16) —
 * allow-listed projections over `listings`/`properties`, enforced by
 * `tests/public-boundary.test.ts`. This module bypasses none of that: it is plain
 * constants with no database access, so the boundary is untouched. When the content is
 * approved, these rows move into `src/db/seed/fixtures` and the page goes back to
 * reading `onMarket()`.
 *
 * ## What must change before this is public on a licensed site
 *
 * `SALES_FIGURES` and `TESTIMONIAL` are representations about an agency's performance
 * and about a review that does not exist. Publishing them on a page carrying RLA 350 628
 * is a misleading representation under the Australian Consumer Law, not a styling
 * choice. They are fine on a demo host and must not survive cutover to
 * www.ozirealty.com.au without being replaced by figures the agency can substantiate.
 */

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
   * displayed wording a legal artefact even in sample data — the habit is the point.
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

export const DEMO_LISTINGS: DemoListing[] = [
  {
    id: "d1",
    cat: "auction",
    tag: "Auction Sat 12 Sep · 11:00am",
    tagClass: "tag--accent",
    price: "$1,280,000 – $1,360,000",
    addr: "14 Highbury Street",
    sub: "Prospect SA 5082",
    bed: 4,
    bath: 2,
    car: 2,
    land: "612m²",
    agent: "Nadia Fielding",
    open: "Open Sat 10:00am",
    img: "photo-1570129477492-45c003edd2be",
    alt: "Sandstone villa with return verandah",
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
    agent: "Tom Rasheed",
    open: "Inspections closed",
    img: "photo-1600210491892-03d54c0aaf87",
    alt: "Apartment living room with fireplace",
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
    agent: "Nadia Fielding",
    open: "Open Sat 1:00pm",
    img: "photo-1600596542815-ffad4c1539a9",
    alt: "White rendered home under blue sky",
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
    agent: "Priya Ellis",
    open: "Open Sat 12:30pm",
    img: "photo-1628624747186-a941c476b7ef",
    alt: "Coastal home with established trees",
  },
  {
    id: "d5",
    cat: "auction",
    tag: "Auction Sat 19 Sep · 10:00am",
    tagClass: "tag--accent",
    price: "$980,000 – $1,040,000",
    addr: "62 Sydenham Road",
    sub: "Norwood SA 5067",
    bed: 3,
    bath: 2,
    car: 1,
    land: "448m²",
    agent: "Tom Rasheed",
    open: "Open Sat 11:00am",
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
    agent: "Priya Ellis",
    open: "Viewing Wed 5:15pm",
    img: "photo-1605146769289-440113cc3d00",
    alt: "Grey and white contemporary home",
  },
];

export const DEMO_FILTERS = [
  { key: "all", label: "Everything" },
  { key: "sale", label: "For sale" },
  { key: "auction", label: "Auction" },
  { key: "lease", label: "For lease" },
  { key: "offer", label: "Under offer" },
] as const;

/** The three tabs above the hero search, and what each one relabels. */
export const SEARCH_TABS = [
  { key: "buy", label: "Buy", priceLabel: "Price up to", cta: "Search 1,284 listings" },
  { key: "rent", label: "Rent", priceLabel: "Rent per week up to", cta: "Search 96 rentals" },
  { key: "sold", label: "Sold", priceLabel: "Sold price up to", cta: "Search 3,410 sold" },
] as const;

/** Suburb medians for the hero ticker. `up` drives the green/rust colour only. */
export const MEDIANS: { suburb: string; price: string; move: string; up: boolean }[] = [
  { suburb: "Prospect", price: "$1.14m", move: "+2.4%", up: true },
  { suburb: "Norwood", price: "$1.52m", move: "+1.8%", up: true },
  { suburb: "Glenelg", price: "$1.36m", move: "+3.1%", up: true },
  { suburb: "Semaphore", price: "$1.09m", move: "+4.2%", up: true },
  { suburb: "Unley", price: "$1.78m", move: "−0.4%", up: false },
  { suburb: "Walkerville", price: "$1.44m", move: "+0.7%", up: true },
  { suburb: "Henley Beach", price: "$1.62m", move: "+2.9%", up: true },
  { suburb: "Mawson Lakes", price: "$712k", move: "+1.1%", up: true },
  { suburb: "Mitcham", price: "$1.31m", move: "−0.9%", up: false },
  { suburb: "Woodville", price: "$836k", move: "+3.6%", up: true },
];

/** Invented. See the header note before this reaches www. */
export const SALES_FIGURES = [
  { value: "412", unit: "", caption: "Properties sold in the 2025–26 financial year" },
  { value: "27", unit: " days", caption: "Median time from first open to signed contract" },
  {
    value: "98.6",
    unit: "%",
    caption: "Occupancy across the rent roll, twelve-month average",
  },
  {
    value: "2.99",
    unit: "%",
    caption: "Management fee, capped — no letting or admin add-ons",
  },
];

export const SUBURB_CARDS = [
  {
    name: "Prospect",
    meta: "5082 · villas & bungalows",
    median: "$1.14m",
    move: "+2.4%",
    days: "24",
    img: "photo-1568605114967-8130f3a36994",
    alt: "Character home in Prospect",
  },
  {
    name: "Norwood",
    meta: "5067 · terraces & cottages",
    median: "$1.52m",
    move: "+1.8%",
    days: "19",
    img: "photo-1580587771525-78b9dba3b914",
    alt: "Terrace homes in Norwood",
  },
  {
    name: "Glenelg",
    meta: "5045 · coastal & apartments",
    median: "$1.36m",
    move: "+3.1%",
    days: "31",
    img: "photo-1512917774080-9991f1c4c750",
    alt: "Coastal home near Glenelg",
  },
];

/** Invented, including the review count. See the header note before this reaches www. */
export const TESTIMONIAL = {
  before: "They talked us ",
  emphasis: "out",
  after: " of listing in March, and we sold in June for ninety grand more.",
  name: "Molly & Dan Rasheed",
  detail: "Sold — 41 Alpha Road, Prospect",
  rating: "4.9 average · 218 Google reviews",
};

export const JOURNAL_POSTS = [
  {
    title: "What property management actually costs in Adelaide",
    excerpt:
      "Six local agencies, the same rental, and the fees nobody prints on the front page.",
    meta: "22 Aug · 6 min",
    img: "photo-1605276374104-dee2a0ed3cd6",
    alt: "Suburban house exterior",
  },
  {
    title: "The deep block problem: when to subdivide and when to sell whole",
    excerpt: "A 720m² block in Woodville, run both ways, with the council costs included.",
    meta: "9 Aug · 8 min",
    img: "photo-1583847268964-b28dc8f51f92",
    alt: "Living room with large window",
  },
  {
    title: "Why Adelaide auctions clear faster than Melbourne's",
    excerpt:
      "Shorter campaigns, smaller registered-bidder pools, and what that means if you are buying.",
    meta: "1 Aug · 5 min",
    img: "photo-1584738766473-61c083514bf4",
    alt: "Home surrounded by trees",
  },
];

/** Saturday openings in the footer, from the template. */
export const OPEN_HOMES = [
  "14 Highbury St, Prospect — 10:00",
  "62 Sydenham Rd, Norwood — 11:00",
  "3 Esplanade, Semaphore — 12:30",
  "27 Wattle Ave, Unley Park — 13:00",
];

/** Unsplash is allow-listed in next.config.ts; this keeps the query string in one place. */
export const photo = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
