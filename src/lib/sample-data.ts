/**
 * Sample data for the console prototype.
 *
 * NOT a schema. This file exists so the screens can be argued about before the
 * migrations are written (see docs/console-features.md). Every shape here is a
 * deliberate simplification of §4 of CLAUDE.md; Phase 1 replaces the whole module
 * with Drizzle queries and the screens keep their layout.
 *
 * All people, messages and prices are invented. The four street addresses are the
 * ones currently on ozirealty.com.au, so the migration screens show real targets.
 */

import { daysAgo, hoursAgo } from "./utils";

/* ------------------------------------------------------------------ types */

export type Channel =
  | "web_form"
  | "email"
  | "sms"
  | "social"
  | "phone"
  | "voice_note"
  | "manual";

export type Role =
  | "buyer"
  | "vendor"
  | "landlord"
  | "tenant"
  | "referrer"
  | "investor";

export type IntentType = "buying" | "selling" | "renting" | "investing" | "browsing";

export type ConsentStatus = "granted" | "revoked" | "never_given";

export interface Consent {
  channel: "email" | "sms" | "phone";
  status: ConsentStatus;
  sourceForm: string;
  wordingShown: string;
  ip: string;
  at: Date;
}

export interface Interaction {
  id: string;
  contactId: string;
  channel: Channel;
  direction: "in" | "out";
  at: Date;
  subject: string;
  body: string;
  hasRaw: boolean;
  listingId?: string;
}

export interface Preferences {
  suburbs: string[];
  priceMin: number;
  priceMax: number;
  bedsMin: number;
  bathsMin: number;
  parkingMin: number;
  propertyTypes: string[];
  timeline: string;
  financeStatus: string;
  softRequirements: string;
}

export interface Intent {
  type: IntentType;
  budgetBand: string;
  timeline: string;
  blockers: string[];
  sentiment: "warm" | "neutral" | "cooling" | "hot";
  confidence: number;
  brief: string;
  rebuiltAt: Date;
}

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  suburb: string;
  roles: Role[];
  owner: string;
  source: Channel;
  lastFollowupAt: Date;
  lastFollowupOutcome: string;
  followupDueAt: Date | null;
  doNotContact: boolean;
  createdAt: Date;
  preferences?: Preferences;
  intent?: Intent;
  consents: Consent[];
}

export interface PropertyRecord {
  id: string;
  address: string;
  suburb: string;
  postcode: string;
  state: string;
  type: string;
  beds: number;
  baths: number;
  parking: number;
  landSqm: number;
  floorSqm: number;
  yearBuilt: number;
  condition: string;
  features: string[];
  ownerContactId: string;
  internalNotes: string;
  internalPriceExpectation: string;
  gnafPid: string | null;
  lat: number | null;
  lng: number | null;
}

export type ListingStatus =
  | "draft"
  | "live"
  | "under_offer"
  | "sold"
  | "leased"
  | "withdrawn";

export interface Listing {
  id: string;
  propertyId: string;
  type: "sale" | "rent";
  method: string;
  status: ListingStatus;
  priceDisplay: string;
  searchMin: number;
  searchMax: number;
  rentPw?: number;
  headline: string;
  copy: string;
  slug: string;
  photos: number;
  hasFloorplan: boolean;
  listedAt: Date;
  publishedAt: Date | null;
  soldAt?: Date;
  resultDisplay?: string;
  views7d: number;
  enquiries7d: number;
}

export interface Inspection {
  id: string;
  listingId: string;
  startsAt: Date;
  minutes: number;
  kind: "open" | "private";
  registrations: number;
}

export interface Match {
  listingId: string;
  contactId: string;
  score: number;
  reason: string;
  stage: "filter" | "vector" | "ranked";
}

export type ApprovalKind = "email" | "sms" | "social" | "article" | "proposal" | "digest";
export type ApprovalStatus = "pending" | "approved" | "sent" | "blocked" | "rejected";

export interface ApprovalItem {
  id: string;
  kind: ApprovalKind;
  status: ApprovalStatus;
  contactId?: string;
  listingId?: string;
  subject: string;
  body: string;
  createdAt: Date;
  consentAtDraft: ConsentStatus;
  consentNow: ConsentStatus;
  blockReason?: string;
  rejectReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  model: string;
  costAud: number;
}

export type ConfirmKind = "task" | "preference_change" | "intent_correction";

export interface ConfirmItem {
  id: string;
  kind: ConfirmKind;
  contactId: string;
  sourceInteractionId: string;
  summary: string;
  before?: string;
  after: string;
  confidence: number;
  createdAt: Date;
}

export interface MergeReview {
  id: string;
  aId: string;
  bId: string;
  similarity: number;
  matchedOn: string;
  createdAt: Date;
}

export interface Task {
  id: string;
  contactId: string;
  title: string;
  dueAt: Date;
  done: boolean;
  source: string;
}

export interface AiGeneration {
  task: string;
  model: "Haiku" | "Sonnet";
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costAud: number;
  avgLatencyMs: number;
}

/* --------------------------------------------------------------- agency */

export const agency = {
  name: "Ozi Realty",
  tradingName: "Ozi Realty Adelaide",
  licence: "RLA 123456",
  jurisdiction: "South Australia",
  abn: "00 000 000 000",
  timezone: "Australia/Adelaide",
  user: { name: "Sam Whitfield", email: "sam@ozirealty.com.au", role: "Principal" },
};

export const suburbs = [
  "Norwood",
  "Prospect",
  "Glenelg",
  "Unley",
  "Mawson Lakes",
  "Greenacres",
  "Magill",
  "Henley Beach",
  "Payneham",
  "Modbury",
  "Brighton",
  "Salisbury",
];

/* -------------------------------------------------------------- contacts */

const consentWording =
  "I agree to Ozi Realty contacting me about properties and services that match my enquiry. I can unsubscribe at any time.";

