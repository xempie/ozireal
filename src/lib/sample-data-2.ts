/**
 * Extended sample data — analytics series and the later-phase surfaces.
 *
 * Split from sample-data.ts purely so both stay readable. Same rules apply: none of
 * this is a schema, and Phase 1+ replaces the module with real queries.
 */

import { daysAgo, hoursAgo } from "./utils";

/* -------------------------------------------------------- analytics series */

/** Enquiries per week by channel, most recent last. */
export const enquiryTrend = [
  { week: "23 Jun", Web: 9, Email: 6, Social: 3, Phone: 4 },
  { week: "30 Jun", Web: 12, Email: 5, Social: 4, Phone: 3 },
  { week: "7 Jul", Web: 8, Email: 9, Social: 2, Phone: 5 },
  { week: "14 Jul", Web: 15, Email: 7, Social: 5, Phone: 4 },
  { week: "21 Jul", Web: 11, Email: 8, Social: 6, Phone: 2 },
  { week: "28 Jul", Web: 18, Email: 10, Social: 4, Phone: 6 },
  { week: "4 Aug", Web: 22, Email: 9, Social: 7, Phone: 5 },
  { week: "11 Aug", Web: 19, Email: 12, Social: 5, Phone: 4 },
  { week: "18 Aug", Web: 24, Email: 11, Social: 8, Phone: 6 },
];

/** Listing views on the public site, and the enquiries they produced. */
export const listingTrafficTrend = [
  { week: "23 Jun", Views: 1420, Enquiries: 12 },
  { week: "30 Jun", Views: 1680, Enquiries: 15 },
  { week: "7 Jul", Views: 1240, Enquiries: 11 },
  { week: "14 Jul", Views: 2180, Enquiries: 21 },
  { week: "21 Jul", Views: 1960, Enquiries: 18 },
  { week: "28 Jul", Views: 2640, Enquiries: 26 },
  { week: "4 Aug", Views: 3120, Enquiries: 31 },
  { week: "11 Aug", Views: 2870, Enquiries: 28 },
  { week: "18 Aug", Views: 3480, Enquiries: 37 },
];

export const aiSpendTrend = [
  { week: "23 Jun", Haiku: 0.42, Sonnet: 2.1 },
  { week: "30 Jun", Haiku: 0.51, Sonnet: 2.6 },
  { week: "7 Jul", Haiku: 0.38, Sonnet: 1.9 },
  { week: "14 Jul", Haiku: 0.64, Sonnet: 3.2 },
  { week: "21 Jul", Haiku: 0.58, Sonnet: 2.8 },
  { week: "28 Jul", Haiku: 0.77, Sonnet: 3.9 },
  { week: "4 Aug", Haiku: 0.91, Sonnet: 4.4 },
  { week: "11 Aug", Haiku: 0.83, Sonnet: 4.1 },
  { week: "18 Aug", Haiku: 1.13, Sonnet: 5.2 },
];

export const contactsByIntent = [
  { name: "Buying", value: 5 },
  { name: "Selling", value: 3 },
  { name: "Renting", value: 2 },
  { name: "Investing", value: 1 },
  { name: "Browsing", value: 1 },
];

export const contactsBySource = [
  { source: "Website forms", count: 34 },
  { source: "Email", count: 22 },
  { source: "Social", count: 14 },
  { source: "Phone", count: 11 },
  { source: "Referral", count: 8 },
  { source: "Walk-in", count: 4 },
];

export const pipelineFunnel = [
  { label: "Enquiries received", value: 93, note: "all channels, last 90 days" },
  { label: "Contact resolved and briefed", value: 88, note: "5 still in merge review" },
  { label: "Qualified — preferences captured", value: 51 },
  { label: "Inspected at least once", value: 27 },
  { label: "Offer or application made", value: 9 },
  { label: "Settled or leased", value: 4 },
];

