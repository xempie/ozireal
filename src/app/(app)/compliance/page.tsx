import { Scale, SearchX, Send } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Callout,
  ProtoNote,
  Empty,
} from "@/components/ui";
import { getAgency } from "@/server/queries";

export default async function CompliancePage() {
  const agency = await getAgency();

  /**
   * The retrieval pipeline, as a shape.
   *
   * The steps are fixed (§7): filter by jurisdiction, then exact wording, then meaning,
   * merge, rerank. The counts belong to a query that has been run, and there is nothing
   * to run one against yet — the corpus is empty until D6 is signed off — so each step
   * renders an em dash rather than a number nobody measured.
   */
  const retrievalSteps = [
    `Filtered to ${agency.jurisdiction}`,
    "Exact wording search",
    "Meaning search",
    "Merged",
    "Reranked",
  ];

  return (
    <>
      <PageHeader
        title="Compliance advisor"
        subtitle="Research support for South Australian agency legislation. It cites, or it stays silent."
        actions={<Badge tone="brand">{agency.jurisdiction}</Badge>}
      />

      <div className="mb-6">
        <Callout tone="queue" title="What this is, and what it is not">
          Every answer carries the jurisdiction, instrument and section it came from, and
          is framed as research to verify with a licensee or solicitor. It never renders
          a ruling. If retrieval finds nothing relevant, it says so rather than
          improvising.
        </Callout>
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-2 surface-3 border rounded-md px-3 py-2.5">
          <Scale size={15} className="text-3 shrink-0" />
          <span className="text-3 text-[13px] flex-1">
            Ask a question about {agency.jurisdiction} agency legislation
          </span>
          <Send size={14} className="text-3 shrink-0" />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2">
          <span className="text-3 text-[11.5px]">Jurisdiction</span>
          <Badge tone="brand">{agency.jurisdiction}</Badge>
          <span className="text-3 text-[11.5px] basis-full sm:basis-auto">
            filtered before retrieval, so another state&apos;s rules cannot surface
          </span>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6 min-w-0">
          <Card>
            <CardTitle>Answer</CardTitle>
            <Empty>No answer yet — nothing has been asked.</Empty>
          </Card>

          <Section title="Citations" hint="mandatory on every answer">
            <Empty>No citations yet.</Empty>
            <ProtoNote>
              The version date is why the corpus is re-crawled monthly. A silent
              amendment to a cited section is the main way a tool like this becomes
              wrong.
            </ProtoNote>
          </Section>

          <Section title="When nothing matches" hint="the state that keeps it honest">
            <Card className="border-[#d03b3b]/35 bg-[#d03b3b]/[0.03]">
              <div className="flex items-start gap-2.5">
                <SearchX
                  size={15}
                  className="text-[#b02f2f] dark:text-[#f08a8a] mt-0.5 shrink-0"
                />
                <div>
                  <div className="text-[13px] font-medium">Nothing relevant found</div>
                  <p className="text-2 text-[12.5px] mt-1 leading-relaxed">
                    The corpus holds South Australian and federal instruments only. A
                    question about Queensland stamp duty is outside it, so no answer is
                    given — rather than an answer assembled from something adjacent.
                  </p>
                </div>
              </div>
            </Card>
          </Section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>How this answer was retrieved</CardTitle>
            <ol className="space-y-2.5 text-[12.5px]">
              {retrievalSteps.map((label, i) => (
                <li key={label} className="flex items-baseline gap-2.5">
                  <span className="h-4 w-4 rounded-full surface-3 border grid place-items-center text-[10px] font-semibold shrink-0 tabular">
                    {i + 1}
                  </span>
                  <span className="flex-1">{label}</span>
                  <span className="text-3 tabular text-[12px]">—</span>
                </li>
              ))}
            </ol>
            <ProtoNote>
              Two searches, not one. Legislation needs exact terms — “Form 1”,
              “cooling-off” — and paraphrase at the same time.
            </ProtoNote>
          </Card>

          <Card>
            <CardTitle>Corpus status</CardTitle>
            <div className="text-[12.5px] text-2 space-y-1.5">
              <div className="flex justify-between gap-3">
                <span>Instruments held</span>
                <span className="tabular">—</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>Last re-crawl</span>
                <span className="tabular">—</span>
              </div>
            </div>
            <div className="mt-3">
              <Callout tone="blocked" title="Phase 4 is blocked">
                The corpus is empty because the source list and the licence for each
                register have not been signed off yet (D6). Everything on this screen is
                an illustration of the shape, not a working advisor.
              </Callout>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