export const contacts: Contact[] = [
  {
    id: "c1",
    firstName: "Priya",
    lastName: "Raman",
    email: "priya.raman@example.com",
    phone: "+61 412 004 118",
    suburb: "Norwood",
    roles: ["buyer"],
    owner: "Sam Whitfield",
    source: "web_form",
    lastFollowupAt: daysAgo(2),
    lastFollowupOutcome: "Wants to see Powell St before making an offer",
    followupDueAt: daysAgo(1),
    doNotContact: false,
    createdAt: daysAgo(34),
    preferences: {
      suburbs: ["Norwood", "Payneham", "Magill"],
      priceMin: 700000,
      priceMax: 850000,
      bedsMin: 3,
      bathsMin: 2,
      parkingMin: 1,
      propertyTypes: ["House", "Townhouse"],
      timeline: "Within 3 months",
      financeStatus: "Pre-approved",
      softRequirements:
        "Quiet street, definitely not on a main road. Wants a north-facing back yard and a school within walking distance.",
    },
    intent: {
      type: "buying",
      budgetBand: "$700k – $850k",
      timeline: "3 months",
      blockers: ["Needs to sell current unit at Payneham"],
      sentiment: "hot",
      confidence: 0.86,
      brief:
        "Pre-approved buyer, actively inspecting. Two inspections in the last fortnight and asked directly about Powell St twice. Main blocker is the Payneham unit — she has not listed it yet and has said she would rather buy first. Worth a conversation about a bridging arrangement, and worth putting her in front of anything quiet and north-facing in Norwood under $850k.",
      rebuiltAt: hoursAgo(6),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Listing enquiry — 12 Powell Street",
        wordingShown: consentWording,
        ip: "203.0.113.44",
        at: daysAgo(34),
      },
      {
        channel: "sms",
        status: "granted",
        sourceForm: "Inspection registration",
        wordingShown: consentWording,
        ip: "203.0.113.44",
        at: daysAgo(12),
      },
    ],
  },
  {
    id: "c2",
    firstName: "Daniel",
    lastName: "Okafor",
    email: "d.okafor@example.com",
    phone: "+61 431 887 220",
    suburb: "Prospect",
    roles: ["buyer", "investor"],
    owner: "Sam Whitfield",
    source: "email",
    lastFollowupAt: daysAgo(9),
    lastFollowupOutcome: "Asked for rental yield figures, not yet sent",
    followupDueAt: daysAgo(2),
    doNotContact: false,
    createdAt: daysAgo(61),
    preferences: {
      suburbs: ["Prospect", "Salisbury", "Modbury"],
      priceMin: 450000,
      priceMax: 600000,
      bedsMin: 3,
      bathsMin: 1,
      parkingMin: 1,
      propertyTypes: ["House", "Unit"],
      timeline: "6 months",
      financeStatus: "Finance not started",
      softRequirements:
        "Purely yield-driven. Low maintenance, happy with an older place if the numbers work. Not interested in anything that needs renovation.",
    },
    intent: {
      type: "investing",
      budgetBand: "$450k – $600k",
      timeline: "6 months",
      blockers: ["Finance not started", "Waiting on rental yield data we owe him"],
      sentiment: "cooling",
      confidence: 0.64,
      brief:
        "Investor, second purchase. Engagement has dropped since he asked for yield figures nine days ago and did not get them — that request is still open and is the obvious reason for the cooling. Finance not started, so any timeline is soft. Sending the numbers he asked for is the whole job here.",
      rebuiltAt: hoursAgo(30),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Suburb insight report download",
        wordingShown: consentWording,
        ip: "198.51.100.9",
        at: daysAgo(61),
      },
      {
        channel: "sms",
        status: "never_given",
        sourceForm: "—",
        wordingShown: "—",
        ip: "—",
        at: daysAgo(61),
      },
    ],
  },
  {
    id: "c3",
    firstName: "Helen",
    lastName: "Marchetti",
    email: "helen.marchetti@example.com",
    phone: "+61 408 552 901",
    suburb: "Glenelg",
    roles: ["vendor"],
    owner: "Sam Whitfield",
    source: "phone",
    lastFollowupAt: daysAgo(1),
    lastFollowupOutcome: "Appraisal booked for Thursday",
    followupDueAt: daysAgo(0),
    doNotContact: false,
    createdAt: daysAgo(18),
    intent: {
      type: "selling",
      budgetBand: "Appraisal pending",
      timeline: "Listing in spring",
      blockers: ["Deciding between two agencies"],
      sentiment: "warm",
      confidence: 0.71,
      brief:
        "Prospective vendor at Glenelg, appraisal booked Thursday. She mentioned she is speaking to one other agency, so the appraisal is competitive. Has asked twice about marketing spend — worth leading with that rather than commission.",
      rebuiltAt: hoursAgo(20),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Free property appraisal",
        wordingShown: consentWording,
        ip: "203.0.113.77",
        at: daysAgo(18),
      },
      {
        channel: "phone",
        status: "granted",
        sourceForm: "Free property appraisal",
        wordingShown: consentWording,
        ip: "203.0.113.77",
        at: daysAgo(18),
      },
    ],
  },
  {
    id: "c4",
    firstName: "Tom",
    lastName: "Beaumont",
    email: "tom.beaumont@example.com",
    phone: "+61 402 331 776",
    suburb: "Unley",
    roles: ["buyer"],
    owner: "Sam Whitfield",
    source: "social",
    lastFollowupAt: daysAgo(21),
    lastFollowupOutcome: "Unsubscribed from email after the last campaign",
    followupDueAt: null,
    doNotContact: false,
    createdAt: daysAgo(75),
    preferences: {
      suburbs: ["Unley", "Norwood"],
      priceMin: 900000,
      priceMax: 1200000,
      bedsMin: 4,
      bathsMin: 2,
      parkingMin: 2,
      propertyTypes: ["House"],
      timeline: "12 months",
      financeStatus: "Pre-approved",
      softRequirements: "Character home, period detail. Not a new build.",
    },
    intent: {
      type: "buying",
      budgetBand: "$900k – $1.2m",
      timeline: "12 months",
      blockers: ["Unsubscribed from email — SMS only"],
      sentiment: "neutral",
      confidence: 0.58,
      brief:
        "Character-home buyer with a long timeline. Revoked email consent three weeks ago after a campaign send, so email is off the table entirely — SMS consent is still current. Not urgent, but exactly the right person for an off-market character listing in Unley.",
      rebuiltAt: daysAgo(3),
    },
    consents: [
      {
        channel: "email",
        status: "revoked",
        sourceForm: "Unsubscribe link, campaign #41",
        wordingShown: consentWording,
        ip: "198.51.100.31",
        at: daysAgo(21),
      },
      {
        channel: "sms",
        status: "granted",
        sourceForm: "Instagram enquiry",
        wordingShown: consentWording,
        ip: "198.51.100.31",
        at: daysAgo(75),
      },
    ],
  },
  {
    id: "c5",
    firstName: "Amira",
    lastName: "Haddad",
    email: "amira.h@example.com",
    phone: "+61 439 210 664",
    suburb: "Mawson Lakes",
    roles: ["tenant"],
    owner: "Sam Whitfield",
    source: "web_form",
    lastFollowupAt: daysAgo(4),
    lastFollowupOutcome: "Application submitted for Weerana Rd",
    followupDueAt: daysAgo(0),
    doNotContact: false,
    createdAt: daysAgo(11),
    preferences: {
      suburbs: ["Mawson Lakes", "Salisbury"],
      priceMin: 0,
      priceMax: 0,
      bedsMin: 2,
      bathsMin: 1,
      parkingMin: 1,
      propertyTypes: ["House", "Townhouse"],
      timeline: "Immediate",
      financeStatus: "n/a — rental",
      softRequirements: "Needs to be walkable to the UniSA campus. Pet-friendly, one cat.",
    },
    intent: {
      type: "renting",
      budgetBand: "$520 – $580 per week",
      timeline: "Immediate",
      blockers: ["Needs pet approval"],
      sentiment: "warm",
      confidence: 0.79,
      brief:
        "Rental applicant for Weerana Rd, application in four days ago. The one open question is the cat — the owner has not been asked yet, and she has said it is a deal-breaker. Ask the owner before she keeps looking.",
      rebuiltAt: hoursAgo(9),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Rental enquiry — 8 Weerana Road",
        wordingShown: consentWording,
        ip: "203.0.113.150",
        at: daysAgo(11),
      },
      {
        channel: "sms",
        status: "granted",
        sourceForm: "Rental enquiry — 8 Weerana Road",
        wordingShown: consentWording,
        ip: "203.0.113.150",
        at: daysAgo(11),
      },
    ],
  },
  {
    id: "c6",
    firstName: "Geoff",
    lastName: "Pentland",
    email: "g.pentland@example.com",
    phone: "+61 419 774 003",
    suburb: "Greenacres",
    roles: ["vendor", "landlord"],
    owner: "Sam Whitfield",
    source: "manual",
    lastFollowupAt: daysAgo(6),
    lastFollowupOutcome: "Happy with progress, wants a fortnightly update",
    followupDueAt: daysAgo(-1),
    doNotContact: false,
    createdAt: daysAgo(210),
    intent: {
      type: "selling",
      budgetBand: "Listed",
      timeline: "Campaign running",
      blockers: [],
      sentiment: "warm",
      confidence: 0.9,
      brief:
        "Vendor of the Greenacres property, campaign live. Also owns the Weerana Rd rental. Asked for fortnightly updates and has been given them consistently — next one is due Friday. Low-maintenance client, and the most likely source of a referral this quarter.",
      rebuiltAt: daysAgo(1),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Agency agreement",
        wordingShown: consentWording,
        ip: "203.0.113.5",
        at: daysAgo(210),
      },
      {
        channel: "phone",
        status: "granted",
        sourceForm: "Agency agreement",
        wordingShown: consentWording,
        ip: "203.0.113.5",
        at: daysAgo(210),
      },
    ],
  },
  {
    id: "c7",
    firstName: "Wei",
    lastName: "Zhang",
    email: "wei.zhang@example.com",
    phone: "+61 421 556 118",
    suburb: "Henley Beach",
    roles: ["buyer", "investor"],
    owner: "Sam Whitfield",
    source: "email",
    lastFollowupAt: daysAgo(15),
    lastFollowupOutcome: "Overseas until September, wants video walkthroughs",
    followupDueAt: daysAgo(-8),
    doNotContact: false,
    createdAt: daysAgo(48),
    preferences: {
      suburbs: ["Henley Beach", "Brighton", "Glenelg"],
      priceMin: 800000,
      priceMax: 1100000,
      bedsMin: 3,
      bathsMin: 2,
      parkingMin: 1,
      propertyTypes: ["House", "Townhouse"],
      timeline: "On return, September",
      financeStatus: "Cash",
      softRequirements: "Walking distance to the beach. Will buy sight-unseen on video.",
    },
    intent: {
      type: "buying",
      budgetBand: "$800k – $1.1m",
      timeline: "September",
      blockers: ["Overseas until September"],
      sentiment: "warm",
      confidence: 0.74,
      brief:
        "Cash buyer, overseas until September, explicitly willing to buy on a video walkthrough. Beachside only. Nothing to chase until there is beachside stock worth filming — but when there is, he should be the first call.",
      rebuiltAt: daysAgo(2),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Listing enquiry — Henley Beach",
        wordingShown: consentWording,
        ip: "198.51.100.88",
        at: daysAgo(48),
      },
    ],
  },
  {
    id: "c8",
    firstName: "Rebecca",
    lastName: "Nolan",
    email: "rebecca.nolan@example.com",
    phone: "+61 400 118 552",
    suburb: "Magill",
    roles: ["buyer"],
    owner: "Sam Whitfield",
    source: "web_form",
    lastFollowupAt: daysAgo(38),
    lastFollowupOutcome: "No response to last two attempts",
    followupDueAt: daysAgo(8),
    doNotContact: false,
    createdAt: daysAgo(92),
    preferences: {
      suburbs: ["Magill", "Norwood"],
      priceMin: 650000,
      priceMax: 780000,
      bedsMin: 3,
      bathsMin: 1,
      parkingMin: 1,
      propertyTypes: ["House"],
      timeline: "Unclear",
      financeStatus: "Unknown",
      softRequirements: "Wants a shed or workshop space.",
    },
    intent: {
      type: "browsing",
      budgetBand: "$650k – $780k",
      timeline: "Unclear",
      blockers: ["Unresponsive to last two attempts"],
      sentiment: "cooling",
      confidence: 0.41,
      brief:
        "Went quiet five weeks ago after two unanswered attempts. Low confidence on everything here — the requirements are from her original enquiry in May and have not been confirmed since. Either one more attempt on a different channel, or archive her.",
      rebuiltAt: daysAgo(9),
    },
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Website contact form",
        wordingShown: consentWording,
        ip: "203.0.113.201",
        at: daysAgo(92),
      },
    ],
  },
  {
    id: "c9",
    firstName: "Marco",
    lastName: "Silveira",
    email: "marco.silveira@example.com",
    phone: "+61 435 009 771",
    suburb: "Payneham",
    roles: ["referrer"],
    owner: "Sam Whitfield",
    source: "manual",
    lastFollowupAt: daysAgo(30),
    lastFollowupOutcome: "Referred the Marchetti appraisal",
    followupDueAt: null,
    doNotContact: false,
    createdAt: daysAgo(400),
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Agency agreement, 2025 sale",
        wordingShown: consentWording,
        ip: "203.0.113.18",
        at: daysAgo(400),
      },
    ],
  },
  {
    id: "c10",
    firstName: "Priya",
    lastName: "Ramann",
    email: "p.raman@example.com",
    phone: "+61 412 004 118",
    suburb: "Norwood",
    roles: ["buyer"],
    owner: "Sam Whitfield",
    source: "social",
    lastFollowupAt: daysAgo(3),
    lastFollowupOutcome: "Enquired via Instagram about Powell St",
    followupDueAt: daysAgo(0),
    doNotContact: false,
    createdAt: daysAgo(3),
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Instagram enquiry",
        wordingShown: consentWording,
        ip: "203.0.113.44",
        at: daysAgo(3),
      },
    ],
  },
  {
    id: "c11",
    firstName: "Janine",
    lastName: "Cole",
    email: "janine.cole@example.com",
    phone: "+61 407 662 001",
    suburb: "Modbury",
    roles: ["tenant"],
    owner: "Sam Whitfield",
    source: "web_form",
    lastFollowupAt: daysAgo(7),
    lastFollowupOutcome: "Missed the open, asked for a private viewing",
    followupDueAt: daysAgo(1),
    doNotContact: false,
    createdAt: daysAgo(7),
    consents: [
      {
        channel: "email",
        status: "granted",
        sourceForm: "Rental enquiry — 8 Weerana Road",
        wordingShown: consentWording,
        ip: "198.51.100.140",
        at: daysAgo(7),
      },
      {
        channel: "sms",
        status: "granted",
        sourceForm: "Rental enquiry — 8 Weerana Road",
        wordingShown: consentWording,
        ip: "198.51.100.140",
        at: daysAgo(7),
      },
    ],
  },
  {
    id: "c12",
    firstName: "Alan",
    lastName: "Pryce",
    email: "alan.pryce@example.com",
    phone: "+61 418 330 992",
    suburb: "Brighton",
    roles: ["vendor"],
    owner: "Sam Whitfield",
    source: "phone",
    lastFollowupAt: daysAgo(45),
    lastFollowupOutcome: "Withdrew the listing, will revisit in spring",
    followupDueAt: daysAgo(-25),
    doNotContact: true,
    createdAt: daysAgo(160),
    consents: [
      {
        channel: "email",
        status: "revoked",
        sourceForm: "Requested no further contact by phone",
        wordingShown: consentWording,
        ip: "203.0.113.62",
        at: daysAgo(45),
      },
    ],
  },
];

