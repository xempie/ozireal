import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockView, ProjectGrid, groupProjects } from "@/components/public/blocks";
import { CtaBand } from "@/components/public/page-shell";
import { customPage } from "@/server/public/content";

/**
 * Pages created in the console's website editor.
 *
 * Every built-in route is a more specific match and wins, so this only ever sees paths
 * no code page owns. A path with no published (or, in preview, draft) page is a 404,
 * exactly as before this route existed.
 */

type Params = { params: Promise<{ slug: string[] }> };

const pathOf = (slug: string[]) => "/" + slug.map((s) => s.toLowerCase()).join("/");

/** Pages that close without the footer's appraisal banner (owner's request, 2026-10-29). */
const NO_FOOTER_CTA = new Set(["/new-homes-adelaide"]);

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const path = pathOf((await params).slug);
  const doc = await customPage(path);
  if (!doc) return {};
  const hero = doc.blocks.find((b) => b.type === "hero");
  return {
    title: doc.meta?.title ?? (hero?.type === "hero" ? hero.title : undefined),
    description: doc.meta?.description,
    alternates: { canonical: path },
  };
}

export default async function Page({ params }: Params) {
  const path = pathOf((await params).slug);
  const doc = await customPage(path);
  if (!doc) notFound();

  const hasCta = doc.blocks.some((b) => b.type === "cta" || b.type === "form");
  return (
    <>
      {/* Read by `.site:has(.no-foot-cta) .foot-cta` in public.css; the footer is in the layout. */}
      {NO_FOOTER_CTA.has(path) && <span className="no-foot-cta" hidden />}
      {groupProjects(doc.blocks).map((item) =>
        item.kind === "projects" ? (
          <ProjectGrid key={item.items[0].image.id} items={item.items} />
        ) : (
          <BlockView key={item.b.id} b={item.b} />
        ),
      )}
      {path === "/new-homes-adelaide" && (
        // Owner's request, 2026-10-31: anyone who has not found a fit goes to the buyer's agent brief.
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="nh-ba">
              <div>
                <p className="eyebrow">Haven&rsquo;t found the one?</p>
                <h2 className="display">
                  Let a buyer&rsquo;s agent <em>find it for you.</em>
                </h2>
                <p>
                  Tell us your suburbs, budget and must-haves. We search on-market,
                  pre-market and off-market, check every property before you visit, and
                  negotiate on your side.
                </p>
                <ul>
                  <li>Off-market access</li>
                  <li>You pay after you settle</li>
                </ul>
              </div>
              <a className="btn" href="/buyer-agent-adelaide#enquire">
                Send us your brief &rarr;
              </a>
            </div>
          </div>
        </section>
      )}
      {!hasCta && (
        <CtaBand
          heading="Talk to"
          headingEm="the office"
          label="Contact us"
          href="/contact"
        />
      )}
    </>
  );
}