export const followupCompliance = [
  { week: "23 Jun", "On time": 12, Late: 4, Missed: 2 },
  { week: "30 Jun", "On time": 15, Late: 3, Missed: 1 },
  { week: "7 Jul", "On time": 11, Late: 6, Missed: 3 },
  { week: "14 Jul", "On time": 18, Late: 4, Missed: 1 },
  { week: "21 Jul", "On time": 16, Late: 5, Missed: 2 },
  { week: "28 Jul", "On time": 21, Late: 3, Missed: 0 },
  { week: "4 Aug", "On time": 19, Late: 6, Missed: 2 },
  { week: "11 Aug", "On time": 23, Late: 4, Missed: 1 },
  { week: "18 Aug", "On time": 20, Late: 7, Missed: 3 },
];

export const suburbPerformance = [
  { suburb: "Norwood", enquiries: 38 },
  { suburb: "Greenacres", enquiries: 24 },
  { suburb: "Prospect", enquiries: 19 },
  { suburb: "Modbury", enquiries: 16 },
  { suburb: "Henley Beach", enquiries: 12 },
  { suburb: "Unley", enquiries: 9 },
];

export const approvalThroughput = [
  { day: "Thu", Approved: 6, Edited: 2, Rejected: 1, Blocked: 0 },
  { day: "Fri", Approved: 8, Edited: 3, Rejected: 0, Blocked: 1 },
  { day: "Sat", Approved: 4, Edited: 1, Rejected: 1, Blocked: 0 },
  { day: "Sun", Approved: 1, Edited: 0, Rejected: 0, Blocked: 0 },
  { day: "Mon", Approved: 9, Edited: 4, Rejected: 2, Blocked: 0 },
  { day: "Tue", Approved: 7, Edited: 2, Rejected: 1, Blocked: 1 },
  { day: "Wed", Approved: 5, Edited: 3, Rejected: 0, Blocked: 0 },
];

/* ------------------------------------------------------------- campaigns */

export type CampaignStatus = "draft" | "in_approval" | "sending" | "sent";

export interface Campaign {
  id: string;
  name: string;
  listingId: string;
  status: CampaignStatus;
  channel: "email" | "sms";
  recipients: number;
  approved: number;
  blocked: number;
  opened: number;
  replied: number;
  createdAt: Date;
  sentAt?: Date;
}

export const campaigns: Campaign[] = [
  {
    id: "cm1",
    name: "New to market — 12 Powell Street",
    listingId: "l3",
    status: "sent",
    channel: "email",
    recipients: 34,
    approved: 32,
    blocked: 2,
    opened: 24,
    replied: 7,
    createdAt: daysAgo(12),
    sentAt: daysAgo(11),
  },
  {
    id: "cm2",
    name: "Open home reminder — 3 Marden Terrace",
    listingId: "l4",
    status: "sending",
    channel: "sms",
    recipients: 18,
    approved: 18,
    blocked: 0,
    opened: 15,
    replied: 4,
    createdAt: daysAgo(2),
    sentAt: hoursAgo(20),
  },
  {
    id: "cm3",
    name: "Price adjustment — 11 Berry Fry Avenue",
    listingId: "l2",
    status: "in_approval",
    channel: "email",
    recipients: 22,
    approved: 0,
    blocked: 1,
    opened: 0,
    replied: 0,
    createdAt: hoursAgo(6),
  },
  {
    id: "cm4",
    name: "Investor alert — 5 Culvert Street",
    listingId: "l5",
    status: "draft",
    channel: "email",
    recipients: 9,
    approved: 0,
    blocked: 0,
    opened: 0,
    replied: 0,
    createdAt: hoursAgo(3),
  },
];

export const campaignPerformance = [
  { name: "Powell St", Sent: 32, Opened: 24, Replied: 7 },
  { name: "Marden Tce", Sent: 18, Opened: 15, Replied: 4 },
  { name: "Weerana Rd", Sent: 26, Opened: 17, Replied: 9 },
  { name: "Berry Fry Ave", Sent: 21, Opened: 12, Replied: 3 },
];