export const contactById = (id: string) => contacts.find((c) => c.id === id);
export const contactName = (id: string) => {
  const c = contactById(id);
  return c ? `${c.firstName} ${c.lastName}` : "Unknown";
};

/* ---------------------------------------------------------- interactions */

export const interactions: Interaction[] = [
  {
    id: "i1",
    contactId: "c1",
    channel: "web_form",
    direction: "in",
    at: hoursAgo(3),
    subject: "Enquiry — 12 Powell Street",
    body: "Hi, is the Powell St place still available? We're pre-approved and could move quickly. Also — how busy is that street at school pick-up time?",
    hasRaw: true,
    listingId: "l3",
  },
  {
    id: "i2",
    contactId: "c5",
    channel: "email",
    direction: "in",
    at: hoursAgo(5),
    subject: "Re: Application — 8 Weerana Road",
    body: "Just following up on the application. Has the owner said anything about the cat? It's the one thing I need to know before I keep looking elsewhere.",
    hasRaw: true,
    listingId: "l1",
  },
  {
    id: "i3",
    contactId: "c3",
    channel: "phone",
    direction: "out",
    at: hoursAgo(22),
    subject: "Appraisal booking",
    body: "Called to confirm Thursday 2pm. She asked again what the marketing spend would look like — said she is also speaking to one other agency.",
    hasRaw: false,
  },
  {
    id: "i4",
    contactId: "c10",
    channel: "social",
    direction: "in",
    at: daysAgo(3),
    subject: "Instagram DM",
    body: "hi! saw the powell st listing, is it still going? whats the price guide",
    hasRaw: true,
    listingId: "l3",
  },
  {
    id: "i5",
    contactId: "c11",
    channel: "web_form",
    direction: "in",
    at: daysAgo(7),
    subject: "Rental enquiry — 8 Weerana Road",
    body: "I missed Saturday's open. Is there any chance of a private viewing this week? I work weekends.",
    hasRaw: true,
    listingId: "l1",
  },
  {
    id: "i6",
    contactId: "c2",
    channel: "email",
    direction: "in",
    at: daysAgo(9),
    subject: "Rental yields — Salisbury and Modbury",
    body: "Could you send through what the current gross yields look like for the Salisbury and Modbury stock you mentioned? Happy to move if the numbers stack up.",
    hasRaw: true,
  },
  {
    id: "i7",
    contactId: "c1",
    channel: "sms",
    direction: "out",
    at: daysAgo(2),
    subject: "SMS",
    body: "Hi Priya — Powell St open is Saturday 11:00-11:30 if you'd like another look. Sam, Ozi Realty.",
    hasRaw: false,
    listingId: "l3",
  },
  {
    id: "i8",
    contactId: "c6",
    channel: "email",
    direction: "out",
    at: daysAgo(6),
    subject: "Fortnightly update — Greenacres campaign",
    body: "Week three: 412 views, 9 enquiries, 6 groups through Saturday's open. Two second inspections booked.",
    hasRaw: true,
    listingId: "l4",
  },
  {
    id: "i9",
    contactId: "c7",
    channel: "email",
    direction: "in",
    at: daysAgo(15),
    subject: "Beachside — anything coming up?",
    body: "I'm overseas until September but still very interested. If anything beachside comes up, a video walkthrough is enough for me to act on.",
    hasRaw: true,
  },
  {
    id: "i10",
    contactId: "c1",
    channel: "voice_note",
    direction: "out",
    at: hoursAgo(2),
    subject: "Voice note after inspection",
    body: "Just showed Priya through Powell Street again. She loves it but wants to know about the Payneham unit first — need to get her an appraisal on that this week, and check whether the vendor would consider a longer settlement.",
    hasRaw: true,
  },
];

