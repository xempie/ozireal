/**
 * Copy for the standalone public pages.
 *
 * ## The URLs mirror the live Wix site on purpose
 *
 * `docs/legacy-site.md` inventories 22 indexed pages on www.ozirealty.com.au. Twenty of
 * them keep their exact slug here, so at cutover those URLs carry their ranking straight
 * across with no redirect to get wrong. That is why the paths read like
 * `/sell-property-house-adelaide` rather than `/sell`: the ugly slug is the one Google
 * already knows.
 *
 * Two are corrected, because they are misspelt at the source:
 *
 *   /oversees-investment              -> /overseas-investment
 *   /contact-adelaide-realestae-agency -> /contact
 *
 * Both old spellings 301 to the new ones in next.config.ts. Rule 6 of the redirect plan
 * is explicit that the old URL is never simply dropped.
 *
 * ## The copy is demo content
 *
 * Same standing as `demo-data.ts`: written from the supplied template and the agency's
 * existing pages, not signed off by the licensee. Nothing here states a statistic. Where
 * the template used a number it was either dropped or moved to `demo-data.ts`, which is
 * the one module carrying invented figures. Fee percentages appear because they are on
 * the live site already, and they are the first thing to check before cutover.
 */

export interface PageSection {
  heading: string;
  body: string[];
}

