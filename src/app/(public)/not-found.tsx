import Link from "next/link";
import { AGENCY } from "@/components/public/site-chrome";

/**
 * The public 404.
 *
 * It matters more here than on most sites. The Wix migration retires 22 page addresses
 * and re-keys four property URLs, so for a while every miss is either a redirect that
 * has not been written yet or a listing that has settled. Both of those people are worth
 * catching, and neither is helped by the word "Error".
 *
 * So: no apology, no code, and two routes onward — the search, and a phone number.
 */
export default function NotFound() {
  return (
    <section className="hero">
      <div className="site-wrap">
        <p className="eyebrow">That page has moved or sold</p>
        <h1>We could not find that one</h1>
        <p className="sub">
          Properties come off the market and pages get renamed. If you were looking at a
          particular home it may have sold — the archive keeps every one we have sold.
        </p>

        <div className="paths" style={{ marginTop: "2rem" }}>
          <Link href="/for-sale" className="path feature">
            <span className="t">Homes for sale</span>
            <span className="d">Everything on the market right now.</span>
            <span className="go">Browse &rarr;</span>
          </Link>
          <Link href="/sold" className="path">
            <span className="t">Recently sold</span>
            <span className="d">If it settled, it is still here with its result.</span>
            <span className="go">See the archive &rarr;</span>
          </Link>
          <a href={AGENCY.phoneHref} className="path">
            <span className="t">Just ask us</span>
            <span className="d">
              {AGENCY.phone} — we usually know what is coming before it is advertised.
            </span>
            <span className="go">Call the office &rarr;</span>
          </a>
        </div>
      </div>
    </section>
  );
}
