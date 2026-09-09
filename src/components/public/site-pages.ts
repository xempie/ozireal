/**
 * The standalone pages, written from www.ozirealty.com.au's own copy.
 *
 * ## URLs mirror the live site
 *
 * `docs/legacy-site.md` inventories 22 indexed pages there. These keep their exact slug,
 * so at cutover those URLs carry their ranking across with no redirect to get wrong.
 * That is why the paths read like `/sell-property-house-adelaide` rather than `/sell`:
 * the ugly slug is the one Google already knows.
 *
 * Two are corrected, because they are misspelt at the source, and both 301 from the old
 * spelling in next.config.ts per rule 6 of the redirect plan:
 *
 *   /oversees-investment               -> /overseas-investment
 *   /contact-adelaide-realestae-agency -> /contact
 *
 * ## The copy is the agency's, not invented
 *
 * An earlier version of this file was written from a design template and invented most of
 * what it said: agents who do not work here, a second office, service terms nobody
 * offers. It has been replaced with what the live site actually says. Where a claim
 * appears (2.99%, 100 days risk-free, the $399 report) it is reproduced from the live
 * site rather than composed, and confirming those are current is still the licensee's job
 * before cutover.
 *
 * One thing deliberately not carried across: the live overseas-investment page runs three
 * named investor testimonials. They are reproduced nowhere here, because a testimonial is
 * a representation and it should be republished by the agency, not copied over by a build.
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
  /** The numbered list, styled like the appraisal report. */
  points: string[];
  sections: PageSection[];
  cta: { label: string; href: string };
}

