import Link from "next/link";
import { notFound } from "next/navigation";
import { getBuildingCheck } from "@/server/queries/building-checks";
import { CONTEXTS } from "@/lib/building-check";
import { shortDate } from "@/lib/utils";
import { Findings, LiveStatus, ReportActions } from "@/components/building-check/report";

/**
 * A building check's report (2026-11-11): the answer first (headline and four tiles),
 * then the findings, then era and compliance, the gaps and the specialists. Prints as
 * a clean client PDF from the browser.
 */

const COMPLIANCE = {
  met: { label: "Met", cls: "text-[#0B7A55]" },
  not_met: { label: "Not met", cls: "text-[#A12A12]" },
  unverifiable: { label: "Unverifiable", cls: "text-[#8A4B00]" },
  not_applicable: { label: "N/A", cls: "text-3" },
} as const;

export default async function BuildingCheckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getBuildingCheck(id);
  if (!c) notFound();
  const ctx = CONTEXTS.find((x) => x.key === c.context)?.title ?? c.context;
  const r = c.result;
  const aud = (n: number) => `$${n.toLocaleString("en-AU")}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2 text-[12.5px]">
            <Link href="/building-checks" className="hover:underline print:hidden">
              Building checks
            </Link>
            <span className="print:hidden"> › </span>
            {shortDate(c.createdAt)} · {ctx} · {c.photos.length} photos
            {c.propertyId && (
              <>
                {" · "}
                <Link href={`/properties/${c.propertyId}`} className="hover:underline">
                  open the property
                </Link>
              </>
            )}
          </p>
          <h1 className="text-[22px] sm:text-[26px] font-semibold leading-tight mt-1">{c.title} — condition read</h1>
        </div>
        <ReportActions checkId={c.id} status={c.status} />
      </div>

      <LiveStatus status={c.status} />

      {c.status === "failed" && (
        <div role="alert" className="rounded-xl border border-[#F2C6B6] bg-[#FDECEA] p-4 text-[13.5px] text-[#6B2A1A]">
          <strong>The check didn&rsquo;t finish.</strong> {c.error ?? "Something went wrong."} Try Re-run; if it keeps failing,
          fewer or clearer photos usually help.
        </div>
      )}

      {r && c.status !== "queued" && c.status !== "running" && (
        <>
          <p className="text-[16px] sm:text-[17px] leading-relaxed max-w-[900px]">{r.headline}</p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-[#F2C6B6] bg-[#FDECEA] p-4">
              <div className="text-[12.5px] font-bold text-[#A12A12]">RED · act now</div>
              <div className="text-[30px] font-extrabold text-[#A12A12] leading-tight">{c.red}</div>
              <div className="text-[12px] text-[#6B2A1A]">structural · safety</div>
            </div>
            <div className="rounded-xl border border-[#F3D9A8] bg-[#FFF4E5] p-4">
              <div className="text-[12.5px] font-bold text-[#8A4B00]">AMBER · budget / negotiate</div>
              <div className="text-[30px] font-extrabold text-[#8A4B00] leading-tight">{c.amber}</div>
              <div className="text-[12px] text-[#6B4A00]">manageable</div>
            </div>
            <div className="rounded-xl border border-[#BFE5CF] bg-[#E8F6EE] p-4">
              <div className="text-[12.5px] font-bold text-[#1B6B3F]">GREEN · cosmetic</div>
              <div className="text-[30px] font-extrabold text-[#1B6B3F] leading-tight">{c.green}</div>
              <div className="text-[12px] text-[#1B4F33]">noted for completeness</div>
            </div>
            <div className="rounded-xl surface-2 border p-4">
              <div className="text-[12.5px] font-bold text-2">Indicative cost (red + amber)</div>
              <div className="text-[22px] font-extrabold leading-tight mt-1 tabular">
                {c.costHigh ? `${aud(c.costLow)} – ${aud(c.costHigh)}` : "—"}
              </div>
              <div className="text-[12px] text-2">Adelaide bands · not a quote</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1.65fr_1fr] gap-5 items-start">
            <Findings checkId={c.id} result={r} />

            <aside className="space-y-4">
              <section className="surface-2 border rounded-xl p-4 space-y-2 break-inside-avoid">
                <h2 className="text-[14px] font-semibold">Era &amp; SA compliance</h2>
                <p className="text-[13px]">
                  <strong>{r.era.estimate}</strong>
                  {r.era.cues ? ` (${r.era.cues})` : ""}: {r.era.implications}
                </p>
                <ul className="divide-y text-[13px]">
                  {r.compliance.map((x) => (
                    <li key={x.item} className="py-1.5">
                      <div className="flex justify-between gap-3">
                        <span>{x.item}</span>
                        <span className={`font-semibold whitespace-nowrap ${COMPLIANCE[x.status].cls}`}>
                          {COMPLIANCE[x.status].label}
                        </span>
                      </div>
                      {x.note && <p className="text-2 text-[12px]">{x.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>

              {r.missing.length > 0 && (
                <section className="rounded-xl border border-[#F3D9A8] bg-[#FFF7E0] p-4 space-y-1.5 break-inside-avoid">
                  <h2 className="text-[14px] font-semibold">Not photographed — get these</h2>
                  <ol className="list-decimal pl-5 space-y-1 text-[13px]">
                    {r.missing.map((m) => (
                      <li key={m.area}>
                        <strong>{m.area}</strong>: {m.why}
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              {r.specialists.length > 0 && (
                <section className="surface-2 border rounded-xl p-4 space-y-1.5 break-inside-avoid">
                  <h2 className="text-[14px] font-semibold">Specialists worth engaging</h2>
                  <ul className="space-y-1 text-[13px]">
                    {r.specialists.map((s) => (
                      <li key={s.trade}>
                        <strong>{s.trade}</strong> — {s.for}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {c.notes && (
                <section className="surface-2 border rounded-xl p-4 text-[13px] print:hidden">
                  <h2 className="text-[14px] font-semibold mb-1">Your notes</h2>
                  {c.notes}
                </section>
              )}
            </aside>
          </div>

          <p className="text-[11.5px] text-2">
            Photo-based assessment only. Not a substitute for a licensed building and pest inspection. Ozi Realty RLA 350628.
          </p>
        </>
      )}
    </div>
  );
}