export interface ServicePage {
  /** Route segment, no leading slash. Mirrors the live site unless noted. */
  slug: string;
  eyebrow: string;
  /** The h1. */
  title: string;
  /** Italicised tail of the h1, rendered inside <em>. */
  titleEm?: string;
  lede: string;
  metaTitle: string;
  metaDescription: string;
  /** Unsplash id; the host is allow-listed in next.config.ts. */
  image: string;
  imageAlt: string;
  /** Short mono chips under the lede. */
  facts: string[];
  /** The numbered list, styled like the home page's appraisal report. */
  points: string[];
  sections: PageSection[];
  cta: { label: string; href: string };
}

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "sell-property-house-adelaide",
    eyebrow: "Selling",
    title: "Selling your home,",
    titleEm: "street by street",
    lede: "A campaign built around your street, not a template. We price from comparable sales you can read yourself, and we tell you what we think before you have signed anything.",
    metaTitle: "Sell your property in Adelaide",
    metaDescription:
      "Sell your Adelaide home with an agent who has walked the street. Auction or private treaty, written buyer reports every week, and no fee if it does not sell.",
    image: "photo-1600596542815-ffad4c1539a9",
    imageAlt: "White rendered home under a blue sky",
    facts: ["Auction or private treaty", "No fee if unsold", "Written weekly reporting"],
    points: [
      "An appraisal that shows its working, with the comparable sales it came from",
      "Photography shot in the light your house actually gets, not a template package",
      "A written buyer report every Monday, including the feedback you would rather not hear",
      "One agent from the first appraisal to settlement, so you are never handed on",
    ],
    sections: [
      {
        heading: "Pricing you can check yourself",
        body: [
          "An appraisal is only useful if you can see how it was reached. Ours lists the comparable sales behind the range, with the dates and the addresses, so you can drive past them.",
          "If we think the number you have been quoted elsewhere is optimistic, we will say so at the appraisal rather than three weeks into a campaign. Overquoting to win a listing is the most common way a sale goes badly, and it costs the vendor, not the agent.",
        ],
      },
      {
        heading: "Auction or private treaty",
        body: [
          "Both work. Which one suits depends on the property, the street and how much competition we expect, and that is a conversation rather than an agency policy.",
          "Whichever you choose, the campaign runs to a written plan with dates on it, and you get the buyer feedback in full.",
        ],
      },
    ],
    cta: { label: "Book a free appraisal", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "manage-property-adelaide",
    eyebrow: "Property management",
    title: "Management from",
    titleEm: "2.99%",
    lede: "One manager looks after your property from the first advert to the final bond release, so you will always know their name.",
    metaTitle: "Property management in Adelaide",
    metaDescription:
      "Adelaide property management from 2.99%, capped, with no letting or admin add-ons. Routine inspections with photographs attached to every report.",
    image: "photo-1605146769289-440113cc3d00",
    imageAlt: "Grey and white contemporary home",
    facts: ["From 2.99%, capped", "100-day trial", "Photographs on every report"],
    points: [
      "A capped fee, with no letting fee, no admin fee and no statement fee bolted on",
      "Routine inspections with photographs attached, not a tick-box summary",
      "One named manager, reachable directly, rather than a shared inbox",
      "Arrears chased the day they happen, not at the end of the month",
    ],
    sections: [
      {
        heading: "What the fee actually covers",
        body: [
          "The percentage is the whole fee. Letting, re-letting, routine inspections, statements, end of financial year summaries and tribunal attendance are inside it.",
          "The add-ons are where management pricing usually stops being comparable between agencies, which is why ours are not there. Ask any agency you are comparing us against for their fee including every charge for a full year.",
        ],
      },
      {
        heading: "The hundred day trial",
        body: [
          "If the service is not what we described, leave inside a hundred days and pay nothing for the management we have done.",
          "We would rather carry that risk than write a management agreement you cannot get out of.",
        ],
      },
    ],
    cta: { label: "Get a rent estimate", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "rent-property-house-adelaide",
    eyebrow: "Renting",
    title: "Renting in",
    titleEm: "Adelaide",
    lede: "Every property we advertise, with inspection times you can actually attend and an application process that tells you where you stand.",
    metaTitle: "Rental properties in Adelaide",
    metaDescription:
      "Houses, units and townhouses for rent across Adelaide. Inspection times, application requirements and what to prepare before you apply.",
    image: "photo-1600210491892-03d54c0aaf87",
    imageAlt: "Apartment living room with a fireplace",
    facts: ["Inspections most Saturdays", "Applications answered", "No application fee"],
    points: [
      "Photo identification, one hundred points between the applicants",
      "Proof of income, most recently two payslips or a letter from your employer",
      "A reference from your last agent or landlord, and a contact for it that answers",
      "Pet details if you have one, including whether it is registered and desexed",
    ],
    sections: [
      {
        heading: "You will hear back either way",
        body: [
          "An application that goes unanswered is the most common complaint tenants have about agents, and it is entirely avoidable. We tell you the outcome, including when it is no.",
          "If a property is gone before we get to your application, we will say that rather than leaving it open.",
        ],
      },
      {
        heading: "Before you apply",
        body: [
          "Have the documents above ready as one file. Applications with everything attached are assessed the same day; the ones missing a payslip wait for the applicant, not for us.",
          "If something in your history needs explaining, put it in the application. It is far better coming from you than found later.",
        ],
      },
    ],
    cta: { label: "Talk to the office", href: "/contact" },
  },

  {
    slug: "property-services",
    eyebrow: "What we do",
    title: "Four things,",
    titleEm: "done properly",
    lede: "Sales, management, buyer advocacy and investment, run out of one office on Prospect Road by the people who answer the phone.",
    metaTitle: "Property services in Adelaide",
    metaDescription:
      "Selling, property management, buyer advocacy and investment advice across Adelaide, from an agency that caps its agents at six live campaigns each.",
    image: "photo-1615873968403-89e068629265",
    imageAlt: "Living room with a tan leather sofa against a dark green wall",
    facts: ["One office", "Six live campaigns per agent", "Prospect and Glenelg"],
    points: [
      "Selling, with pricing you can check and weekly written reporting",
      "Property management from 2.99%, capped, with a hundred day trial",
      "Buyer advocacy for buyers who keep missing out at auction",
      "Investment and land, including subdivision feasibility on deep blocks",
    ],
    sections: [
      {
        heading: "Why the campaign cap matters",
        body: [
          "Each of our agents carries a maximum of six live campaigns. An agent running twenty is not returning calls on nineteen of them, and you can tell which one is yours by whether the phone gets answered.",
          "It is the reason we turn work away in a busy month, and the reason a campaign here gets the attention it was sold on.",
        ],
      },
    ],
    cta: { label: "Book a free appraisal", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "buyer-agent-adelaide",
    eyebrow: "Buyer advocacy",
    title: "For buyers who keep",
    titleEm: "missing out",
    lede: "We shortlist against your brief, inspect before you spend a Saturday on it, pull the sales history, and bid on your behalf.",
    metaTitle: "Buyer's agent in Adelaide",
    metaDescription:
      "An Adelaide buyer's agent who works only for the buyer. Shortlisting, inspection, sales history and auction bidding on a fixed fee, including off-market properties.",
    image: "photo-1600210491892-03d54c0aaf87",
    imageAlt: "Apartment living room with a fireplace",
    facts: ["Fixed fee", "Off-market access", "We bid for you"],
    points: [
      "A written brief, so we are both clear on what you are actually buying",
      "Properties inspected before they reach your Saturday, including the ones we reject",
      "The full sales history and what the vendor is likely to accept",
      "Bidding at auction on your behalf, to a limit you set in advance",
    ],
    sections: [
      {
        heading: "We are paid by you, not the vendor",
        body: [
          "A selling agent works for the vendor, and is very good at it. If you are buying without your own representation, everybody in the room is being paid by the other side.",
          "Our fee is fixed and agreed before we start, so it does not rise with the price we negotiate. An agent whose fee grows with what you pay is not on your side of the table.",
        ],
      },
      {
        heading: "The properties that never reach the portals",
        body: [
          "A meaningful share of Adelaide stock sells before it is advertised, to the agents who already know who is looking. Being on that list is most of what an advocate is for.",
          "We will also tell you to walk away, which is the part people remember. Talking a buyer out of the wrong purchase is worth more than finding them a fast one.",
        ],
      },
    ],
    cta: { label: "Start a conversation", href: "/contact" },
  },
  {
    slug: "overseas-investment",
    eyebrow: "Overseas investment",
    title: "Buying from",
    titleEm: "outside Australia",
    lede: "Adelaide is one of the few Australian capitals where the numbers still work for an offshore buyer. That does not make every listing a good buy.",
    metaTitle: "Overseas property investment in Adelaide",
    metaDescription:
      "Buying Adelaide property from overseas. Approval requirements, the costs that surprise offshore buyers, and independent advice on whether a deal stacks up.",
    image: "photo-1628624747186-a941c476b7ef",
    imageAlt: "Coastal home with established trees",
    facts: ["Independent of the vendor", "Written feasibility", "We inspect in person"],
    points: [
      "Whether the purchase needs approval before you commit, and how long that takes",
      "The duties and surcharges that apply to a foreign purchaser in South Australia",
      "Rental demand for that specific street, not the suburb average",
      "The holding costs across a full year, including the ones nobody quotes",
    ],
    sections: [
      {
        heading: "We will tell you when it does not stack up",
        body: [
          "We are paid for the advice, not the transaction, so there is no version of this where the answer is always yes.",
          "Buying sight unseen from another timezone is where the worst outcomes happen. Somebody walks through the property before you commit, and you get photographs of what is actually there.",
        ],
      },
      {
        heading: "Approval is not optional",
        body: [
          "Foreign investment rules change, and they carry real penalties. Get the position confirmed in writing before you sign anything, and treat any agent who waves this away as a warning.",
          "This page is general information about how we work, not legal or tax advice. Take the specifics to a solicitor and an accountant who know your circumstances.",
        ],
      },
    ],
    cta: { label: "Start a conversation", href: "/contact" },
  },
];

export const servicePageBySlug = (slug: string) =>
  SERVICE_PAGES.find((p) => p.slug === slug);

/**
 * The two misspelt legacy slugs, kept here so the redirect in next.config.ts and the
 * note in this file cannot drift apart.
 */
export const LEGACY_TYPO_REDIRECTS = [
  { from: "/oversees-investment", to: "/overseas-investment" },
  { from: "/contact-adelaide-realestae-agency", to: "/contact" },
] as const;