/* -------------------------------------------------------------- calendar */

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: Date;
  minutes: number;
  kind: "inspection" | "appraisal" | "meeting" | "settlement" | "personal";
  contactId?: string;
  listingId?: string;
  provider: "google" | "outlook" | "ozirealty";
  ourWrite: boolean;
}

export const calendarEvents: CalendarEvent[] = [
  {
    id: "e1",
    title: "Open home — 12 Powell Street",
    startsAt: daysAgo(-2),
    minutes: 30,
    kind: "inspection",
    listingId: "l3",
    provider: "ozirealty",
    ourWrite: true,
  },
  {
    id: "e2",
    title: "Open home — 3 Marden Terrace",
    startsAt: daysAgo(-2),
    minutes: 30,
    kind: "inspection",
    listingId: "l4",
    provider: "ozirealty",
    ourWrite: true,
  },
  {
    id: "e3",
    title: "Appraisal — Helen Marchetti, Glenelg",
    startsAt: daysAgo(-1),
    minutes: 60,
    kind: "appraisal",
    contactId: "c3",
    provider: "ozirealty",
    ourWrite: true,
  },
  {
    id: "e4",
    title: "Private viewing — 8 Weerana Road",
    startsAt: daysAgo(-1),
    minutes: 15,
    kind: "inspection",
    listingId: "l1",
    contactId: "c11",
    provider: "ozirealty",
    ourWrite: true,
  },
  {
    id: "e5",
    title: "Dentist",
    startsAt: daysAgo(-3),
    minutes: 45,
    kind: "personal",
    provider: "google",
    ourWrite: false,
  },
  {
    id: "e6",
    title: "Settlement — 11 Berry Fry Avenue",
    startsAt: daysAgo(-9),
    minutes: 60,
    kind: "settlement",
    listingId: "l2",
    provider: "outlook",
    ourWrite: false,
  },
  {
    id: "e7",
    title: "Vendor meeting — Geoff Pentland",
    startsAt: daysAgo(-4),
    minutes: 45,
    kind: "meeting",
    contactId: "c6",
    provider: "ozirealty",
    ourWrite: true,
  },
  {
    id: "e8",
    title: "Team catch-up",
    startsAt: daysAgo(-5),
    minutes: 30,
    kind: "meeting",
    provider: "google",
    ourWrite: false,
  },
];

export const syncState = {
  google: { connected: true, lastSync: hoursAgo(1), events: 34, direction: "two-way" },
  outlook: { connected: true, lastSync: hoursAgo(2), events: 12, direction: "two-way" },
};

/* ----------------------------------------------------------- voice notes */

export interface VoiceNote {
  id: string;
  recordedAt: Date;
  seconds: number;
  contactId?: string;
  transcript: string;
  extracted: string[];
  status: "transcribed" | "processing" | "confirmed";
}

export const voiceNotes: VoiceNote[] = [
  {
    id: "v1",
    recordedAt: hoursAgo(2),
    seconds: 47,
    contactId: "c1",
    status: "transcribed",
    transcript:
      "Just showed Priya through Powell Street again. She loves it but wants to know about the Payneham unit first — need to get her an appraisal on that this week, and check whether the vendor would consider a longer settlement.",
    extracted: [
      "Appraise Priya Raman's Payneham unit",
      "Check settlement flexibility with the Powell St beneficiaries",
    ],
  },
  {
    id: "v2",
    recordedAt: hoursAgo(26),
    seconds: 31,
    contactId: "c3",
    status: "confirmed",
    transcript:
      "Spoke to Helen at Glenelg. Appraisal Thursday two o'clock. She's talking to one other agency so lead with marketing spend, not commission.",
    extracted: ["Prepare the Glenelg appraisal pack — lead with marketing spend"],
  },
  {
    id: "v3",
    recordedAt: daysAgo(2),
    seconds: 62,
    status: "confirmed",
    transcript:
      "Note to self — the Culvert Street unit needs photos before it can go live. Tenant is there until November so we need 24 hours notice for access.",
    extracted: ["Book photography for 5 Culvert Street", "Give tenant 24h access notice"],
  },
  {
    id: "v4",
    recordedAt: hoursAgo(1),
    seconds: 18,
    status: "processing",
    transcript: "",
    extracted: [],
  },
];

