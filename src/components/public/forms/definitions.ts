/**
 * The enquiry forms, transcribed from www.ozirealty.com.au.
 *
 * Ten forms, one per service, with the agency's own questions and answer options. The
 * wording is theirs including its quirks; where the live site has a typo that would look
 * like carelessness on a new site ("Budjet", "1,500,0000") it is corrected, and where a
 * question is genuinely the agency's phrasing it is left alone.
 *
 * ## How they reach the CRM
 *
 * Every one of them posts to `/api/forms/[key]`, the Phase 1 intake endpoint, and nothing
 * else. That route already owns the hard parts: a signed token pinned by hash to the
 * consent wording that was on screen, a single-use nonce so a captured request replays
 * into a no-op, a honeypot, per-IP rate limiting, and size caps ahead of parsing. From
 * there `ingestThrough("web_form", ...)` runs the pipeline in CLAUDE.md 5: normalise,
 * resolve identity, write an `interactions` row, enqueue the summary and intent rebuild.
 *
 * ## Why the extra answers travel in `message`
 *
 * The endpoint's envelope is `.strict()` and carries firstName, lastName, email, phone,
 * message, listingRef, formName and the consent fields. Nothing else. So the
 * service-specific answers are composed into `message` as "Question: Answer" lines.
 *
 * That is a deliberate choice rather than a workaround. Widening the public write surface
 * is a schema decision with a review attached, and the composed body is not a dead end:
 * it lands verbatim in the immutable `interactions` row, it is what the agent reads on
 * the contact, and it is exactly the shape the Phase 1 extraction jobs already parse into
 * `contact_intent`. Mapping suburb, budget and timeline into `contact_preferences` as
 * structured columns is the natural follow-up and needs that decision made first.
 */

import type { contactRole } from "@/db/schema";

export type ContactRole = (typeof contactRole.enumValues)[number];

/**
 * Choice fields follow one rule (site sync guide, 2026-10-04): a single choice from five
 * or more options is a "select" dropdown, two to four is "radio", and any multi-choice is
 * "checkbox". The live site's explicit dropdowns are kept as dropdowns.
 */
export type FieldKind =
  | "text" | "email" | "tel" | "textarea" | "date" | "radio" | "checkbox" | "select";

export interface FormField {
  /** Stable id, used as the input name and as the label in the composed message. */
  id: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** radio, checkbox and select only. */
  options?: string[];
  placeholder?: string;
  /** Half-width on a wide screen. Used for the name/contact pairs. */
  half?: boolean;
}

export interface FormDefinition {
  /** Route segment this form belongs to. */
  slug: string;
  /**
   * Matches a `consent_templates.form_name` row, which is what the GET uses to serve the
   * exact marketing wording. An unknown name still renders, on the endpoint's honest
   * fallback wording, so a missing template degrades rather than breaks.
   */
  formName: string;
  title: string;
  intro?: string;
  submitLabel: string;
  fields: FormField[];
  /**
   * The role(s) a submission puts on the contact. Read by the intake SERVER-side, keyed
   * on formName, so the browser cannot choose its own role. Empty when the form cannot
   * tell (a newsletter sign-up is not evidence of buying or selling).
   */
  roles: ContactRole[];
  /**
   * For the general-purpose forms, where the role is an answer rather than the form:
   * the field whose chosen option(s) decide it, and the option → role map. Options not
   * in the map ("Something else") add nothing.
   */
  roleFrom?: { field: string; map: Record<string, ContactRole> };
}

/** Shared by the forms that ask "what is it about" with the same service options. */
const SERVICE_ROLES: Record<string, ContactRole> = {
  Selling: "vendor",
  "Renting out": "landlord",
  "Property management": "landlord",
  Buying: "buyer",
  Renting: "tenant",
  Investing: "investor",
  Land: "buyer",
  "Selling a business": "business_vendor",
};

