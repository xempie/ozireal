/**
 * The built-in sections of each public page, wrapped in <Fixed id> so the website
 * editor can hide them, show them again, and place blocks before or after them.
 *
 * Generated from the page files on 2026-10-07; keep in step when a page gains or
 * loses a section (an id here with no <Fixed> on the page is simply never found).
 */
export type FixedSection = { id: string; label: string };

/** Every page built on ServicePageBody shares one layout, so one list. */
export const SERVICE_SECTIONS: FixedSection[] = [
  {
    "id": "form",
    "label": "Enquiry form"
  },
  {
    "id": "benefits",
    "label": "Three benefit cards"
  },
  {
    "id": "what-you-get",
    "label": "What you get (points and sections)"
  },
  {
    "id": "pitch",
    "label": "Pitch (what waiting costs)"
  },
  {
    "id": "closing-cta",
    "label": "Closing call to action"
  }
];

const PAGES: Record<string, FixedSection[] | "service"> = {
  "/about-adelaide-land-agent": [
    {
      "id": "the-person-you-will-actually-deal-with",
      "label": "The person you will actually deal with"
    },
    {
      "id": "mission",
      "label": "Mission"
    },
    {
      "id": "what-the-agency-runs-on",
      "label": "What the agency runs on"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Your property journey starts here."
    }
  ],
  "/adelaide-property-faq": [
    {
      "id": "questions",
      "label": "The questions and answers"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Cannot find what you are looking for?"
    }
  ],
  "/book-online": [
    {
      "id": "form",
      "label": "Enquiry form (book-online)"
    },
    {
      "id": "principal",
      "label": "Principal card (Esi Dor)"
    },
    {
      "id": "what-we-cover",
      "label": "What the consultation covers"
    }
  ],
  "/buyer-agent-adelaide": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "why", "label": "Why use a buyer's agent" },
    { "id": "finance", "label": "Smart Loanz free finance chat" },
    { "id": "form", "label": "Brief form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Buyer's agent questions" }
  ],
  "/contact": [
    {
      "id": "form",
      "label": "Enquiry form (contact)"
    },
    {
      "id": "principal",
      "label": "Principal card (Esi Dor)"
    },
    {
      "id": "what-we-will-cover",
      "label": "What we will cover"
    }
  ],
  "/all-listings": [
    {
      "id": "projects-cta",
      "label": "Projects and opportunities band"
    },
    {
      "id": "listings",
      "label": "Listings and filters"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action"
    }
  ],
  "/for-sale": [
    {
      "id": "listings",
      "label": "Listings search and results"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Not seeing it? We usually know what is coming."
    }
  ],
  "/free-property-appraisal-sa": [
    {
      "id": "form",
      "label": "Enquiry form (free-property-appraisal-sa)"
    },
    {
      "id": "a-report-not-a-number",
      "label": "A report, not a number"
    }
  ],
  "/free-suburb-insight-report": [
    {
      "id": "form",
      "label": "Enquiry form (free-suburb-insight-report)"
    },
    {
      "id": "whats-in-it",
      "label": "What is in the report"
    },
    {
      "id": "also-available",
      "label": "Also available"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Unlock my suburb insights"
    }
  ],
  "/land-opportunities-sa-adelaide": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "why", "label": "Why it matters" },
    { "id": "finance", "label": "Smart Loanz land and construction finance" },
    { "id": "form", "label": "Land form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Land questions" }
  ],
  "/manage-property-adelaide": [
    { "id": "what-you-get", "label": "What you get (2.99%, care, maintenance, disputes)" },
    { "id": "plans", "label": "Four plans (Risk Shield recommended)" },
    { "id": "how-we-work", "label": "How we work (owner, compliance, trust account, REISA)" },
    { "id": "form", "label": "Enquiry form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Property management questions" }
  ],
  "/overseas-investment": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "why", "label": "Why it matters" },
    { "id": "finance", "label": "Smart Loanz: equity and borrowing power" },
    { "id": "form", "label": "Register interest form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Overseas investment questions" }
  ],
  "/property-investment": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "why", "label": "Why it matters" },
    { "id": "finance", "label": "Smart Loanz free finance chat" },
    { "id": "form", "label": "Investment form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Investment questions" }
  ],
  "/property-rental-report": "service",
  "/property-services": [
    { "id": "eight-services-one-office", "label": "Service cards (with I am… picker)" },
    { "id": "one-team-across-the-whole-journey", "label": "How we work" },
    { "id": "finance", "label": "Smart Loanz free finance chat" },
    { "id": "form", "label": "General form with Esi photo" },
    { "id": "faq", "label": "Services questions" }
  ],
  "/property-strategy-services": [
    { "id": "form", "label": "Picked report and its enquiry form" },
    { "id": "how", "label": "How it works" },
    { "id": "esi", "label": "Esi Dor card" },
    { "id": "faq", "label": "Quick questions" }
  ],
  "/rent-property-house-adelaide": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "ready", "label": "Before you apply (documents)" },
    { "id": "finance", "label": "Smart Loanz: could you buy instead?" },
    { "id": "form", "label": "Rental form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Renting questions" }
  ],
  "/sell-my-business-australia": [
    { "id": "what-you-get", "label": "What you get" },
    { "id": "how", "label": "How it works" },
    { "id": "why", "label": "Why it matters" },
    { "id": "form", "label": "Confidential form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Business sale questions" }
  ],
  "/sell-property-house-adelaide": [
    { "id": "how", "label": "How a sale runs" },
    { "id": "why", "label": "Why sell with OziRealty" },
    { "id": "report", "label": "Free appraisal report" },
    { "id": "form", "label": "Enquiry form with Esi photo" },
    { "id": "strategy", "label": "Not sure? Strategy Services" },
    { "id": "faq", "label": "Selling questions" }
  ],
  "/sold": [
    {
      "id": "results",
      "label": "Sold and leased results"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Want to know what yours is worth?"
    }
  ],
  "/suburbs": [
    {
      "id": "suburb-list",
      "label": "List of suburbs"
    },
    {
      "id": "closing-cta",
      "label": "Closing call to action: Want a written report on your suburb?"
    }
  ],
  "/": [
    {
      "id": "new-homes",
      "label": "New homes band (links to /new-homes-adelaide)"
    },
    {
      "id": "form",
      "label": "Free book form (10 truths about finding the right home)"
    },
    {
      "id": "promises",
      "label": "Promises strip (2.99%, 100 days, $399, no middle men)"
    },
    {
      "id": "listings",
      "label": "Listings: Currently advertised"
    },
    {
      "id": "reports",
      "label": "Reports: Free premium appraisal report"
    },
    {
      "id": "services",
      "label": "Services: Seven services, one office"
    },
    {
      "id": "why-us",
      "label": "Why us: Exclusive, available, flexible"
    },
    {
      "id": "partners",
      "label": "Partner logos (We work with the best)"
    },
    {
      "id": "quote",
      "label": "Testimonial quote"
    },
    {
      "id": "journal",
      "label": "Journal: Discover Australia's property market"
    },
    {
      "id": "consultation",
      "label": "Consultation: speak directly with the principal"
    }
  ]
};

export function fixedSectionsFor(path: string): FixedSection[] {
  const v = PAGES[path];
  return v === "service" ? SERVICE_SECTIONS : v ?? [];
}
