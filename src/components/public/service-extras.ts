import type { IconKey } from "./icons";

/**
 * The persuasive half of a service page.
 *
 * `site-pages.ts` holds what the service IS, taken from the agency's own copy. This holds
 * what makes somebody fill the form: three benefit cards, two photographs, and a closing
 * pitch that names the cost of not acting rather than shouting.
 *
 * Kept separate from `site-pages.ts` deliberately. That file is a transcription of the
 * live site and should stay reviewable against it; this is written for conversion and will
 * be edited far more often. Mixing them would make it hard to tell at a glance which
 * sentences the agency actually said.
 *
 * ## On the marketing tone
 *
 * Every claim here is either a term the agency already advertises (2.99%, 100 days
 * risk-free, the $399 report) or a general truth about the process that does not assert a
 * result. Nothing says "we will get you more" or invents a statistic, because that is a
 * representation about performance and rule 3.7 of CLAUDE.md is not suspended because the
 * copy is trying to sell. Urgency comes from real costs: a vacant week, an overpriced
 * campaign going stale, an auction you were not registered for.
 *
 * ## The photographs
 *
 * Unsplash ids, and the host is allow-listed in next.config.ts. Deliberately NOT Freepik:
 * its licence needs a subscription or attribution for commercial use, and a licensed
 * agency's live site is the wrong place to inherit that question. These are placeholders
 * for the agency's own photography, which should replace them before cutover.
 */

export interface ServiceCard {
  icon: IconKey;
  title: string;
  body: string;
}

export interface ServiceExtras {
  /** Three benefit cards under the hero. */
  cards: ServiceCard[];
  /** Two photographs and the line that runs with them. */
  gallery: { image: string; alt: string }[];
  galleryLead: string;
  galleryBody: string;
  /** The block immediately above the form. */
  pitch: {
    heading: string;
    headingEm: string;
    body: string;
    bullets: string[];
    /** What it costs to leave it. Concrete, never invented. */
    cost: string;
  };
}