/* ------------------------------------------------------------- proposals */

export interface Proposal {
  id: string;
  propertyId: string;
  contactId: string;
  status: "draft" | "in_approval" | "sent" | "won" | "lost";
  createdAt: Date;
  estimateLow: number;
  estimateHigh: number;
  comparables: number;
  pages: number;
}

export const proposals: Proposal[] = [
  {
    id: "pr1",
    propertyId: "p5",
    contactId: "c3",
    status: "in_approval",
    createdAt: hoursAgo(8),
    estimateLow: 940000,
    estimateHigh: 1010000,
    comparables: 6,
    pages: 11,
  },
  {
    id: "pr2",
    propertyId: "p4",
    contactId: "c6",
    status: "won",
    createdAt: daysAgo(28),
    estimateLow: 790000,
    estimateHigh: 850000,
    comparables: 8,
    pages: 12,
  },
  {
    id: "pr3",
    propertyId: "p2",
    contactId: "c9",
    status: "sent",
    createdAt: daysAgo(48),
    estimateLow: 720000,
    estimateHigh: 780000,
    comparables: 7,
    pages: 10,
  },
];

/* --------------------------------------------------------------- content */

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "in_approval" | "published";
  words: number;
  createdAt: Date;
  publishedAt?: Date;
  views30d: number;
  legacy: boolean;
}

export const blogPosts: BlogPost[] = [
  {
    id: "b1",
    title: "What a north-facing rear actually does for a house",
    slug: "north-facing-rear-adelaide",
    status: "in_approval",
    words: 940,
    createdAt: daysAgo(1),
    views30d: 0,
    legacy: false,
  },
  {
    id: "b2",
    title: "Why 2025 is the perfect time to buy a house in Adelaide",
    slug: "why-2025-is-the-perfect-time-to-buy-a-house-in-adelaide",
    status: "published",
    words: 1120,
    createdAt: daysAgo(240),
    publishedAt: daysAgo(238),
    views30d: 1840,
    legacy: true,
  },
  {
    id: "b3",
    title: "Understanding property valuation methods in Adelaide",
    slug: "understanding-property-valuation-methods-adelaide-a-friendly-guide",
    status: "published",
    words: 1460,
    createdAt: daysAgo(180),
    publishedAt: daysAgo(178),
    views30d: 2210,
    legacy: true,
  },
  {
    id: "b4",
    title: "Why use buyer agent services when buying property in Adelaide",
    slug: "why-use-buyer-agent-services-when-buying-property-in-adelaide",
    status: "published",
    words: 980,
    createdAt: daysAgo(150),
    publishedAt: daysAgo(148),
    views30d: 1320,
    legacy: true,
  },
  {
    id: "b5",
    title: "Cooling-off periods in South Australia, plainly explained",
    slug: "cooling-off-periods-south-australia",
    status: "draft",
    words: 420,
    createdAt: hoursAgo(20),
    views30d: 0,
    legacy: false,
  },
];

export interface SocialPost {
  id: string;
  network: "Instagram" | "Facebook" | "LinkedIn";
  status: "draft" | "in_approval" | "published";
  body: string;
  listingId?: string;
  createdAt: Date;
  engagement: number;
}