export const interactionsFor = (contactId: string) =>
  interactions
    .filter((i) => i.contactId === contactId)
    .sort((a, b) => b.at.getTime() - a.at.getTime());

/* ------------------------------------------------------------ properties */

export const properties: PropertyRecord[] = [
  {
    id: "p1",
    address: "8 Weerana Road",
    suburb: "Greenacres",
    postcode: "5086",
    state: "SA",
    type: "House",
    beds: 3,
    baths: 1,
    parking: 2,
    landSqm: 620,
    floorSqm: 132,
    yearBuilt: 1968,
    condition: "Good — kitchen updated 2021",
    features: ["Split system", "Carport", "Garden shed", "Solar 5kW"],
    ownerContactId: "c6",
    internalNotes:
      "Owner will not consider pets without meeting the tenant first. Prefers a 12-month lease.",
    internalPriceExpectation: "$540–560 per week; would accept $520 for the right tenant",
    gnafPid: null,
    lat: null,
    lng: null,
  },
  {
    id: "p2",
    address: "11 Berry Fry Avenue",
    suburb: "Modbury",
    postcode: "5092",
    state: "SA",
    type: "House",
    beds: 4,
    baths: 2,
    parking: 2,
    landSqm: 710,
    floorSqm: 178,
    yearBuilt: 1994,
    condition: "Very good",
    features: ["Ducted reverse cycle", "Double garage", "Rumpus", "Established garden"],
    ownerContactId: "c9",
    internalNotes:
      "Vendor is a past client via Marco. Motivated but not distressed — will not go below 720.",
    internalPriceExpectation: "Hoping for $760k, will take $730k",
    gnafPid: null,
    lat: null,
    lng: null,
  },
  {
    id: "p3",
    address: "12 Powell Street",
    suburb: "Norwood",
    postcode: "5067",
    state: "SA",
    type: "House",
    beds: 3,
    baths: 2,
    parking: 1,
    landSqm: 430,
    floorSqm: 149,
    yearBuilt: 1925,
    condition: "Renovated 2019, character retained",
    features: [
      "Return verandah",
      "Original fireplaces",
      "North-facing rear",
      "Quiet street",
    ],
    ownerContactId: "c9",
    internalNotes:
      "Deceased estate. Two beneficiaries, both want a quick clean sale. Some flexibility on settlement length.",
    internalPriceExpectation: "$790k–830k",
    gnafPid: null,
    lat: null,
    lng: null,
  },
  {
    id: "p4",
    address: "3 Marden Terrace",
    suburb: "Greenacres",
    postcode: "5086",
    state: "SA",
    type: "House",
    beds: 4,
    baths: 2,
    parking: 2,
    landSqm: 680,
    floorSqm: 190,
    yearBuilt: 2003,
    condition: "Excellent",
    features: ["Solar 6.6kW", "Alfresco", "Walk-in robe", "Double garage"],
    ownerContactId: "c6",
    internalNotes: "Owner wants a fortnightly update, every fortnight, without fail.",
    internalPriceExpectation: "$820k target",
    gnafPid: null,
    lat: null,
    lng: null,
  },
  {
    id: "p5",
    address: "27 Seaview Road",
    suburb: "Henley Beach",
    postcode: "5022",
    state: "SA",
    type: "Townhouse",
    beds: 3,
    baths: 2,
    parking: 1,
    landSqm: 210,
    floorSqm: 155,
    yearBuilt: 2016,
    condition: "As new",
    features: ["Roof terrace", "300m to beach", "Euro laundry"],
    ownerContactId: "c12",
    internalNotes: "Withdrawn in July. Owner asked for no contact until spring.",
    internalPriceExpectation: "$980k, would not move on it",
    gnafPid: null,
    lat: null,
    lng: null,
  },
  {
    id: "p6",
    address: "5 Culvert Street",
    suburb: "Prospect",
    postcode: "5082",
    state: "SA",
    type: "Unit",
    beds: 2,
    baths: 1,
    parking: 1,
    landSqm: 0,
    floorSqm: 88,
    yearBuilt: 1979,
    condition: "Fair — original bathroom",
    features: ["Courtyard", "Group of 6", "Low strata"],
    ownerContactId: "c9",
    internalNotes: "Investor stock. Currently tenanted at $420pw until November.",
    internalPriceExpectation: "$470k–495k",
    gnafPid: null,
    lat: null,
    lng: null,
  },
];

