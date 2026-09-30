/**
 * The agency's real details and real copy, taken from www.ozirealty.com.au.
 *
 * ## Why this file exists
 *
 * The site was built from a design template, and the template came with invented
 * content: three named agents, a second office on Jetty Road, 412 sales, a 27-day
 * median, 98.6% occupancy, a testimonial from "Molly & Dan Rasheed" and a suburb medians
 * ticker. None of it was true. Publishing invented performance figures and invented staff
 * under RLA 350 628 is a misleading representation, not a placeholder.
 *
 * Everything here is what the live site actually says. Where the live site makes a claim
 * (2.99%, 100 days risk-free, the $399 report), it is reproduced rather than invented,
 * and it is still the agency's job to confirm those are current before cutover.
 *
 * Nothing on the site is invented any more: the demo listing and sold cards were
 * replaced by real stock on 2026-09-30 and demo-data.ts was deleted.
 */

export const AGENCY = {
  /** The live site uses "OziRealty" in body copy and "Ozi Realty" in some headings. */
  name: "OziRealty",
  principal: "Esi Dor",
  principalTitle: "Founder & CEO",
  phone: "1800 400 333",
  phoneHref: "tel:1800400333",
  office: "308 Prospect Rd, Prospect SA 5082",
  licence: "RLA 350 628",
  abn: "14 682 825 449",
  email: "support@ozirealty.com.au",
} as const;

/**
 * Five addresses, one per department, exactly as the live site lists them. Worth keeping
 * separate rather than collapsing to support@: an enquiry sent to the right desk is the
 * cheapest routing the agency has.
 */
export const EMAILS = [
  { label: "General", address: "support@ozirealty.com.au" },
  { label: "Renting", address: "rent@ozirealty.com.au" },
  { label: "Selling", address: "sell@ozirealty.com.au" },
  { label: "Buying", address: "buy@ozirealty.com.au" },
  { label: "Overseas", address: "oversea@ozirealty.com.au" },
] as const;

/** The live site's headline promise, and the strip under the hero. */
export const HERO = {
  title: "Your Property Journey",
  titleEm: "Starts Here",
  lede: "From finding your first home to selling, investing, or managing property, we make every step simple, clear, and stress-free.",
} as const;

/**
 * "Your Property Journey Starts Here" on the live site is a row of destinations, not a
 * paragraph. These are its exact labels, pointed at the pages that answer them.
 */
export const JOURNEY = [
  { label: "Sell My Property", href: "/sell-property-house-adelaide" },
  { label: "Rent Out My Property", href: "/manage-property-adelaide" },
  { label: "I Need A Buyer Agent", href: "/buyer-agent-adelaide" },
  { label: "I Want to Invest", href: "/property-investment" },
  { label: "Looking For Land", href: "/land-opportunities-sa-adelaide" },
  { label: "I Need To Rent", href: "/rent-property-house-adelaide" },
  { label: "Sell My Business", href: "/sell-my-business-australia" },
] as const;

/**
 * The four claims the live site leads with, replacing the template's invented statistics.
 *
 * These are offers, not performance figures, which is the distinction that matters: an
 * agency may advertise its own terms, and may not advertise results it did not achieve.
 */
export const PROMISES = [
  { value: "2.99", unit: "%", caption: "Property management, from" },
  { value: "100", unit: " days", caption: "Risk-free, on every management plan" },
  { value: "$399", unit: "", caption: "Premium appraisal report, free" },
  { value: "0", unit: "", caption: "Middle men between you and the principal" },
] as const;

/** Mission, vision and values, from the About page. */
export const ABOUT = {
  mission:
    "OziRealty is committed to delivering top-tier real estate services across Australia. We help buyers, sellers, and investors navigate the property market with expert advice, innovative solutions, and a client-first approach.",
  vision:
    "To be Australia's most trusted real estate agency, setting industry standards with exceptional property services, market insights, and seamless transactions for homebuyers and investors.",
  values: [
    {
      name: "Integrity & Transparency",
      body: "Building trust with honest and ethical real estate transactions.",
    },
    {
      name: "Customer Focus",
      body: "Providing tailored property solutions for buyers, sellers, and investors.",
    },
    {
      name: "Innovation & Growth",
      body: "Leveraging the latest real estate technology and marketing strategies to maximise results.",
    },
  ],
  body: [
    "At OziRealty, we are more than just a real estate agency. We are your local partners in property. Based in Adelaide, South Australia, we specialise in residential sales, property management, and investment opportunities across the state and beyond. Whether you are buying your first home, selling your current property, or exploring overseas investment options, our experienced and licensed team is here to help.",
    "With deep market knowledge, personalised service, and a commitment to transparent communication, OziRealty is redefining the real estate experience. We combine modern marketing strategies, including digital advertising and SEO, with genuine care for our clients' goals.",
    "OziRealty blends real estate expertise with financial advising and finance broking, providing seamless property and investment solutions.",
  ],
} as const;

/** "Why Work With Us?" from the home page, in its three groups. */
export const WHY_US = [
  {
    name: "Exclusive",
    points: [
      "Tailored real estate experience",
      "Digital marketing strategies that attract the right buyers",
      "AI-powered, data-driven insights for smarter decisions",
      "Personalised property search and targeting",
      "Expert support for buying, selling, and investing",
      "Focused on measurable results",
    ],
  },
  {
    name: "Available",
    points: [
      "Fast, clear communication",
      "Timely updates at every stage",
      "Accurate market insights",
      "Strategic expert guidance",
      "Proactive problem solving",
      "Smooth, stress-free experience",
    ],
  },
  {
    name: "Flexible",
    points: [
      "Every client has different goals",
      "We adapt to your schedule and preferences",
      "Virtual consultations available",
      "Evening showings available",
      "Customised negotiation strategies",
      "We tailor the process to fit you",
    ],
  },
] as const;