export const socialPosts: SocialPost[] = [
  {
    id: "s1",
    network: "Instagram",
    status: "in_approval",
    body: "Quiet street, character intact, north-facing rear. 12 Powell Street, Norwood is open Saturday 11:00-11:30.",
    listingId: "l3",
    createdAt: hoursAgo(18),
    engagement: 0,
  },
  {
    id: "s2",
    network: "Facebook",
    status: "published",
    body: "Just listed in Greenacres — four bedrooms, 6.6kW solar, and an alfresco that runs the width of the house.",
    listingId: "l4",
    createdAt: daysAgo(22),
    engagement: 148,
  },
  {
    id: "s3",
    network: "LinkedIn",
    status: "draft",
    body: "Adelaide rental yields by suburb — what the numbers actually say this quarter.",
    createdAt: daysAgo(3),
    engagement: 0,
  },
];

export const contentTrend = [
  { month: "Mar", Published: 3, Views: 2100 },
  { month: "Apr", Published: 4, Views: 2840 },
  { month: "May", Published: 2, Views: 3120 },
  { month: "Jun", Published: 5, Views: 4200 },
  { month: "Jul", Published: 4, Views: 5100 },
  { month: "Aug", Published: 3, Views: 5940 },
];

/* -------------------------------------------------------------------- SEO */

export interface SeoIssue {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  affected: number;
  detail: string;
  proposal: string;
}

export const seoIssues: SeoIssue[] = [
  {
    id: "se1",
    severity: "critical",
    title: "Legacy URLs with no redirect target decided",
    affected: 22,
    detail:
      "The 22 Wix service pages have no mapping yet. Without one, every inbound link and ranking on those pages is lost at cutover.",
    proposal: "Generate a one-to-one redirect map and flag the pages with no equivalent.",
  },
  {
    id: "se2",
    severity: "critical",
    title: "Two indexed URLs contain spelling errors",
    affected: 2,
    detail:
      "/oversees-investment and /contact-adelaide-realestae-agency are indexed with typos in the path.",
    proposal:
      "Publish corrected slugs and 301 from the misspelled ones. Never drop the old URL.",
  },
  {
    id: "se3",
    severity: "warning",
    title: "Listing pages missing structured data",
    affected: 4,
    detail: "No RealEstateListing JSON-LD on the four legacy property pages.",
    proposal: "Emit JSON-LD from the listing record on every listing page.",
  },
  {
    id: "se4",
    severity: "warning",
    title: "Suburb pages do not exist yet",
    affected: 12,
    detail:
      "Twelve suburbs have live or sold stock but no suburb page, so the archive earns nothing organically.",
    proposal: "Generate a suburb page per suburb from live listings and sold history.",
  },
  {
    id: "se5",
    severity: "info",
    title: "Images missing alt text",
    affected: 63,
    detail: "63 listing images have no alt attribute.",
    proposal: "Draft alt text from the listing description for review.",
  },
];

export const seoTrend = [
  { month: "Mar", Impressions: 8400, Clicks: 210 },
  { month: "Apr", Impressions: 9200, Clicks: 248 },
  { month: "May", Impressions: 8800, Clicks: 231 },
  { month: "Jun", Impressions: 11400, Clicks: 312 },
  { month: "Jul", Impressions: 12800, Clicks: 361 },
  { month: "Aug", Impressions: 14200, Clicks: 402 },
];

/* --------------------------------------------------- website management */

export const suburbPages = [
  { suburb: "Norwood", live: 1, sold: 1, words: 0, status: "not built" },
  { suburb: "Greenacres", live: 2, sold: 0, words: 0, status: "not built" },
  { suburb: "Modbury", live: 1, sold: 0, words: 0, status: "not built" },
  { suburb: "Prospect", live: 1, sold: 0, words: 0, status: "not built" },
  { suburb: "Henley Beach", live: 0, sold: 0, words: 0, status: "not built" },
];