export const SERVICE_EXTRAS: Record<string, ServiceExtras> = {
  "sell-property-house-adelaide": {
    cards: [
      {
        icon: "report",
        title: "A report, not a number",
        body: "The comparable sales, the buyer demand for your street and a price-maximisation strategy, written down so you can check the working.",
      },
      {
        icon: "money",
        title: "Valued at $399, free",
        body: "No obligation and no listing pitch attached. Plenty of these never turn into a sale, which is rather the point of offering one.",
      },
      {
        icon: "chart",
        title: "Priced on evidence",
        body: "A campaign built on what comparable homes actually sold for, not on the number that wins the listing and stalls in week six.",
      },
    ],
    gallery: [
      { image: "photo-1600596542815-ffad4c1539a9", alt: "Rendered family home under a clear sky" },
      { image: "photo-1598228723793-52759bba239c", alt: "Brick character home framed by mature trees" },
    ],
    galleryLead: "Before you commit to an agent",
    galleryBody:
      "The single most expensive decision in a sale is the asking price, and it is made before anything is signed. Getting it wrong by ten per cent does not cost ten per cent: it costs the first three weeks, which is when the buyers who were waiting for your street actually look.",
    pitch: {
      heading: "Find out what it is worth",
      headingEm: "before you decide",
      body: "The appraisal is free, takes about forty minutes at the property, and you are under no obligation afterwards. Most owners find the report changes the timing of their decision rather than the decision itself.",
      bullets: [
        "Current market value range, with the comparable sales behind it",
        "Buyer demand for your street over the past ninety days",
        "The rental yield, if holding turns out to be the better year",
        "The jobs worth doing before you list, and what they return",
      ],
      cost: "A campaign that starts at the wrong price is hardest to fix in the weeks when it matters most.",
    },
  },

  "manage-property-adelaide": {
    cards: [
      {
        icon: "money",
        title: "From 2.99%, capped",
        body: "No letting fee, no admin fee, no statement fee bolted on. The percentage is the whole fee, which is what makes it comparable.",
      },
      {
        icon: "shield",
        title: "100 days risk-free",
        body: "If the service is not what we described, leave inside a hundred days and pay nothing for the management we have done.",
      },
      {
        icon: "people",
        title: "No middle man",
        body: "You deal with the principal, not a shared inbox. When something goes wrong at the property, that is the difference that shows.",
      },
    ],
    gallery: [
      { image: "photo-1605146769289-440113cc3d00", alt: "Contemporary rental home in Adelaide" },
      { image: "photo-1600210491892-03d54c0aaf87", alt: "Well-presented apartment interior" },
    ],
    galleryLead: "What a fee comparison actually looks like",
    galleryBody:
      "Management pricing stops being comparable the moment the add-ons start. Ask any agency you are weighing us against for the total of every charge across a full year, including letting, re-letting, statements, inspections and tribunal attendance. The headline percentage is the easy part to quote and the least useful number in the answer.",
    pitch: {
      heading: "See what you are",
      headingEm: "actually paying",
      body: "Send us the property and your current arrangement. We will come back with what management would cost here and what the property should be earning, so you have both halves of the comparison rather than one.",
      bullets: [
        "A rental appraisal with the comparable lettings behind it",
        "Your current total annual cost, itemised against ours",
        "Two months free on signing, and another two if you refer a landlord",
        "The notice period in your existing agreement, read properly",
      ],
      cost: "Two weeks of unnecessary vacancy costs more than a year of the fee difference most owners are arguing about.",
    },
  },

  "rent-out-my-property-adelaide": {
    cards: [
      {
        icon: "chart",
        title: "Priced to let, not to boast",
        body: "An accurate weekly range from comparable lettings, because overpricing a rental costs more in vacancy than the extra rent recovers.",
      },
      {
        icon: "search",
        title: "Tenants screened properly",
        body: "Identity, income and a reference from an agent who answers. The application that takes an hour longer is the one that saves a year.",
      },
      {
        icon: "clock",
        title: "Advertised the same week",
        body: "Photography, listing copy and inspection times organised together, so the property is in front of tenants while it is empty.",
      },
    ],
    gallery: [
      { image: "photo-1568605114967-8130f3a36994", alt: "Character home available to rent" },
      { image: "photo-1615873968403-89e068629265", alt: "Presented living room in a rental property" },
    ],
    galleryLead: "The arithmetic of one empty week",
    galleryBody:
      "A property listed twenty dollars a week above the market usually finds a tenant eventually, and the wait is the expensive part. Two weeks vacant on a $600 rental is $1,200 gone to recover $1,040 across the whole year, and that is before the second inspection round. Pricing it right in week one is the entire game.",
    pitch: {
      heading: "Get the rent right",
      headingEm: "the first time",
      body: "Tell us about the property and we will send an accurate weekly range with the comparable results it came from, plus what to fix before it goes to market.",
      bullets: [
        "Accurate weekly rent range and comparable nearby lettings",
        "Vacancy and demand insight for that specific street",
        "Tenant profile the property will actually attract",
        "A pricing strategy built to minimise time empty",
      ],
      cost: "Every week the property sits empty is rent that cannot be earned back later in the lease.",
    },
  },

  "rent-property-house-adelaide": {
    cards: [
      {
        icon: "key",
        title: "Heard about it first",
        body: "Register what you need and we will tell you about matching properties as they come up, rather than after the first open home.",
      },
      {
        icon: "check",
        title: "You will get an answer",
        body: "Including when it is no. An application that goes unanswered is the most common complaint tenants have about agents, and it is avoidable.",
      },
      {
        icon: "clock",
        title: "Assessed the same day",
        body: "Applications with every document attached are looked at immediately. The ones missing a payslip wait for the applicant, not for us.",
      },
    ],
    gallery: [
      { image: "photo-1600210491892-03d54c0aaf87", alt: "Light-filled apartment living area" },
      { image: "photo-1605146769289-440113cc3d00", alt: "Modern rental home exterior" },
    ],
    galleryLead: "Why the prepared application wins",
    galleryBody:
      "Good rentals in Adelaide are often decided within a day of the first inspection, and the deciding factor is rarely who arrived first. It is whose application the agent could actually assess: identity, income, and a reference from someone who picks up the phone. Having that ready before you inspect is worth more than seeing the property early.",
    pitch: {
      heading: "Tell us what you need,",
      headingEm: "before the next open",
      body: "Register your requirements and we will match them against what we are about to advertise. It costs nothing and it puts you ahead of the Saturday queue.",
      bullets: [
        "Photo identification, one hundred points between the applicants",
        "Proof of income, usually two recent payslips",
        "A reference from your last agent or landlord",
        "Pet details, including registration and desexing",
      ],
      cost: "The property you wanted usually goes to whoever was ready, not to whoever wanted it most.",
    },
  },

  "buyer-agent-adelaide": {
    cards: [
      {
        icon: "search",
        title: "Off-market access",
        body: "A meaningful share of Adelaide stock sells before it is advertised. Being on that list is most of what an advocate is for.",
      },
      {
        icon: "shield",
        title: "Inspected before you go",
        body: "Building condition assessed and the risks identified before you spend a Saturday on it, including the properties we reject.",
      },
      {
        icon: "people",
        title: "Paid by you, not the vendor",
        body: "A fixed fee agreed in advance, so it does not rise with the price we negotiate. An agent whose fee grows with what you pay is not on your side.",
      },
    ],
    gallery: [
      { image: "photo-1570129477492-45c003edd2be", alt: "Sandstone villa with a return verandah" },
      { image: "photo-1580587771525-78b9dba3b914", alt: "Terrace homes on a leafy Adelaide street" },
    ],
    galleryLead: "Everybody in the room is being paid by the other side",
    galleryBody:
      "A selling agent works for the vendor and is very good at it. If you are buying without your own representation, every professional in the transaction is paid by somebody whose interests are opposite to yours. That is not a scandal, it is just the structure, and the fix is to have someone on your side of the table.",
    pitch: {
      heading: "Stop losing",
      headingEm: "at auction",
      body: "Send us the brief and we will tell you honestly whether it is achievable at that budget in those suburbs. Where it is not, we will say what would have to change.",
      bullets: [
        "A shortlist against your brief, including off-market opportunities",
        "Building inspection coordination and risk assessment",
        "Comparable sales and what the vendor is likely to accept",
        "Bidding on your behalf, to a limit you set in advance",
      ],
      cost: "Missing out repeatedly costs more than the fee, in rising prices and in the Saturdays you will not get back.",
    },
  },

  "property-investment": {
    cards: [
      {
        icon: "chart",
        title: "Yield, growth or tax",
        body: "They pull in different directions, and which one leads decides the shortlist. That is the first question rather than the last.",
      },
      {
        icon: "map",
        title: "Street, not suburb",
        body: "Rental demand for the specific street, because the suburb median hides the side that backs onto a main road.",
      },
      {
        icon: "money",
        title: "Property and finance together",
        body: "Real estate combined with financial advising and finance broking, so the purchase suits the borrowing position it has to fit.",
      },
    ],
    gallery: [
      { image: "photo-1628624747186-a941c476b7ef", alt: "Investment property with established gardens" },
      { image: "photo-1512917774080-9991f1c4c750", alt: "Coastal apartment building in Adelaide" },
    ],
    galleryLead: "The costs nobody quotes",
    galleryBody:
      "The purchase price is the number everybody compares and the least useful one on its own. Rates, insurance, management, maintenance, the vacancy you should budget for and the interest across a full year are what decide whether a property is an investment or an expensive hobby. We will run all of it before you commit, and tell you when it does not stack up.",
    pitch: {
      heading: "Run the numbers",
      headingEm: "before you commit",
      body: "Tell us what you are investing for and we will come back with the analysis, in South Australia or overseas. We are paid for the guidance, so there is no version of this where the answer is always yes.",
      bullets: [
        "Whether the goal is growth, yield, a tax position, or a mix",
        "Rental demand for the street rather than the suburb average",
        "Holding costs across a full year, including the ones nobody quotes",
        "Finance structured alongside the purchase rather than after it",
      ],
      cost: "An investment bought on the wrong assumption is expensive to hold and slow to exit.",
    },
  },

  "land-opportunities-sa-adelaide": {
    cards: [
      {
        icon: "map",
        title: "Zoning before price",
        body: "What council will actually approve, checked before the offer. A block is only worth what you are allowed to do with it.",
      },
      {
        icon: "report",
        title: "Feasibility in writing",
        body: "Subdivision run with the council costs included, so the deep block that is worth twice its listing is distinguishable from the one that cannot be split.",
      },
      {
        icon: "clock",
        title: "Holding costs counted",
        body: "What it costs while you build, and what that does to the return. It is the line most first-time developers leave out.",
      },
    ],
    gallery: [
      { image: "photo-1600596542815-ffad4c1539a9", alt: "New build on a subdivided Adelaide block" },
      { image: "photo-1584738766473-61c083514bf4", alt: "Established block with mature trees" },
    ],
    galleryLead: "Two blocks that look identical from the street",
    galleryBody:
      "Frontage, easements, services, slope and zoning decide whether a block can be split, and none of them are in the advertisement. The deep block quietly worth twice its listing and the one that will never get approval photograph exactly the same. Knowing which you are standing on is the whole value of the guidance.",
    pitch: {
      heading: "Find out what you can",
      headingEm: "actually build",
      body: "Send us the area and what it is for. We will tell you what is available, what is coming, and what the zoning allows before you make an offer on any of it.",
      bullets: [
        "What the zoning allows and what council is likely to approve",
        "Subdivision feasibility with the council costs included",
        "Holding costs while you build, and the effect on return",
        "What is available now, and what we expect to come up",
      ],
      cost: "An offer made before the feasibility is a bet on an approval nobody has given you.",
    },
  },

  "sell-my-business-australia": {
    cards: [
      {
        icon: "lock",
        title: "Confidential by process",
        body: "The listing describes the business without identifying it, and buyers are qualified and under agreement before they see more.",
      },
      {
        icon: "report",
        title: "Valued on the books",
        body: "A price a buyer will actually underwrite, based on the financials rather than on what the business feels like it is worth.",
      },
      {
        icon: "people",
        title: "Buyers qualified first",
        body: "Nobody sees anything identifying until they have demonstrated they can complete. It protects the sale and the staff.",
      },
    ],
    gallery: [
      { image: "photo-1615873968403-89e068629265", alt: "Business premises interior" },
      { image: "photo-1600607687939-ce8a6c25118c", alt: "Meeting room in a small business" },
    ],
    galleryLead: "The leak that does the damage",
    galleryBody:
      "Staff, customers and suppliers finding out before you are ready is the risk that actually costs money, and it almost never comes from a leak. It comes from a careless advertisement that named the suburb, the trade and the turnover, which between them identify the business to anybody in the industry.",
    pitch: {
      heading: "Start the conversation",
      headingEm: "confidentially",
      body: "Nothing is advertised, and nothing is discussed with a buyer, without your say-so. The first conversation costs nothing and commits you to nothing.",
      bullets: [
        "A valuation based on the numbers a buyer will underwrite",
        "Buyers qualified before they see anything identifying",
        "Negotiation and contract support through to settlement",
        "Honest timing guidance, including when not to go to market yet",
      ],
      cost: "Going to market before the books are clean is the single biggest discount a seller applies to themselves.",
    },
  },

  "property-strategy-services": {
    cards: [
      {
        icon: "chart",
        title: "Decisions on data",
        body: "High-performing suburbs identified from the numbers, and rental demand analysed before you commit rather than after.",
      },
      {
        icon: "check",
        title: "Paid for the guidance",
        body: "Not for the transaction, so the recommendation can be that you do nothing for two years. Sometimes it is.",
      },
      {
        icon: "shield",
        title: "Risk before return",
        body: "Where a portfolio is concentrated and what that exposes you to, which is the question most owners only ask afterwards.",
      },
    ],
    gallery: [
      { image: "photo-1598928506311-c55ded91a20c", alt: "Interior of a well-held Adelaide property" },
      { image: "photo-1568605114967-8130f3a36994", alt: "Character home held as a long-term investment" },
    ],
    galleryLead: "The useful conversation happens earlier",
    galleryBody:
      "Most people arrive at an agent with the decision already made and only the execution left to discuss. The conversation worth having is the one before that, when holding, selling, subdividing and refinancing are all still on the table and the numbers can actually change the answer.",
    pitch: {
      heading: "Before you decide,",
      headingEm: "see the options",
      body: "Bring the portfolio or the decision you are weighing. You will get a written recommendation you could take to your accountant, including where the answer is to wait.",
      bullets: [
        "Hold or sell, run both ways with the costs noted",
        "Whether a deep block is worth subdividing",
        "Where a portfolio is concentrated, and the exposure that creates",
        "A written recommendation, not a verbal opinion",
      ],
      cost: "A decision made without the alternatives priced is a guess wearing a suit.",
    },
  },

  "overseas-investment": {
    cards: [
      {
        icon: "chart",
        title: "Compared on data",
        body: "Australia against Dubai on the figures rather than the brochure, so the comparison is one you can check.",
      },
      {
        icon: "money",
        title: "Dual expertise",
        body: "Real estate combined with financial advising and finance broking, so the property and the funding are handled as one problem.",
      },
      {
        icon: "check",
        title: "End to end",
        body: "From selection and market analysis through to finance and settlement, with somebody who has seen the property in person.",
      },
    ],
    gallery: [
      { image: "photo-1512917774080-9991f1c4c750", alt: "Waterfront apartment building" },
      { image: "photo-1628624747186-a941c476b7ef", alt: "Modern residential development" },
    ],
    galleryLead: "Buying sight unseen from another timezone",
    galleryBody:
      "Cross-border purchases carry approval, tax and currency questions a local one does not, and they change. The worst outcomes happen when nobody independent of the seller ever walked through the property. Somebody does, before you commit, and you get photographs of what is actually there.",
    pitch: {
      heading: "Register your",
      headingEm: "interest",
      body: "Tell us what you are investing for and when. We will send the portfolio and the market comparison, and registering commits you to nothing.",
      bullets: [
        "Approval requirements, and how long they take",
        "Duties and surcharges that apply to a foreign purchaser",
        "Rental demand for the building, not the city average",
        "Holding costs across a full year, in the currency you earn",
      ],
      cost: "Committing before the approval position is confirmed in writing is the mistake that carries real penalties.",
    },
  },

  "realestate-gift-adelaide": {
    cards: [
      {
        icon: "money",
        title: "Tax and finance included",
        body: "30% off an individual tax return, a free loan consultation and $200 cash-back on refinances, because the finance side of the business exists.",
      },
      {
        icon: "report",
        title: "The buying guide",
        body: "10 Truths About Finding the Right Home, written to help you avoid the traps rather than to advertise a listing.",
      },
      {
        icon: "check",
        title: "No obligation",
        body: "It goes to your inbox. There is no appointment attached and nothing to sign to receive it.",
      },
    ],
    gallery: [
      { image: "photo-1583847268964-b28dc8f51f92", alt: "Living room in a newly purchased home" },
      { image: "photo-1605276374104-dee2a0ed3cd6", alt: "Adelaide home exterior" },
    ],
    galleryLead: "Why an agency can offer this at all",
    galleryBody:
      "Most closing gifts are a bottle and a card. This one exists because the business already does finance broking and financial advising alongside the property side, so the borrowing power calculation and the loan consultation are things we do anyway. Handing them to clients costs us the time and saves them real money.",
    pitch: {
      heading: "Get on",
      headingEm: "the list",
      body: "Tell us what you are looking for and the bundle arrives by email. Financial and tax services are provided under the relevant licences and carry their own terms and eligibility.",
      bullets: [
        "30% off one individual tax return",
        "Free one-to-one loan consultation, and $200 cash-back on refinances",
        "Free borrowing power calculation and strategy",
        "The complete loan guide, and the home buying guide",
      ],
      cost: "Most buyers work out their borrowing power after they have fallen in love with a house.",
    },
  },
};

export const extrasFor = (slug: string): ServiceExtras | undefined => SERVICE_EXTRAS[slug];