export const propertyById = (id: string) => properties.find((p) => p.id === id);

/* -------------------------------------------------------------- listings */

export const listings: Listing[] = [
  {
    id: "l1",
    propertyId: "p1",
    type: "rent",
    method: "Private treaty",
    status: "live",
    priceDisplay: "$550 per week",
    searchMin: 550,
    searchMax: 550,
    rentPw: 550,
    headline: "Updated three-bedroom with solar, walk to Northgate",
    copy: "A well-kept three-bedroom home on a generous 620sqm block, with an updated kitchen, split-system heating and cooling, and a 5kW solar system that keeps the running costs down. Carport plus a garden shed, and an established rear garden with room for a trampoline.",
    slug: "8-weerana-road-greenacres-sa-5086-1041",
    photos: 14,
    hasFloorplan: true,
    listedAt: daysAgo(16),
    publishedAt: daysAgo(16),
    views7d: 288,
    enquiries7d: 7,
  },
  {
    id: "l2",
    propertyId: "p2",
    type: "sale",
    method: "Private treaty",
    status: "under_offer",
    priceDisplay: "Offers above $730,000",
    searchMin: 730000,
    searchMax: 790000,
    headline: "Four bedrooms, two living areas, walk to Tea Tree Plaza",
    copy: "A generous family home on 710sqm with two separate living areas, ducted reverse-cycle throughout and a double garage under the main roof. The rumpus at the rear opens to an established garden.",
    slug: "11-berry-fry-avenue-modbury-sa-5092-1042",
    photos: 22,
    hasFloorplan: true,
    listedAt: daysAgo(41),
    publishedAt: daysAgo(41),
    views7d: 96,
    enquiries7d: 1,
  },
  {
    id: "l3",
    propertyId: "p3",
    type: "sale",
    method: "Private treaty",
    status: "live",
    priceDisplay: "Offers above $795,000",
    searchMin: 795000,
    searchMax: 850000,
    headline: "Renovated character home on one of Norwood's quiet streets",
    copy: "Behind a return verandah sits a 1925 home that has kept every bit of its character — original fireplaces, high ceilings, wide hallway — while gaining a 2019 kitchen and second bathroom. The rear faces north, so the living space holds light all afternoon. A genuinely quiet street, a short walk from The Parade.",
    slug: "12-powell-street-norwood-sa-5067-1043",
    photos: 26,
    hasFloorplan: true,
    listedAt: daysAgo(12),
    publishedAt: daysAgo(12),
    views7d: 1140,
    enquiries7d: 14,
  },
  {
    id: "l4",
    propertyId: "p4",
    type: "sale",
    method: "Private treaty",
    status: "live",
    priceDisplay: "Contact agent",
    searchMin: 780000,
    searchMax: 860000,
    headline: "Four-bedroom family home with solar and alfresco",
    copy: "Built in 2003 and immaculately kept, with four bedrooms, a main bathroom plus ensuite, and an alfresco area that runs the width of the house. 6.6kW of solar and a double garage.",
    slug: "3-marden-terrace-greenacres-sa-5086-1044",
    photos: 19,
    hasFloorplan: false,
    listedAt: daysAgo(22),
    publishedAt: daysAgo(22),
    views7d: 412,
    enquiries7d: 9,
  },
  {
    id: "l5",
    propertyId: "p6",
    type: "sale",
    method: "Private treaty",
    status: "draft",
    priceDisplay: "",
    searchMin: 470000,
    searchMax: 495000,
    headline: "Two-bedroom unit in a group of six, tenanted to November",
    copy: "",
    slug: "5-culvert-street-prospect-sa-5082-1045",
    photos: 0,
    hasFloorplan: false,
    listedAt: daysAgo(2),
    publishedAt: null,
    views7d: 0,
    enquiries7d: 0,
  },
  {
    id: "l6",
    propertyId: "p5",
    type: "sale",
    method: "Private treaty",
    status: "withdrawn",
    priceDisplay: "$980,000",
    searchMin: 980000,
    searchMax: 980000,
    headline: "Beachside townhouse with roof terrace, 300m to the sand",
    copy: "Three bedrooms over two levels with a roof terrace that catches the westerly light, three hundred metres from Henley Beach.",
    slug: "27-seaview-road-henley-beach-sa-5022-1046",
    photos: 17,
    hasFloorplan: true,
    listedAt: daysAgo(120),
    publishedAt: daysAgo(120),
    views7d: 0,
    enquiries7d: 0,
  },
  {
    id: "l7",
    propertyId: "p3",
    type: "sale",
    method: "Private treaty",
    status: "sold",
    priceDisplay: "Offers above $610,000",
    searchMin: 610000,
    searchMax: 650000,
    headline: "Character home in Norwood, first time offered in 40 years",
    copy: "Sold in 2019 before the renovation.",
    slug: "12-powell-street-norwood-sa-5067-0871",
    photos: 12,
    hasFloorplan: false,
    listedAt: daysAgo(2540),
    publishedAt: daysAgo(2540),
    soldAt: daysAgo(2490),
    resultDisplay: "Sold $648,000",
    views7d: 0,
    enquiries7d: 0,
  },
];