export const redirects = [
  { from: "/manage-property-adelaide", to: "/property-management", status: "mapped" },
  { from: "/rent-out-my-property-adelaide", to: "/property-management", status: "mapped" },
  { from: "/sell-property-house-adelaide", to: "/sell", status: "mapped" },
  { from: "/buyer-agent-adelaide", to: "/buyers-agent", status: "mapped" },
  { from: "/oversees-investment", to: "/overseas-investment", status: "mapped" },
  { from: "/contact-adelaide-realestae-agency", to: "/contact", status: "mapped" },
  { from: "/free-property-appraisal-sa", to: "/appraisal", status: "mapped" },
  { from: "/realestate-gift-adelaide", to: "", status: "undecided" },
  { from: "/inquiry-services-page", to: "", status: "undecided" },
  { from: "/book-online", to: "", status: "blocked" },
  { from: "/properties/8-weerana-road", to: "/for-rent/8-weerana-road-greenacres-sa-5086-1041", status: "mapped" },
  { from: "/properties/greenacres", to: "", status: "undecided" },
];

export const migrationChecklist = [
  { task: "Inventory captured from live sitemaps", done: true },
  { task: "Search Console verified", done: false },
  { task: "Current rankings captured", done: false },
  { task: "Redirect map complete for all 22 pages", done: false },
  { task: "Blog content exported from Wix", done: false },
  { task: "/book-online replacement decided", done: false },
  { task: "DNS TTL lowered", done: false },
  { task: "Post-cutover redirect crawl", done: false },
];

/* -------------------------------------------------------------- audit log */

export interface AuditEntry {
  id: string;
  at: Date;
  actor: string;
  action: string;
  target: string;
  kind: "approve" | "reject" | "edit" | "merge" | "publish" | "commit" | "login";
}

export const auditLog: AuditEntry[] = [
  { id: "au1", at: hoursAgo(1), actor: "Sam Whitfield", action: "Approved SMS", target: "Priya Raman — Powell St inspection", kind: "approve" },
  { id: "au2", at: hoursAgo(3), actor: "Sam Whitfield", action: "Committed proposed task", target: "Appraise Payneham unit", kind: "commit" },
  { id: "au3", at: hoursAgo(5), actor: "System", action: "Blocked email at send time", target: "Tom Beaumont — consent revoked", kind: "reject" },
  { id: "au4", at: hoursAgo(12), actor: "Sam Whitfield", action: "Edited draft before approval", target: "Vendor update — Marden Terrace", kind: "edit" },
  { id: "au5", at: hoursAgo(20), actor: "Sam Whitfield", action: "Signed in", target: "sam@ozirealty.com.au", kind: "login" },
  { id: "au6", at: daysAgo(1), actor: "Sam Whitfield", action: "Published listing", target: "3 Marden Terrace, Greenacres", kind: "publish" },
  { id: "au7", at: daysAgo(2), actor: "Sam Whitfield", action: "Rejected SMS", target: "Rebecca Nolan — too generic", kind: "reject" },
  { id: "au8", at: daysAgo(3), actor: "Sam Whitfield", action: "Kept both records", target: "Merge review — Raman / Ramann", kind: "merge" },
  { id: "au9", at: daysAgo(4), actor: "Sam Whitfield", action: "Committed preference change", target: "Priya Raman — school proximity", kind: "commit" },
  { id: "au10", at: daysAgo(6), actor: "Sam Whitfield", action: "Approved vendor update", target: "Geoff Pentland — Greenacres", kind: "approve" },
];

/* ------------------------------------------------------------ saved views */

export const savedViews = [
  { name: "Hot buyers", count: 3, detail: "sentiment hot or warm, finance approved" },
  { name: "No contact in 30 days", count: 4, detail: "last touch over 30 days ago" },
  { name: "Vendors — campaign live", count: 2, detail: "role vendor, listing status live" },
  { name: "Email consent lapsed", count: 2, detail: "revoked or never granted" },
  { name: "Rental applicants", count: 2, detail: "role tenant, application open" },
];
