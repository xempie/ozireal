import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "./site-nav";
import { OPEN_HOMES } from "./demo-data";

/**
 * The public site's utility bar, nav and footer, from the supplied template.
 *
 * The utility bar and footer are server components with no interactivity. The nav is
 * not: on a phone it is a drawer behind a burger, which needs state, so it lives in
 * `site-nav.tsx` as the one client island on the public site. Its links are still
 * server-rendered inside it, so the crawler and the first paint see the whole menu
 * whether the drawer is open or shut.
 *
 * The agency's details are hardcoded and marked. `tenants` carries name, trading name,
 * ABN, licence and jurisdiction — and no phone, email or address at all. Stage 3 adds a
 * `site_settings` row and this file reads it instead.
 */

export const AGENCY = {
  name: "Ozi Realty",
  phone: "1800 400 333",
  phoneHref: "tel:1800400333",
  email: "support@ozirealty.com.au",
  office: "308 Prospect Road, Prospect SA 5082",
  licence: "RLA 350 628",
  abn: "14 682 825 449",
} as const;

/**
 * The wordmark, served from the Wix CDN the current site uses.
 *
 * It is the first real brand asset this project has had — `assets/brand/README.md` has
 * been asking for a vector since B0 and nothing ever arrived. Pointing at somebody
 * else's CDN is fine for review and wrong for launch: it is a PNG with a white box baked
 * behind it (hence the blend modes in the stylesheet), and it disappears the day the Wix
 * account lapses. The SVG belongs in the repo before cutover.
 */
const LOGO =
  "https://static.wixstatic.com/media/160674_f4475077d64f463b9fc5aac5b1632930~mv2.png/v1/fill/w_227,h_35,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/OZI%20logo%20(1).png";

export function SiteHeader() {
  return (
    <>
      <div className="utility">
        <div className="wrap">
          <div>
            {AGENCY.licence}
            <span className="dot">/</span>
            Prospect &amp; Glenelg
          </div>
          <div className="u-right">
            <span>Inspections run Sat 10&ndash;12</span>
            <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
          </div>
        </div>
      </div>

      {/*
        The nav itself. It knows the current path and whether the page has scrolled, so
        it is a client component — see site-nav.tsx for why each of those is needed.
      */}
      <SiteNav logo={LOGO} agencyName={AGENCY.name} />
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-cta">
          <h2>
            Come and see
            <br />
            what your street is <em>doing.</em>
          </h2>
          <Link className="btn" href="#appraise">
            Book a free appraisal
          </Link>
        </div>

        <div className="foot-cols">
          <div>
            <span className="brand brand--light">
              <Image
                src={LOGO}
                alt={AGENCY.name}
                width={227}
                height={35}
                style={{ height: 34, width: "auto" }}
              />
            </span>
            <p className="foot-blurb">{AGENCY.office}</p>
            <p className="foot-blurb">
              <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
              <br />
              <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
            </p>
          </div>

          {/*
            On-page anchors for the same reason as the nav in site-nav.tsx: /for-sale,
            /sold, /suburbs and the rest are not built yet, and a footer full of 404s
            reads as a broken site. Each reverts to its real href as the route lands.
          */}
          <div>
            <h4>Property</h4>
            <ul>
              <li><Link href="#listings">Buy</Link></li>
              <li><Link href="#listings">Rent</Link></li>
              <li><Link href="#appraise">Sell</Link></li>
              <li><Link href="#services">Property management</Link></li>
              <li><Link href="#listings">Recently sold</Link></li>
            </ul>
          </div>

          <div>
            <h4>Company</h4>
            <ul>
              <li><Link href="#services">Our services</Link></li>
              <li><Link href="#suburbs">Suburb reports</Link></li>
              <li><Link href="#journal">Journal</Link></li>
              <li><Link href="#appraise">Contact</Link></li>
            </ul>
          </div>

          {/*
            The template's fourth column. Sample data — these open homes are invented,
            and the column comes out with demo-data.ts when real inspections are wired
            in. The contact details it replaced are already in the first column.
          */}
          <div>
            <h4>Saturday openings</h4>
            <ul>
              {OPEN_HOMES.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="foot-bar">
          <span>
            &copy; {new Date().getFullYear()} {AGENCY.name} &middot; {AGENCY.licence} &middot; ABN{" "}
            {AGENCY.abn}
          </span>
          {/* Plain text until /privacy and /complaints exist — a policy link that 404s
              is worse than none, and these are the pages a regulator looks for. */}
          <span>Privacy &middot; Complaints &middot; Member REISA</span>
        </div>
      </div>
    </footer>
  );
}