export const listingById = (id: string) => listings.find((l) => l.id === id);
export const listingsForProperty = (propertyId: string) =>
  listings
    .filter((l) => l.propertyId === propertyId)
    .sort((a, b) => b.listedAt.getTime() - a.listedAt.getTime());

export const listingAddress = (l: Listing) => {
  const p = propertyById(l.propertyId);
  return p ? `${p.address}, ${p.suburb}` : "Unknown";
};

export const statusLabel: Record<ListingStatus, string> = {
  draft: "Draft",
  live: "Live",
  under_offer: "Under offer",
  sold: "Sold",
  leased: "Leased",
  withdrawn: "Withdrawn",
};

/* ----------------------------------------------------------- inspections */

export const inspections: Inspection[] = [
  {
    id: "n1",
    listingId: "l3",
    startsAt: daysAgo(-2),
    minutes: 30,
    kind: "open",
    registrations: 11,
  },
  {
    id: "n2",
    listingId: "l4",
    startsAt: daysAgo(-2),
    minutes: 30,
    kind: "open",
    registrations: 4,
  },
  {
    id: "n3",
    listingId: "l1",
    startsAt: daysAgo(-1),
    minutes: 15,
    kind: "private",
    registrations: 1,
  },
  {
    id: "n4",
    listingId: "l3",
    startsAt: daysAgo(-5),
    minutes: 30,
    kind: "open",
    registrations: 0,
  },
];

/* --------------------------------------------------------------- matches */

export const matches: Match[] = [
  {
    listingId: "l3",
    contactId: "c1",
    score: 0.94,
    stage: "ranked",
    reason:
      "Norwood, three bedrooms and north-facing at the rear — she asked specifically for a quiet street away from a main road, and Powell Street is exactly that.",
  },
  {
    listingId: "l3",
    contactId: "c8",
    score: 0.71,
    stage: "ranked",
    reason:
      "In her suburb list and close to her stated ceiling, though it is $15k above and there is no shed — worth a call rather than a campaign email.",
  },
  {
    listingId: "l4",
    contactId: "c1",
    score: 0.68,
    stage: "vector",
    reason:
      "Four bedrooms and solar suit the brief, but Greenacres is outside the suburbs she named.",
  },
  {
    listingId: "l1",
    contactId: "c5",
    score: 0.91,
    stage: "ranked",
    reason:
      "Two-plus bedrooms in her range, walkable to the UniSA campus, and she has already applied — the only open item is the owner's decision on the cat.",
  },
  {
    listingId: "l1",
    contactId: "c11",
    score: 0.83,
    stage: "ranked",
    reason:
      "Enquired about this exact property and missed the open — a private viewing would close the loop.",
  },
  {
    listingId: "l5",
    contactId: "c2",
    score: 0.88,
    stage: "ranked",
    reason:
      "Prospect is his first-choice suburb, it is tenanted to November at $420pw, and he is buying purely on yield — this is the closest thing in stock to his brief.",
  },
  {
    listingId: "l6",
    contactId: "c7",
    score: 0.86,
    stage: "ranked",
    reason:
      "Beachside townhouse 300m from the sand, inside his cash range — but the listing is withdrawn until spring, so this is a spring conversation.",
  },
  {
    listingId: "l2",
    contactId: "c8",
    score: 0.52,
    stage: "vector",
    reason:
      "Four bedrooms with a large garden, but Modbury is not in her suburbs and it is above her ceiling.",
  },
];

export const matchesForListing = (listingId: string) =>
  matches.filter((m) => m.listingId === listingId).sort((a, b) => b.score - a.score);
export const matchesForContact = (contactId: string) =>
  matches.filter((m) => m.contactId === contactId).sort((a, b) => b.score - a.score);

/* -------------------------------------------------------------- approvals */

