import Link from "next/link";

/**
 * The services, as cards with icons.
 *
 * `/property-services` was points-and-prose, which is the wrong shape for a page whose
 * whole job is to send someone to the right service. This is a grid: an icon, the
 * agency's own label for the service, a line saying what it is, and a link straight to
 * the page that carries that service's enquiry form.
 *
 * ## Why the icons are inline SVG
 *
 * No icon font, no sprite, no library. Eight small paths inline cost nothing, need no
 * extra request, inherit `currentColor` so they follow the card's hover state for free,
 * and cannot arrive late and shift the layout. They are `aria-hidden` because the label
 * beside them already says what the service is: announcing "house icon, Sell My Property"
 * is noise.
 *
 * Stroke, 1.5, round joins, matching the bed/bath/car icons already on the listing cards.
 * The set has to look like one hand drew it, which mostly means resisting detail.
 */

type IconProps = { className?: string };

/*
  Four of these were house variants, and at 26px a house-with-a-tag and a
  house-with-a-magnifier are the same picture. Only the two that are genuinely ABOUT a
  house keep one; the rest use the object the service actually turns on: a clipboard for
  reporting, a key for letting, a chart for yield, a plot for land, a storefront for a
  business. Distinct silhouettes beat literal ones at this size.
*/

const Sell = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10.5V20h13v-9.5" />
    <path d="M12 17.5v-6" />
    <path d="m9.5 14 2.5-2.5 2.5 2.5" />
  </svg>
);

const Manage = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M6 4h12v17H6z" />
    <path d="M9.5 4V2.8h5V4z" />
    <path d="m9 11.5 2 2 4-4" />
    <path d="M9 17h6" />
  </svg>
);

const RentOut = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10.5V20h13v-9.5" />
    <circle cx="10" cy="15" r="1.8" />
    <path d="M11.8 15H16M14.5 15v2" />
  </svg>
);

const BuyerAgent = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
    <path d="M7.5 11 10.5 8l3 3" />
    <path d="M8.7 10v3h3.6v-3" />
  </svg>
);

const Invest = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M3 20h18" />
    <path d="M6.5 20v-5M11 20v-8M15.5 20v-4M20 20V7" />
    <path d="m4 11 5-4 4 3 6-5.5" />
    <path d="M16 4.5h3.5V8" />
  </svg>
);

const Land = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="m3 8 9-4 9 4-9 4z" />
    <path d="M3 8v8l9 4 9-4V8" />
    <path d="M12 12v8" />
  </svg>
);

const Rent = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <circle cx="7.5" cy="7.5" r="3.5" />
    <path d="M10 10 20 20" />
    <path d="m17 17 2.5-2.5M14.5 14.5 17 12" />
  </svg>
);

const Business = (p: IconProps) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path d="M4.5 10.5V20h15v-9.5" />
    <path d="M3 7.5 4.5 4h15L21 7.5" />
    <path d="M3 7.5c0 1.4 1 2.4 2.25 2.4S7.5 8.9 7.5 7.5c0 1.4 1 2.4 2.25 2.4S12 8.9 12 7.5c0 1.4 1 2.4 2.25 2.4s2.25-1 2.25-2.4c0 1.4 1 2.4 2.25 2.4S21 8.9 21 7.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export interface Service {
  label: string;
  blurb: string;
  href: string;
  Icon: (p: IconProps) => React.JSX.Element;
  /** True when the destination carries an enquiry form. */
  form: boolean;
}

/**
 * The agency's own labels, from the services row on www.ozirealty.com.au, pointed at the
 * pages that answer them. Every one of these destinations has its own enquiry form.
 */
export const SERVICES: Service[] = [
  {
    label: "Sell My Property",
    blurb: "A free appraisal report with the comparable sales behind it, then a campaign built on the numbers.",
    href: "/sell-property-house-adelaide",
    Icon: Sell,
    form: true,
  },
  {
    label: "Manage My Property",
    blurb: "From 2.99%, capped, with 100 days risk-free and no middle man between you and the principal.",
    href: "/manage-property-adelaide",
    Icon: Manage,
    form: true,
  },
  {
    label: "Rent Out My Property",
    blurb: "A rental appraisal, a pricing strategy that minimises vacancy, and careful tenant screening.",
    href: "/rent-out-my-property-adelaide",
    Icon: RentOut,
    form: true,
  },
  {
    label: "I Need A Buyer Agent",
    blurb: "Search, inspection, valuation and negotiation, including properties that never reach the portals.",
    href: "/buyer-agent-adelaide",
    Icon: BuyerAgent,
    form: true,
  },
  {
    label: "I Want to Invest",
    blurb: "Yield, growth and holding costs across a full year, in South Australia or overseas.",
    href: "/property-investment",
    Icon: Invest,
    form: true,
  },
  {
    label: "Looking For Land",
    blurb: "What the zoning allows and what council will approve, assessed before the price.",
    href: "/land-opportunities-sa-adelaide",
    Icon: Land,
    form: true,
  },
  {
    label: "I Need To Rent",
    blurb: "Register your requirements and hear about the right properties before the open.",
    href: "/rent-property-house-adelaide",
    Icon: Rent,
    form: true,
  },
  {
    label: "Sell My Business",
    blurb: "Confidential from the first conversation. Buyers qualified before they see anything identifying.",
    href: "/sell-my-business-australia",
    Icon: Business,
    form: true,
  },
];

export function ServiceGrid({ services = SERVICES }: { services?: Service[] }) {
  return (
    <div className="svc-grid">
      {services.map((s) => (
        <Link className="svc-card" key={s.label} href={s.href}>
          <span className="svc-card-icon">
            <s.Icon />
          </span>
          <h3>{s.label}</h3>
          <p>{s.blurb}</p>
          <span className="svc-card-go">
            {s.form ? "Start an enquiry" : "Read more"}{" "}
            <span aria-hidden="true">&rarr;</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
