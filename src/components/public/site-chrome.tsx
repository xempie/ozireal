import Link from "next/link";
import Image from "next/image";
import { SiteNav } from "./site-nav";
import { AGENCY, EMAILS } from "./agency";

/**
 * The public site's utility bar and footer.
 *
 * The nav is a client island in `site-nav.tsx`, because the mobile drawer and the
 * scrolled state both need state. Its links are server-rendered inside it, so a crawler
 * and the first paint see the whole menu whether the drawer is open or shut.
 *
 * ## What changed here, and why it mattered
 *
 * The utility bar used to say "Prospect & Glenelg" and the footer carried a second
 * address on Jetty Road. Both came from the design template. OziRealty has one office,
 * at 308 Prospect Rd, and advertising a branch that does not exist is not a placeholder,
 * it is a false statement about where a licensed agency operates.
 *
 * The agency's details now come from `agency.ts`, which holds what the live site says.
 * They are still hardcoded rather than read from the database: `tenants` carries name,
 * trading name, ABN, licence and jurisdiction, and no phone, email or address at all.
 * A `site_settings` row replaces this file's constants later.
 */

export { AGENCY } from "./agency";

/**
 * The wordmark, served from our own origin.
 *
 * It used to point at static.wixstatic.com, which was fine for review and wrong for
 * launch: the file disappears the day the Wix account lapses, and the agency's brand mark
 * sat outside its own control. `public/brand/logo.png` is the same asset, downloaded.
 *
 * Still a PNG with a white box baked behind the wordmark, which is why the stylesheet
 * blends it (multiply on the light nav, screen on the dark footer). A vector would remove
 * that hack; `assets/brand/README.md` has been asking for one since B0.
 */
const LOGO = "/brand/logo.png";

export function SiteHeader() {
  return (
    <>
      <div className="utility">
        <div className="wrap">
          <div>
            Licence Number: {AGENCY.licence}
          </div>
          <div className="u-right">
            <span>Property Management From 2.99%</span>
            <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
          </div>
        </div>
      </div>

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
            Your property journey
            <br />
            <em>starts here.</em>
          </h2>
          <Link className="btn" href="/free-property-appraisal-sa">
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
            </p>
            <p className="foot-blurb">
              Licence Number: {AGENCY.licence}
              <br />
              ABN: {AGENCY.abn}
            </p>
          </div>

          {/*
            Real routes, mirroring www.ozirealty.com.au. See site-pages.ts for the slug
            rationale, and site-nav.tsx for why two of them differ from the live spelling.
          */}
          <div>
            <h4>Quick Links</h4>
            <ul>
              <li><Link href="/">Home</Link></li>
              <li><Link href="/property-services">Services</Link></li>
              <li><Link href="/property-strategy-services">Strategy Services</Link></li>
              <li><Link href="/overseas-investment">Oversea Investment</Link></li>
              <li><Link href="/free-property-appraisal-sa">Free Appraisal</Link></li>
              <li><Link href="/about-adelaide-land-agent">About</Link></li>
            </ul>
          </div>

          <div>
            <h4>More</h4>
            <ul>
              <li><Link href="/contact">Contact Us</Link></li>
              <li><Link href="/book-online">Free Meeting</Link></li>
              <li><Link href="/realestate-gift-adelaide">Gift Party</Link></li>
              <li><Link href="/blog">Blog</Link></li>
              <li><Link href="/adelaide-property-faq">FAQ</Link></li>
              <li><Link href="/sold">Recently sold</Link></li>
            </ul>
          </div>

          {/*
            One address per department, as the live site lists them. An enquiry sent to
            the right desk is the cheapest routing the agency has.
          */}
          <div>
            <h4>Emails</h4>
            <ul>
              {EMAILS.map((e) => (
                <li key={e.address}>
                  <a href={`mailto:${e.address}`}>{e.address}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="foot-bar">
          <span>
            &copy; {new Date().getFullYear()} {AGENCY.name}. All rights reserved.
          </span>
          {/*
            Plain text until /privacy and /complaints exist. A policy link that 404s is
            worse than none, and these are the pages a regulator looks for.
          */}
          <span>Privacy &middot; Complaints</span>
        </div>
      </div>
    </footer>
  );
}