export const approvals: ApprovalItem[] = [
  {
    id: "a1",
    kind: "sms",
    status: "pending",
    contactId: "c1",
    listingId: "l3",
    subject: "SMS — second inspection at Powell St",
    body: "Hi Priya, there's a private inspection slot at 12 Powell St on Thursday 5:30pm if you'd like another look before deciding. Reply YES and I'll lock it in. Sam, Ozi Realty. Reply STOP to opt out.",
    createdAt: hoursAgo(1),
    consentAtDraft: "granted",
    consentNow: "granted",
    model: "Sonnet",
    costAud: 0.021,
  },
  {
    id: "a2",
    kind: "email",
    status: "pending",
    contactId: "c2",
    subject: "The rental yield figures you asked for",
    body: "Hi Daniel,\n\nApologies for the delay getting these to you. Gross yields on the stock we discussed:\n\n· Prospect (2br unit, tenanted to November): 4.6% at the current $420pw\n· Modbury (3br house): 4.1%\n· Salisbury (3br house): 5.0%\n\nThe Prospect unit is the pick on numbers — it comes with a tenant in place, so there's no vacancy gap.\n\nHappy to walk through any of these.\n\nSam Whitfield\nOzi Realty · RLA 123456\nUnsubscribe",
    createdAt: hoursAgo(4),
    consentAtDraft: "granted",
    consentNow: "granted",
    model: "Sonnet",
    costAud: 0.038,
  },
  {
    id: "a3",
    kind: "email",
    status: "blocked",
    contactId: "c4",
    listingId: "l3",
    subject: "New character listing in Norwood",
    body: "Hi Tom,\n\nA renovated 1925 character home has just come up in Norwood — return verandah, original fireplaces, north-facing rear...",
    createdAt: daysAgo(1),
    consentAtDraft: "granted",
    consentNow: "revoked",
    blockReason:
      "Email consent was revoked 21 days ago via the campaign #41 unsubscribe link. The draft was written before that was picked up. SMS consent is still current.",
    model: "Sonnet",
    costAud: 0.029,
  },
  {
    id: "a4",
    kind: "digest",
    status: "pending",
    listingId: "l4",
    subject: "Fortnightly vendor update — 3 Marden Terrace",
    body: "Hi Geoff,\n\nWeek four of the Marden Terrace campaign:\n\n· 412 views on the listing this week, down slightly from 486\n· 9 enquiries, 6 groups through Saturday's open\n· 2 second inspections booked for this weekend\n\nThe drop in views is normal at this point in a campaign. The second inspections are the number that matters and both groups are genuine.\n\nSam",
    createdAt: hoursAgo(12),
    consentAtDraft: "granted",
    consentNow: "granted",
    model: "Sonnet",
    costAud: 0.031,
  },
  {
    id: "a5",
    kind: "social",
    status: "pending",
    listingId: "l3",
    subject: "Instagram post — 12 Powell Street open home",
    body: "Quiet street, character intact, north-facing rear. 12 Powell Street, Norwood is open Saturday 11:00–11:30. Three bedrooms, two bathrooms, and a 2019 kitchen behind a 1925 return verandah. Offers above $795,000. RLA 123456",
    createdAt: hoursAgo(18),
    consentAtDraft: "granted",
    consentNow: "granted",
    model: "Sonnet",
    costAud: 0.018,
  },
  {
    id: "a6",
    kind: "article",
    status: "pending",
    subject: "Blog draft — What a north-facing rear actually does for a house",
    body: "Every listing in Adelaide seems to mention aspect, and most buyers nod along without knowing what it changes. Here is what it actually means for the room you spend the most time in...",
    createdAt: daysAgo(1),
    consentAtDraft: "granted",
    consentNow: "granted",
    model: "Sonnet",
    costAud: 0.092,
  },
  {
    id: "a7",
    kind: "email",
    status: "sent",
    contactId: "c6",
    listingId: "l4",
    subject: "Fortnightly update — Greenacres campaign",
    body: "Week three: 412 views, 9 enquiries, 6 groups through Saturday's open.",
    createdAt: daysAgo(6),
    consentAtDraft: "granted",
    consentNow: "granted",
    reviewedBy: "Sam Whitfield",
    reviewedAt: daysAgo(6),
    model: "Sonnet",
    costAud: 0.03,
  },
  {
    id: "a8",
    kind: "sms",
    status: "rejected",
    contactId: "c8",
    subject: "SMS — checking in",
    body: "Hi Rebecca, just checking in to see if you're still looking?",
    createdAt: daysAgo(4),
    consentAtDraft: "granted",
    consentNow: "granted",
    rejectReason: "Too generic after two unanswered attempts — needs a specific property to be worth sending.",
    reviewedBy: "Sam Whitfield",
    reviewedAt: daysAgo(4),
    model: "Haiku",
    costAud: 0.004,
  },
];

export const pendingApprovals = approvals.filter((a) => a.status === "pending");
export const blockedApprovals = approvals.filter((a) => a.status === "blocked");

export const approvalKindLabel: Record<ApprovalKind, string> = {
  email: "Email",
  sms: "SMS",
  social: "Social",
  article: "Article",
  proposal: "Proposal",
  digest: "Vendor update",
};

/* ---------------------------------------------------------- confirm queue */

export const confirmItems: ConfirmItem[] = [
  {
    id: "f1",
    kind: "task",
    contactId: "c1",
    sourceInteractionId: "i10",
    summary: "Book an appraisal on the Payneham unit",
    after: "Task — Appraise Priya Raman's Payneham unit · due Friday 22 Aug",
    confidence: 0.91,
    createdAt: hoursAgo(2),
  },
  {
    id: "f2",
    kind: "task",
    contactId: "c1",
    sourceInteractionId: "i10",
    summary: "Ask the Powell St vendor about a longer settlement",
    after: "Task — Check settlement flexibility with the Powell St beneficiaries · due Thursday 21 Aug",
    confidence: 0.84,
    createdAt: hoursAgo(2),
  },
  {
    id: "f3",
    kind: "task",
    contactId: "c5",
    sourceInteractionId: "i2",
    summary: "Ask the Weerana Rd owner about the cat",
    after: "Task — Get a pet decision from Geoff Pentland on 8 Weerana Rd · due today",
    confidence: 0.95,
    createdAt: hoursAgo(5),
  },
  {
    id: "f4",
    kind: "preference_change",
    contactId: "c1",
    sourceInteractionId: "i1",
    summary: "Add a school-proximity requirement",
    before: "Quiet street, definitely not on a main road. Wants a north-facing back yard.",
    after: "Quiet street, definitely not on a main road. Wants a north-facing back yard and a school within walking distance.",
    confidence: 0.77,
    createdAt: hoursAgo(3),
  },
  {
    id: "f5",
    kind: "intent_correction",
    contactId: "c2",
    sourceInteractionId: "i6",
    summary: "Downgrade sentiment — request unanswered for 9 days",
    before: "Sentiment: warm · confidence 0.78",
    after: "Sentiment: cooling · confidence 0.64 · blocker added: waiting on yield data we owe him",
    confidence: 0.82,
    createdAt: daysAgo(1),
  },
];

export const mergeReviews: MergeReview[] = [
  {
    id: "m1",
    aId: "c1",
    bId: "c10",
    similarity: 0.93,
    matchedOn: "Identical phone number (+61 412 004 118), similar name, same suburb. Emails differ.",
    createdAt: daysAgo(3),
  },
];

/* ----------------------------------------------------------------- tasks */

