import type { Metadata } from "next";
import { readUnsubscribeToken, isUnsubscribed } from "@/server/outbound/unsubscribe";
import { AGENCY } from "@/components/public/agency";

/**
 * The unsubscribe page every marketing email links to (Spam Act, §10). One button, no
 * login. Opening the page does not unsubscribe by itself: mail scanners open links, and a
 * person should not lose emails because their antivirus clicked one.
 */

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; done?: string }>;
}) {
  const sp = await searchParams;
  const t = sp.t ? readUnsubscribeToken(sp.t) : null;
  const already = t ? await isUnsubscribed(t) : false;
  const done = sp.done === "1" || already;

  return (
    <section className="sec">
      <div className="wrap" style={{ maxWidth: 560, textAlign: "center", padding: "40px 0" }}>
        {done ? (
          <>
            <h1>You are unsubscribed</h1>
            <p className="lede">
              You will not receive marketing emails from Ozi Realty again. If this was a mistake, call{" "}
              <a href={AGENCY.phoneHref}>{AGENCY.phone}</a> and we will put it back.
            </p>
          </>
        ) : !t ? (
          <>
            <h1>This link has expired or is incomplete</h1>
            <p className="lede">
              To stop our emails, reply to any of them with &ldquo;unsubscribe&rdquo; or call{" "}
              <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>.
            </p>
          </>
        ) : (
          <>
            <h1>Stop our emails?</h1>
            <p className="lede">Press the button and you will not receive marketing emails from Ozi Realty again.</p>
            <form method="post" action={`/api/unsubscribe?t=${encodeURIComponent(sp.t!)}`} style={{ marginTop: 20 }}>
              <button type="submit" className="btn">
                Unsubscribe
              </button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}