/** The name and contact block every form opens with. */
const IDENTITY = (phoneRequired = true): FormField[] => [
  { id: "firstName", label: "First name", kind: "text", required: true, half: true },
  { id: "lastName", label: "Last name", kind: "text", required: true, half: true },
  { id: "email", label: "Email", kind: "email", required: true, half: true },
  { id: "phone", label: "Phone", kind: "tel", required: phoneRequired, half: true },
];

export const FORMS: FormDefinition[] = [
  {
    slug: "manage-property-adelaide",
    formName: "Property management enquiry",
    roles: ["landlord"],
    title: "See if you are paying too much",
    intro: "Tell us about the property and we will come back with what management would cost and what it would earn.",
    submitLabel: "See if I am paying too much",
    fields: [
      ...IDENTITY(),
      { id: "plan", label: "Select your plan", kind: "radio", required: true,
        options: ["Income Protect", "Income Optimise", "Income & Risk Shield", "Owner-Designed Plan"] },
      { id: "address", label: "Property address (or multiple if a portfolio)", kind: "textarea", required: true },
      { id: "situation", label: "Current situation", kind: "radio", required: true,
        options: ["Self-managed", "Managed by another agency", "New investment", "Other"] },
      { id: "concern", label: "Biggest concern", kind: "checkbox", required: true,
        options: ["Vacancy", "Tenant quality", "Fees", "Maintenance", "Other"] },
      { id: "rentalAppraisal", label: "Do you want a free rental appraisal?", kind: "radio", required: true,
        options: ["Yes", "No"] },
    ],
  },

  {
    slug: "sell-property-house-adelaide",
    formName: "Sell my property enquiry",
    roles: ["vendor"],
    title: "Start with the appraisal",
    intro: "Free, no obligation, and it shows the comparable sales it came from.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(false),
      { id: "address", label: "Property address", kind: "textarea", required: true },
      { id: "propertyType", label: "Your property type", kind: "radio",
        options: ["House", "Unit", "Townhouse", "Land"] },
      { id: "timeframe", label: "When are you planning to sell?", kind: "radio",
        options: ["1–3 months", "3–6 months", "6–12 months", "Just exploring"] },
      { id: "valuation", label: "Do you need a free property valuation?", kind: "radio", required: true,
        options: ["Yes", "No"] },
    ],
  },

  {
    slug: "rent-out-my-property-adelaide",
    formName: "Rent out my property enquiry",
    roles: ["landlord"],
    title: "Rent out your property",
    intro: "A rental appraisal, a pricing strategy, and a manager who answers the phone.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(),
      { id: "address", label: "Property address", kind: "textarea", required: true },
      { id: "propertyType", label: "Your property type", kind: "select",
        options: ["House", "Unit", "Townhouse", "Apartment", "Other"] },
      { id: "timeframe", label: "When are you planning to rent?", kind: "radio",
        options: ["1–3 months", "3–6 months", "6–12 months", "Just exploring"] },
      { id: "rentalValuation", label: "Do you need a free rental valuation?", kind: "radio",
        options: ["Yes", "No"] },
      { id: "furnished", label: "Furnished?", kind: "radio", options: ["Yes", "No"] },
    ],
  },

  {
    slug: "buyer-agent-adelaide",
    formName: "Buyer agent enquiry",
    roles: ["buyer"],
    title: "Tell us what you are looking for",
    intro: "The brief is where a buyer agent engagement starts. The more specific it is, the less of your Saturday it costs.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(false),
      { id: "suburbs", label: "What suburbs are you considering?", kind: "textarea", required: true },
      { id: "budget", label: "What is your budget?", kind: "radio", required: true,
        options: ["$400,000 to $800,000", "$800,000 to $1,000,000", "$1,000,000 to $1,500,000", "More than $1,500,000"] },
      { id: "firstHomeBuyer", label: "Are you a first-home buyer?", kind: "radio", required: true,
        options: ["Yes", "No"] },
      { id: "preApproval", label: "Do you have finance pre-approval?", kind: "radio", required: true,
        options: ["Yes", "No"] },
    ],
  },

  {
    slug: "property-investment",
    formName: "Property investment enquiry",
    roles: ["investor"],
    title: "What are you investing for?",
    intro: "Yield, growth and tax position pull in different directions. Which one leads decides the shortlist.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(),
      { id: "goal", label: "Investment goal", kind: "checkbox", required: true,
        options: ["Capital growth", "Rental yield", "Tax benefits", "Other"] },
      { id: "where", label: "Type of investment", kind: "checkbox", required: true,
        options: ["In South Australia", "Overseas"] },
      { id: "budget", label: "Budget range", kind: "radio", required: true,
        options: ["$600,000 to $800,000", "$800,000 to $1,000,000", "$1,000,000 to $1,500,000", "More than $1,500,000"] },
    ],
  },

  {
    slug: "land-opportunities-sa-adelaide",
    formName: "Land opportunities enquiry",
    roles: ["buyer"],
    title: "Looking for land",
    intro: "Tell us the area and what it is for, and we will send what is available and what is coming.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(),
      { id: "area", label: "Preferred area or suburbs", kind: "textarea", required: true },
      { id: "purpose", label: "What are you mainly looking for?", kind: "checkbox", required: true,
        options: ["Build a home later", "Investment", "Subdivision / development", "Still exploring"] },
      { id: "landSize", label: "Preferred land size", kind: "select", required: true,
        options: ["Less than 300 sqm", "300–400 sqm", "400–600 sqm", "600+ sqm", "Not sure yet"] },
      { id: "timing", label: "Timing", kind: "radio", required: true,
        options: ["Actively looking now", "3–6 months", "6–12 months", "Just researching"] },
      { id: "notes", label: "Anything else we should know?", kind: "textarea" },
    ],
  },

  {
    slug: "rent-property-house-adelaide",
    formName: "Rental enquiry",
    roles: ["tenant"],
    title: "Register your rental requirements",
    intro: "So we can tell you about the right properties before the open, rather than after.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(false),
      { id: "occupants", label: "Total number of occupants", kind: "text", required: true },
      { id: "affordability", label: "Rental affordability, per week", kind: "text", required: true, placeholder: "e.g. $550" },
      { id: "leaseLength", label: "Lease length", kind: "radio", required: true,
        options: ["6 months", "12 months", "12+ months", "Short-term"] },
      { id: "moveIn", label: "Move-in date", kind: "date", required: true },
      { id: "pets", label: "Do you have pets?", kind: "radio", required: true, options: ["Yes", "No"] },
      { id: "suburbs", label: "Preferred suburbs", kind: "textarea", required: true },
      { id: "requirements", label: "Any other requirements? (furnished, parking, accessibility)", kind: "textarea" },
    ],
  },

  {
    slug: "sell-my-business-australia",
    formName: "Sell my business enquiry",
    roles: ["business_vendor"],
    title: "Selling a business",
    intro: "Confidential. Nothing is advertised or discussed with a buyer without your say-so.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(false),
      { id: "businessName", label: "Business name", kind: "text", required: true, half: true },
      { id: "industry", label: "Industry", kind: "text", required: true, half: true },
      { id: "businessAddress", label: "Business address", kind: "textarea", required: true },
      { id: "timeframe", label: "Sale timeframe", kind: "radio", required: true,
        options: ["ASAP", "3–6 months", "6–12 months", "Exploring"] },
    ],
  },

  {
    slug: "property-services",
    formName: "General enquiry",
    roles: [],
    roleFrom: { field: "need", map: SERVICE_ROLES },
    title: "Not sure which service you need?",
    intro:
      "Describe the situation and we will point you at the right one. It is a faster route than reading eight pages to work out which applies.",
    submitLabel: "Send my enquiry",
    fields: [
      ...IDENTITY(),
      { id: "need", label: "What do you need help with?", kind: "checkbox", required: true,
        options: [
          "Selling",
          "Renting out",
          "Property management",
          "Buying",
          "Renting",
          "Investing",
          "Land",
          "Selling a business",
        ] },
      { id: "message", label: "Tell us about it", kind: "textarea", required: true,
        placeholder: "The property, the timeframe, and what you are trying to work out" },
    ],
  },

  {
    slug: "property-strategy-services",
    formName: "Property strategy enquiry",
    roles: ["investor"],
    title: "Book a strategy conversation",
    intro:
      "Bring the portfolio or the decision you are weighing. We will tell you what the data says, including when the answer is to do nothing this year.",
    submitLabel: "Request a strategy session",
    fields: [
      ...IDENTITY(),
      { id: "situation", label: "Where are you now?", kind: "radio", required: true,
        options: [
          "I own one property",
          "I own several",
          "I am about to buy my first",
          "I am deciding whether to hold or sell",
        ] },
      { id: "goal", label: "What are you trying to achieve?", kind: "checkbox", required: true,
        options: ["Grow a portfolio", "Improve rental returns", "Reduce risk", "Plan an exit", "Still working it out"] },
      { id: "properties", label: "Which properties should we look at?", kind: "textarea",
        placeholder: "Addresses or suburbs, if that is where the question sits" },
      { id: "timeframe", label: "Timeframe", kind: "radio",
        options: ["Now", "3–6 months", "6–12 months", "Just researching"] },
    ],
  },

  {
    slug: "overseas-investment",
    formName: "Dubai investment register",
    roles: ["investor"],
    title: "Register your interest",
    intro:
      "Tell us what you are investing for and when, and we will send the portfolio and the market comparison. Nothing is committed by registering.",
    submitLabel: "Register my interest",
    fields: [
      ...IDENTITY(false),
      { id: "goal", label: "Investment goal", kind: "checkbox", required: true,
        options: ["Capital growth", "Rental yield", "Tax benefits", "Other"] },
      { id: "timeframe", label: "Timeframe to invest", kind: "radio", required: true,
        options: ["0–3 months", "3–6 months", "6–12 months", "Just researching"] },
      { id: "budget", label: "Budget range", kind: "radio",
        options: ["Under $500,000", "$500,000 to $1,000,000", "$1,000,000 to $2,000,000", "More than $2,000,000"] },
      { id: "notes", label: "Anything else we should know?", kind: "textarea" },
    ],
  },

  {
    slug: "realestate-gift-adelaide",
    // The live site's "Free book & Gift party" form. It is on the gift page and on the
    // home page (FormSection slug="realestate-gift-adelaide"), one definition for both.
    formName: "Gift Party bundle",
    roles: [],
    roleFrom: {
      field: "looking",
      map: {
        "Buy a property": "buyer",
        "Sell a property": "vendor",
        "Rent a property": "tenant",
        "Investment property": "investor",
      },
    },
    title: "Free book: 10 truths about finding the right home",
    intro: "A guide to avoid common home buying traps.",
    submitLabel: "Receive the book!",
    fields: [
      ...IDENTITY(),
      { id: "looking", label: "Tell us what you're looking for?", kind: "select", required: true,
        options: ["Buy a property", "Sell a property", "Rent a property", "Investment property"] },
    ],
  },

  {
    slug: "contact",
    formName: "Website enquiry",
    roles: [],
    roleFrom: { field: "about", map: SERVICE_ROLES },
    title: "Send us a message",
    intro:
      "The office answers the phone during business hours, and this reaches the same place if it is easier.",
    submitLabel: "Send my message",
    fields: [
      ...IDENTITY(),
      { id: "about", label: "What is it about?", kind: "select", required: true,
        options: ["Selling", "Renting out", "Buying", "Renting", "Property management", "Something else"] },
      { id: "message", label: "Your message", kind: "textarea", required: true },
    ],
  },
  {
    slug: "book-online",
    formName: "Free meeting request",
    roles: [],
    roleFrom: { field: "topic", map: SERVICE_ROLES },
    title: "Request your free consultation",
    intro:
      "Tell us what it is about and when suits, and we will come back to confirm a time. This is a request rather than a confirmed booking, so nothing is held in the diary until we reply.",
    submitLabel: "Request my consultation",
    fields: [
      ...IDENTITY(),
      { id: "topic", label: "What would you like to discuss?", kind: "select", required: true,
        options: ["Selling", "Renting out", "Buying", "Investing", "Property management", "Something else"] },
      { id: "when", label: "When generally suits?", kind: "checkbox", required: true,
        options: ["Weekday morning", "Weekday afternoon", "Weekday evening", "Saturday morning"] },
      { id: "preferredDate", label: "Preferred date, if you have one", kind: "date", half: true },
      { id: "where", label: "Where", kind: "radio", required: true,
        options: ["At the office", "At my property", "Video call", "By phone"] },
      { id: "address", label: "Property address, if the meeting is about one", kind: "text" },
      { id: "notes", label: "Anything we should know beforehand?", kind: "textarea" },
    ],
  },
  {
    slug: "free-property-appraisal-sa",
    formName: "Free property appraisal",
    roles: [],
    roleFrom: {
      field: "purpose",
      map: { "Considering selling": "vendor", "Buying and comparing value": "buyer" },
    },
    title: "Request your free appraisal report",
    intro: "Valued at $399. No obligation, no pressure.",
    submitLabel: "Get my free report",
    fields: [
      ...IDENTITY(),
      { id: "address", label: "House address", kind: "textarea", required: true },
      { id: "suburb", label: "Suburb", kind: "text", required: true, half: true },
      { id: "postcode", label: "Postcode", kind: "text", required: true, half: true },
      { id: "state", label: "State", kind: "text", required: true, half: true },
      { id: "timeframe", label: "When are you considering selling?", kind: "select",
        required: true, half: true,
        options: ["1-3 months", "3-6 months", "6-12 months", "Just browsing"] },
      { id: "purpose", label: "What do you want to do?", kind: "radio", required: true,
        options: ["Considering selling", "Buying and comparing value"] },
    ],
  },

  {
    // Mirrors www.ozirealty.com.au/property-rental-report ("Property Rental
    // Estimation"), linked from the strategy page's fourth card (2026-10-04).
    slug: "property-rental-report",
    formName: "Property rental report",
    roles: ["landlord"],
    title: "Get your free rental estimation now",
    intro: "This is your information session: no commitments, no sales push.",
    submitLabel: "Submit",
    fields: [
      ...IDENTITY(),
      { id: "address", label: "Property address", kind: "textarea", required: true },
    ],
  },

  {
    slug: "free-suburb-insight-report",
    formName: "Suburb insight report",
    roles: [],
    title: "Unlock my suburb insights",
    intro: "Free, and written rather than generated from a postcode.",
    submitLabel: "Get my suburb report",
    fields: [
      ...IDENTITY(),
      { id: "reason", label: "Reason for the report", kind: "text", required: true,
        placeholder: "Buying, selling, investing or just watching" },
      { id: "address", label: "Property address or preferred suburb", kind: "textarea", required: true },
      { id: "property", label: "The property you're looking at", kind: "text", required: true },
      { id: "priceBand", label: "Which area would you prefer to explore?", kind: "select", required: true,
        options: [
          "Affordable areas (under $500k)",
          "Growth areas ($500k – $700k)",
          "Established mid-range areas ($700k – $900k)",
          "Premium suburbs ($900k – $1.2M)",
          "High-end locations ($1.2M – $2M)",
          "Prestige areas ($2M+)",
        ] },
    ],
  },
];

export const formForSlug = (slug: string) => FORMS.find((f) => f.slug === slug);