export const tasks: Task[] = [
  {
    id: "t1",
    contactId: "c5",
    title: "Get a pet decision from the Weerana Rd owner",
    dueAt: daysAgo(0),
    done: false,
    source: "Voice note, 20 Aug",
  },
  {
    id: "t2",
    contactId: "c2",
    title: "Send the rental yield figures (9 days overdue)",
    dueAt: daysAgo(8),
    done: false,
    source: "Email, 11 Aug",
  },
  {
    id: "t3",
    contactId: "c3",
    title: "Prepare the Glenelg appraisal pack — lead with marketing spend",
    dueAt: daysAgo(-1),
    done: false,
    source: "Phone call, 19 Aug",
  },
  {
    id: "t4",
    contactId: "c11",
    title: "Offer Janine a private viewing at Weerana Rd",
    dueAt: daysAgo(1),
    done: false,
    source: "Web form, 13 Aug",
  },
  {
    id: "t5",
    contactId: "c6",
    title: "Fortnightly vendor update — Marden Terrace",
    dueAt: daysAgo(-1),
    done: false,
    source: "Repeating",
  },
  {
    id: "t6",
    contactId: "c1",
    title: "Confirm Saturday inspection time",
    dueAt: daysAgo(2),
    done: true,
    source: "SMS, 18 Aug",
  },
];

/* ------------------------------------------------------------- AI costs */

export const aiGenerations: AiGeneration[] = [
  {
    task: "Summarise interaction",
    model: "Haiku",
    calls: 412,
    inputTokens: 386_000,
    outputTokens: 41_000,
    costAud: 0.71,
    avgLatencyMs: 780,
  },
  {
    task: "Rebuild contact brief",
    model: "Sonnet",
    calls: 96,
    inputTokens: 512_000,
    outputTokens: 74_000,
    costAud: 4.62,
    avgLatencyMs: 3100,
  },
  {
    task: "Extract tasks from voice",
    model: "Haiku",
    calls: 38,
    inputTokens: 44_000,
    outputTokens: 6_200,
    costAud: 0.09,
    avgLatencyMs: 640,
  },
  {
    task: "Rank matches + write reasons",
    model: "Sonnet",
    calls: 54,
    inputTokens: 298_000,
    outputTokens: 39_000,
    costAud: 2.68,
    avgLatencyMs: 4200,
  },
  {
    task: "Draft outbound message",
    model: "Sonnet",
    calls: 61,
    inputTokens: 210_000,
    outputTokens: 52_000,
    costAud: 2.31,
    avgLatencyMs: 3600,
  },
  {
    task: "Classify inbound channel",
    model: "Haiku",
    calls: 508,
    inputTokens: 190_000,
    outputTokens: 9_000,
    costAud: 0.33,
    avgLatencyMs: 410,
  },
];

export const costByDay = [
  { day: "Thu", aud: 1.22 },
  { day: "Fri", aud: 1.64 },
  { day: "Sat", aud: 2.31 },
  { day: "Sun", aud: 0.48 },
  { day: "Mon", aud: 1.87 },
  { day: "Tue", aud: 2.05 },
  { day: "Wed", aud: 1.17 },
];

/* --------------------------------------------------------------- ops */

export const jobQueue = [
  { name: "SummariseInteraction", pending: 2, active: 1, failed: 0, dead: 0 },
  { name: "RebuildContactIntent", pending: 0, active: 0, failed: 0, dead: 0 },
  { name: "Transcribe", pending: 1, active: 0, failed: 0, dead: 0 },
  { name: "MatchContacts", pending: 0, active: 0, failed: 1, dead: 0 },
  { name: "EmbedListing", pending: 0, active: 0, failed: 0, dead: 0 },
  { name: "DailyBrief", pending: 0, active: 0, failed: 0, dead: 1 },
];

export const adapters = [
  { name: "Website forms", status: "ok", lastReceived: hoursAgo(3), today: 4 },
  { name: "Email (SES)", status: "ok", lastReceived: hoursAgo(5), today: 11 },
  { name: "SMS (MessageMedia)", status: "ok", lastReceived: hoursAgo(26), today: 0 },
  { name: "Social DMs", status: "degraded", lastReceived: daysAgo(3), today: 0 },
  { name: "Manual entry", status: "ok", lastReceived: hoursAgo(22), today: 2 },
];

/* -------------------------------------------------- compliance advisor */

export const complianceExample = {
  question: "When does a Form 1 have to be served on a buyer in South Australia?",
  jurisdiction: "South Australia",
  answer:
    "A vendor's statement (Form 1) must be served on the purchaser before the contract becomes binding, and the cooling-off period runs from the later of the contract being made or the Form 1 being served. Where the property is sold at auction, different timing applies — the Form 1 must be available for inspection at the auction site.\n\nThis is research support and not a legal ruling. Confirm the current position with a licensee or solicitor before relying on it, particularly where an auction is involved.",
  citations: [
    {
      instrument: "Land and Business (Sale and Conveyancing) Act 1994 (SA)",
      section: "s 7 — Vendor's statement",
      versionDate: "Version in force 1 July 2026",
    },
    {
      instrument: "Land and Business (Sale and Conveyancing) Act 1994 (SA)",
      section: "s 5 — Cooling-off rights",
      versionDate: "Version in force 1 July 2026",
    },
    {
      instrument: "Land and Business (Sale and Conveyancing) Regulations 2010 (SA)",
      section: "reg 9 — Prescribed particulars",
      versionDate: "Version in force 12 March 2026",
    },
  ],
  retrieval: {
    jurisdictionFiltered: 1284,
    exactHits: 18,
    meaningHits: 22,
    afterMerge: 31,
    afterRerank: 8,
  },
};

export const complianceEmptyExample = {
  question: "What is the stamp duty rate for commercial property in Queensland?",
  jurisdiction: "South Australia",
};

/* -------------------------------------------------------------- derived */

export const followupsDue = contacts
  .filter((c) => c.followupDueAt !== null && !c.doNotContact)
  .filter((c) => (c.followupDueAt as Date).getTime() <= Date.now() + 86400000)
  .sort(
    (a, b) => (a.followupDueAt as Date).getTime() - (b.followupDueAt as Date).getTime(),
  );

export const newEnquiries = interactions
  .filter((i) => i.direction === "in")
  .sort((a, b) => b.at.getTime() - a.at.getTime())
  .slice(0, 6);

export const totalMonthCost = aiGenerations.reduce((s, g) => s + g.costAud, 0);
export const todayCost = costByDay[costByDay.length - 1].aud;

export const counts = {
  approvals: pendingApprovals.length,
  blocked: blockedApprovals.length,
  confirms: confirmItems.length,
  merges: mergeReviews.length,
  contacts: contacts.length,
  liveListings: listings.filter((l) => l.status === "live").length,
  tasksOpen: tasks.filter((t) => !t.done).length,
};