/**
 * The real testimonial, from the home page.
 *
 * One, not a fabricated average and a review count. The template carried "4.9 average,
 * 218 Google reviews" beside a quote from people who do not exist; a star rating is a
 * representation about the business and needs a source, so it is not reproduced here.
 */
export const TESTIMONIAL = {
  quote:
    "Exceptional service! The team at OziRealty made buying our home seamless and stress-free. Highly recommend!",
  name: "Molly Daniel",
} as const;

/**
 * The principal's photograph, and the agency's wordmark.
 *
 * Both are downloaded into `public/brand/` rather than hotlinked from
 * static.wixstatic.com. Pointing at somebody else's CDN was always wrong for launch: the
 * images vanish the day the Wix account lapses, every visitor pays a DNS and TLS
 * handshake to a third party, and the agency's own brand assets end up outside its
 * control. Serving them from our origin also lets next/image resize and re-encode them.
 */
export const PORTRAIT = {
  src: "/brand/esi-dor.jpg",
  width: 806,
  height: 810,
  alt: "Esi Dor, Founder and CEO of OziRealty, real estate agent in South Australia",
} as const;

/**
 * "We Work With the Best" on the live site.
 *
 * Third-party marks, reproduced because the agency already publishes them. They are
 * rendered as a plain row with no claim attached beyond the heading: an endorsement the
 * agency has not been given is a representation, and "we work with" is not the same
 * sentence as "endorsed by".
 */
export const PARTNERS = [
  { name: "realestate.com.au", src: "/brand/partner-rea.png", w: 376, h: 114 },
  { name: "Domain", src: "/brand/partner-domain.png", w: 360, h: 120 },
  { name: "CoreLogic", src: "/brand/partner-corelogic.png", w: 360, h: 120 },
  { name: "Cotality", src: "/brand/partner-cotality.png", w: 360, h: 120 },
  { name: "REISA", src: "/brand/partner-reisa.png", w: 360, h: 120 },
  { name: "OnTheHouse", src: "/brand/partner-onthehouse.png", w: 360, h: 120 },
  { name: "Reapit", src: "/brand/partner-reapit.png", w: 360, h: 120 },
  { name: "Google", src: "/brand/partner-google.png", w: 360, h: 120 },
] as const;

/** The free reports the site offers, and what each one contains. */
export const REPORTS = {
  appraisal: {
    title: "Free Premium Appraisal Report",
    note: "Valued at $399. No obligation, no pressure.",
    items: [
      "Current market value range",
      "Comparable recent sales",
      "Buyer demand score",
      "Rental yield estimate",
      "Price-maximisation strategy",
      "Suburb growth outlook",
    ],
  },
  consultation: {
    title: "Book Your Free Property Consultation",
    note: "One-on-one with the principal.",
    items: [
      "Assess current market value",
      "Review recent sales in your area",
      "Analyse buyer and rental demand",
      "Identify ways to maximise your return",
      "Answer your key questions",
    ],
  },
  suburb: {
    title: "Free Suburb Insight Report",
    note: "Stay ahead of the next market shift.",
    items: [
      "Median prices and recent sales trends",
      "Rental yields and vacancy rates",
      "Suburb growth performance",
      "Buyer and tenant demand levels",
      "Demographic and population insights",
      "School catchment zones",
      "Comparison with surrounding suburbs",
      "Long-term capital growth trends",
      "Risk indicators and suburb volatility analysis",
    ],
  },
  rental: {
    title: "Property Rental Report",
    note: "Smart rent, stable income, zero guesswork.",
    items: [
      "Accurate weekly rent range",
      "Comparable nearby rental results",
      "Vacancy and demand insights",
      "Tenant profile analysis",
      "Yield and annual income estimate",
      "Pricing strategy to minimise vacancy",
    ],
  },
} as const;

/** The three management plans, from the property management page. */
export const MANAGEMENT_PLANS = [
  {
    name: "Income Protect",
    points: [
      "Rent collection and disbursement",
      "Professional tenant communication",
      "Lease preparation and renewals",
      "Secure owner portal access",
    ],
  },
  {
    name: "Income Optimise",
    points: [
      "Everything in Income Protect",
      "Four routine inspections per year",
      "Annual rent review aligned to market data",
      "Priority maintenance for plumbing and gardening",
      "Vacancy minimisation strategy",
    ],
  },
  {
    name: "Income & Risk Shield",
    points: [
      "Everything in Income Optimise",
      "Arrears and default management",
      "Compliance and legislation monitoring",
      "Tribunal representation where required",
    ],
  },
] as const;

/**
 * The two most recent journal posts, from the live blog.
 *
 * Titles and opening lines are the agency's own. The posts themselves are a content
 * migration out of Wix (2B.9a), and `/post/<slug>` is kept verbatim when they land,
 * which is why nothing links to an individual post yet.
 */
export const JOURNAL_POSTS = [
  {
    title: "How Much Does a Property Manager Cost in Adelaide?",
    excerpt:
      "Property management fees vary more than most owners expect, and the cheapest quote is not always the one that leaves you better off.",
    src: "/brand/post-manager-cost.png",
    alt: "How much does a property manager cost in Adelaide",
  },
  {
    title: "Where to Find Investment Property Advice in Adelaide",
    excerpt:
      "The hardest part is often not finding a property. It is knowing whose advice to trust.",
    src: "/brand/post-investment-advice.png",
    alt: "Where to find investment property advice in Adelaide",
  },
] as const;

/** Unsplash is allow-listed in next.config.ts; this keeps the query string in one place. */
export const photo = (id: string, w: number) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