export const SERVICE_PAGES: ServicePage[] = [
  {
    slug: "property-services",
    eyebrow: "Our services",
    title: "Your property journey",
    titleEm: "starts here",
    lede: "A comprehensive range of real estate services tailored to meet your needs, whether you are selling, buying, investing overseas, or managing a rental property.",
    metaTitle: "Property services in Adelaide",
    metaDescription:
      "Selling, property management from 2.99%, buyer advocacy, investment and overseas property. Local Adelaide expertise combined with global insight.",
    image: "photo-1615873968403-89e068629265",
    imageAlt: "Living room with a tan leather sofa against a dark green wall",
    facts: ["Local and global", "Transparent fees", "Licensed and regulated"],
    points: [
      "Sell my property, with a strategy built on comparable sales rather than a guess",
      "Rent out my property, managed from 2.99% with 100 days risk-free",
      "Buyer agent services, from search through to settlement",
      "Investment, land and business sales, including overseas opportunities",
    ],
    sections: [
      {
        heading: "One team across the whole journey",
        body: [
          "Our dedicated team combines local market expertise with global insights to guide you through every stage of your property journey. With a commitment to transparency, results, and long-term value, we are here to help you make smarter, more confident real estate decisions.",
          "OziRealty blends real estate expertise with financial advising and finance broking, providing seamless property and investment solutions. That combination is unusual in a local agency, and it is why a strategy conversation here can cover the finance as well as the property.",
        ],
      },
    ],
    cta: { label: "Book a free consultation", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "property-strategy-services",
    eyebrow: "Strategy services",
    title: "Turn property into a strategy,",
    titleEm: "not a guess",
    lede: "Making the right property decisions is not about luck. It is about having a clear strategy based on real data, market insight, and long-term goals.",
    metaTitle: "Property strategy services in Adelaide",
    metaDescription:
      "Property strategy for Adelaide investors, homeowners and landlords. Identify high-performing suburbs, analyse rental demand, and structure a plan around your financial goals.",
    image: "photo-1600596542815-ffad4c1539a9",
    imageAlt: "White rendered home under a blue sky",
    facts: ["Backed by local data", "Investors and owners", "Reduce risk, increase returns"],
    points: [
      "Identify high-performing suburbs, with the data behind the shortlist",
      "Analyse rental demand before you commit, not after",
      "Structure a strategy that aligns with your financial goals",
      "Review a portfolio you already hold, and see where it is concentrated",
    ],
    sections: [
      {
        heading: "Who it is for",
        body: [
          "Our property strategy services are designed to help investors, homeowners, and landlords make smarter decisions across buying, holding, and managing property. Whether you are looking to grow a portfolio, improve rental returns, or enter the market with confidence, we provide tailored guidance backed by local Adelaide market data.",
          "From first-time investors to experienced property owners, our approach is simple: reduce risk, increase returns, and make every move count.",
        ],
      },
      {
        heading: "What it is not",
        body: [
          "This is property advice. Where a question needs your accountant, your broker or a solicitor, we will say so rather than answer it ourselves.",
        ],
      },
    ],
    cta: { label: "Book a free consultation", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "sell-property-house-adelaide",
    eyebrow: "Selling",
    title: "Sell with a strategy,",
    titleEm: "not a guess",
    lede: "A campaign built on comparable sales, buyer demand for your street, and a price-maximisation strategy you can read for yourself.",
    metaTitle: "Sell your property in Adelaide",
    metaDescription:
      "Sell your Adelaide property with OziRealty. Free premium appraisal report valued at $399, comparable sales, buyer demand analysis and a price-maximisation strategy.",
    image: "photo-1598228723793-52759bba239c",
    imageAlt: "Brick home framed by green trees",
    facts: ["Free appraisal report", "Valued at $399", "No obligation"],
    points: [
      "Current market value range, with the comparable recent sales behind it",
      "A buyer demand score for your property, not the suburb average",
      "A rental yield estimate, if holding is still on the table",
      "A price-maximisation strategy and the suburb growth outlook",
    ],
    sections: [
      {
        heading: "Start with the report, not the agreement",
        body: [
          "The premium appraisal report is free and carries no obligation and no pressure. It tells you what the property is worth now, what comparable homes actually sold for, and what could be done to improve the result.",
          "Plenty of those reports do not turn into a listing, and that is the point of offering one. A decision to sell should follow the numbers rather than the appointment.",
        ],
      },
      {
        heading: "Selling is one option among several",
        body: [
          "The same report covers rental yield, because for some owners holding is the better answer that year. If that is where the numbers point, we will tell you.",
        ],
      },
    ],
    cta: { label: "Get my free appraisal", href: "/free-property-appraisal-sa" },
  },

  {
    slug: "rent-property-house-adelaide",
    eyebrow: "Renting",
    title: "Looking for a rental",
    titleEm: "in Adelaide",
    lede: "The properties we are advertising, with inspection times you can attend and an application process that tells you where you stand.",
    metaTitle: "Rental properties in Adelaide",
    metaDescription:
      "Houses, units and townhouses for rent across Adelaide with OziRealty. Inspection times, application requirements and what to prepare before you apply.",
    image: "photo-1605146769289-440113cc3d00",
    imageAlt: "Grey and white contemporary home",
    facts: ["Adelaide wide", "Applications answered", "rent@ozirealty.com.au"],
    points: [
      "Photo identification, one hundred points between the applicants",
      "Proof of income, usually two recent payslips or a letter from your employer",
      "A reference from your last agent or landlord, with a contact that answers",
      "Pet details if you have one, including whether it is registered and desexed",
    ],
    sections: [
      {
        heading: "You will hear back either way",
        body: [
          "An application that goes unanswered is the most common complaint tenants have about agents, and it is entirely avoidable. We tell you the outcome, including when it is no.",
          "If a property is gone before we reach your application, we will say that rather than leaving it open.",
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
    slug: "rent-out-my-property-adelaide",
    eyebrow: "Landlords",
    title: "Rent out your property,",
    titleEm: "properly priced",
    lede: "A rental appraisal based on what comparable properties actually leased for, a pricing strategy that minimises vacancy, and a manager you can reach.",
    metaTitle: "Rent out my property in Adelaide",
    metaDescription:
      "Rent out your Adelaide property with OziRealty. Free rental appraisal, careful tenant screening, and management from 2.99% with 100 days risk-free.",
    image: "photo-1605146769289-440113cc3d00",
    imageAlt: "Grey and white contemporary home",
    facts: ["Free rental appraisal", "From 2.99%", "rent@ozirealty.com.au"],
    points: [
      "An accurate weekly rent range, with the comparable lettings behind it",
      "Careful tenant screening and leasing management",
      "A pricing strategy built to minimise vacancy rather than maximise the headline",
      "Routine inspections and maintenance coordination once it is let",
    ],
    sections: [
      {
        heading: "Pricing is the whole game",
        body: [
          "Overpricing a rental costs more in vacancy than the extra rent recovers. Two weeks empty wipes out a year of an extra ten dollars a week, and that arithmetic is the reason the appraisal comes first.",
          "We will give you the range, the comparable results, and a recommendation. What you list at is your decision.",
        ],
      },
      {
        heading: "Then it is managed",
        body: [
          "Letting and ongoing management run on the same plans as the rest of the rent roll, from 2.99% with 100 days risk-free. Details are on the management page.",
        ],
      },
    ],
    cta: { label: "How management works", href: "/manage-property-adelaide" },
  },

  {
    slug: "property-investment",
    eyebrow: "Investment",
    title: "Invest on the numbers,",
    titleEm: "not the pitch",
    lede: "Capital growth, rental yield and tax position pull in different directions. Which one leads decides the shortlist, so that is the first question we ask.",
    metaTitle: "Property investment in Adelaide",
    metaDescription:
      "Investment property advice for Adelaide and overseas. Yield, growth and holding costs across a full year, with real estate expertise combined with finance broking.",
    image: "photo-1628624747186-a941c476b7ef",
    imageAlt: "Coastal home with established trees",
    facts: ["South Australia and overseas", "Dual expertise", "Written analysis"],
    points: [
      "Whether the goal is capital growth, rental yield, a tax position, or a mix",
      "Rental demand for the specific street rather than the suburb average",
      "Holding costs across a full year, including the ones nobody quotes",
      "Finance structured alongside the purchase rather than after it",
    ],
    sections: [
      {
        heading: "The finance and the property together",
        body: [
          "OziRealty blends real estate expertise with financial advising and finance broking. For an investor that matters more than it sounds: the property that suits your borrowing position is not always the one that looks best on the listing.",
          "We will tell you when a deal does not stack up. That is what being paid for the advice rather than the transaction is for.",
        ],
      },
      {
        heading: "Not financial advice",
        body: [
          "This page describes how we work. Your circumstances decide what actually applies, and the tax position in particular belongs with your accountant. No return is guaranteed.",
        ],
      },
    ],
    cta: { label: "Talk about your goals", href: "/contact" },
  },

  {
    slug: "land-opportunities-sa-adelaide",
    eyebrow: "Land",
    title: "Land, and what you can",
    titleEm: "actually build on it",
    lede: "A block is only worth what council will let you do with it. We look at the zoning and the feasibility before the price.",
    metaTitle: "Land opportunities in Adelaide and South Australia",
    metaDescription:
      "Land for sale and subdivision opportunities across Adelaide and South Australia. Zoning, feasibility and holding costs assessed before you commit.",
    image: "photo-1600596542815-ffad4c1539a9",
    imageAlt: "White rendered home under a blue sky",
    facts: ["Build, invest or subdivide", "Feasibility first", "South Australia"],
    points: [
      "What the zoning allows, and what council is likely to approve",
      "Subdivision feasibility on deep blocks, run with the council costs included",
      "Holding costs while you build, and what they do to the return",
      "What is available now, and what we expect to come up",
    ],
    sections: [
      {
        heading: "The feasibility comes before the offer",
        body: [
          "The deep block that is quietly worth twice its listing and the one that cannot be split look identical from the street. The difference is zoning, frontage, easements and services, and none of that is in the advertisement.",
          "We will tell you which one you are looking at before you commit to either.",
        ],
      },
    ],
    cta: { label: "Tell us what you are after", href: "/contact" },
  },

  {
    slug: "sell-my-business-australia",
    eyebrow: "Business brokerage",
    title: "Selling a business,",
    titleEm: "confidentially",
    lede: "Nothing is advertised, and nothing is discussed with a buyer, without your say-so. For most owners confidentiality is the whole brief.",
    metaTitle: "Sell my business in Australia",
    metaDescription:
      "Confidential business sales through OziRealty. Valuation, buyer qualification and negotiation, without staff, customers or suppliers finding out first.",
    image: "photo-1615873968403-89e068629265",
    imageAlt: "Living room with a tan leather sofa against a dark green wall",
    facts: ["Confidential", "Buyers qualified first", "Australia wide"],
    points: [
      "A valuation based on the numbers a buyer will actually underwrite",
      "Buyers qualified before they see anything identifying",
      "Negotiation and contract support through to settlement",
      "Timing advice, including when not to go to market yet",
    ],
    sections: [
      {
        heading: "Confidentiality is a process, not a promise",
        body: [
          "Staff, customers and suppliers finding out before you are ready is the risk that does real damage, and it usually happens through a careless advertisement rather than a leak.",
          "So the listing is written to describe the business without identifying it, and buyers are qualified and under agreement before they see more.",
        ],
      },
      {
        heading: "Get your books in order first",
        body: [
          "The single biggest thing that moves a business price is clean, verifiable financials. If they are not there yet, the honest advice is to spend a year getting them there rather than going to market now.",
        ],
      },
    ],
    cta: { label: "Start a confidential conversation", href: "/contact" },
  },
  {
    slug: "buyer-agent-adelaide",
    eyebrow: "Buyer agent",
    title: "From searching to settlement,",
    titleEm: "we are with you",
    lede: "Buying a home or investment property can be complex without the right support. We help South Australian buyers find the right property and buy it with confidence.",
    metaTitle: "Buyer agent services in Adelaide",
    metaDescription:
      "OziRealty buyer agent services for South Australian buyers: market research, suburb growth analysis, valuation, building inspection coordination and negotiation support.",
    image: "photo-1600210491892-03d54c0aaf87",
    imageAlt: "Apartment living room with a fireplace",
    facts: ["On, pre and off-market", "Negotiation support", "buy@ozirealty.com.au"],
    points: [
      "Tailored property search, with access to on-market, pre-market and off-market opportunities",
      "Building quality inspection coordination, and identification of hidden issues",
      "Property valuation, comparable sales analysis and rental yield insight",
      "Strategic price negotiation, and guidance through to settlement",
    ],
    sections: [
      {
        heading: "Property search and risk reduction",
        body: [
          "The search is tailored to your goals, whether the property is an investment or a home, and shortlisting happens before you spend a Saturday on it. Building condition assessment and inspection coordination sit inside the service, along with guidance on maintenance and future costs.",
          "Knowing what is wrong with a property before you bid is worth more than finding it faster.",
        ],
      },
      {
        heading: "Market analysis and negotiation",
        body: [
          "Property valuation and price assessment, comparable sales analysis, and a market trend and growth review, so the number you offer has something behind it.",
          "From there we handle strategic price negotiation, the offer and contract stages, and communication with the selling agent and vendor.",
        ],
      },
    ],
    cta: { label: "Find the right property", href: "/contact" },
  },

  {
    slug: "overseas-investment",
    eyebrow: "Oversea investment",
    title: "Unlock Dubai:",
    titleEm: "a gateway to smart investment",
    lede: "A dynamic global hub for investors who think ahead. From high-return real estate to booming business sectors, Dubai offers potential in a safe, tax-friendly, and future-focused environment.",
    metaTitle: "Overseas property investment in Dubai",
    metaDescription:
      "Invest in Dubai property through OziRealty. Real estate expertise combined with financial advising and finance broking, from property selection to finance and settlement.",
    image: "photo-1628624747186-a941c476b7ef",
    imageAlt: "Coastal home with established trees",
    facts: ["Dubai portfolio", "Dual expertise", "oversea@ozirealty.com.au"],
    points: [
      "Dual expertise: real estate knowledge combined with financial advising and finance broking",
      "Strategic investment planning, risk-aware and matched to your long-term goals",
      "End-to-end service, from property selection and market analysis through to settlement",
      "A comparison of the Australian and Dubai markets, backed by industry data",
    ],
    sections: [
      {
        heading: "Seamless cross-border investment",
        body: [
          "We blend real estate knowledge with financial advising and finance brokering, offering a complete investment solution: from finding the right property to securing the best financial strategy.",
          "From property selection and market analysis to finance and settlement, we offer a guided experience with no guesswork and no gaps.",
        ],
      },
      {
        heading: "Before you commit",
        body: [
          "Cross-border purchases carry approval, tax and currency questions that a local one does not, and they change. Get your position confirmed in writing by an accountant and a solicitor who know your circumstances.",
          "This page is general information about how we work. It is not legal, tax or financial advice, and no return is guaranteed.",
        ],
      },
    ],
    cta: { label: "Register your interest", href: "/contact" },
  },

  {
    slug: "about-adelaide-land-agent",
    eyebrow: "About us",
    title: "Where property",
    titleEm: "meets purpose",
    lede: "More than a real estate agency. Based in Adelaide, South Australia, we specialise in residential sales, property management, and investment opportunities across the state and beyond.",
    metaTitle: "About OziRealty",
    metaDescription:
      "OziRealty is an Adelaide real estate agency led by principal Esi Dor, blending real estate expertise with financial advising and finance broking. RLA 350 628.",
    image: "photo-1568605114967-8130f3a36994",
    imageAlt: "Character home in Prospect",
    facts: ["RLA 350 628", "308 Prospect Rd", "Led by Esi Dor"],
    points: [
      "Residential sales across Adelaide and South Australia",
      "Property management from 2.99%, with 100 days risk-free",
      "Buyer advocacy, investment guidance and overseas opportunities",
      "Real estate expertise combined with financial advising and finance broking",
    ],
    sections: [
      {
        heading: "Mission",
        body: [
          "OziRealty is committed to delivering top-tier real estate services across Australia. We help buyers, sellers, and investors navigate the property market with expert advice, innovative solutions, and a client-first approach.",
        ],
      },
      {
        heading: "Vision",
        body: [
          "To be Australia's most trusted real estate agency, setting industry standards with exceptional property services, market insights, and seamless transactions for homebuyers and investors.",
        ],
      },
      {
        heading: "How we work",
        body: [
          "With deep market knowledge, personalised service, and a commitment to transparent communication, OziRealty is redefining the real estate experience. We combine modern marketing strategies, including digital advertising and SEO, with genuine care for our clients' goals.",
          "OziRealty blends real estate expertise with financial advising and finance broking, providing seamless property and investment solutions.",
        ],
      },
    ],
    cta: { label: "Talk to Esi", href: "/contact" },
  },

  {
    slug: "realestate-gift-adelaide",
    eyebrow: "Gift party",
    title: "A bundle for buyers,",
    titleEm: "sellers and investors",
    lede: "Get on the list and we will send the bundle to your inbox. It is where the finance side of the business pays off for clients on the property side.",
    metaTitle: "Gift Party bundle",
    metaDescription:
      "OziRealty's Gift Party bundle: a discount on an individual tax return, a free loan consultation, cash-back on refinances, borrowing power strategy and a home buying guide.",
    image: "photo-1615873968403-89e068629265",
    imageAlt: "Living room with a tan leather sofa against a dark green wall",
    facts: ["Buy, rent, invest or sell", "Sent to your inbox"],
    points: [
      "30% off one individual tax return",
      "A free one-to-one loan consultation, and $200 cash-back on refinances",
      "Free borrowing power calculation and strategy, with a complete loan guide",
      "10 Truths About Finding the Right Home, a guide to avoiding common buying traps",
    ],
    sections: [
      {
        heading: "Why we can offer it",
        body: [
          "Comprehensive expertise: we blend real estate services with financial advising and finance brokering for seamless property and investment solutions. The bundle is that combination handed to clients, rather than kept as a cross-sell.",
          "Integrity and transparency, customer focus, and a local and global perspective are what the agency runs on, and this is one of the places that shows up as something concrete.",
        ],
      },
      {
        heading: "The terms",
        body: [
          "Financial and tax services are provided under the relevant licences and are subject to their own terms and eligibility. Ask us for the detail that applies to your circumstances before relying on any of it.",
        ],
      },
    ],
    cta: { label: "Talk to the office", href: "/contact" },
  },
];

export const servicePageBySlug = (slug: string) =>
  SERVICE_PAGES.find((p) => p.slug === slug);

/**
 * The two misspelt legacy slugs, kept here so the redirect in next.config.ts and the note
 * at the top of this file cannot drift apart.
 */
export const LEGACY_TYPO_REDIRECTS = [
  { from: "/oversees-investment", to: "/overseas-investment" },
  { from: "/contact-adelaide-realestae-agency", to: "/contact" },
] as const;
