import Link from "next/link";
import { Plus, Instagram, Facebook, Linkedin, Eye, ShieldCheck } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  Callout,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { getBlogPosts, getSocialPosts, getContentTotals } from "@/server/queries";
import { relative, shortDate } from "@/lib/utils";

const statusTone: Record<string, "neutral" | "queue" | "sent"> = {
  draft: "neutral",
  in_approval: "queue",
  published: "sent",
  archived: "neutral",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  in_approval: "In approval",
  published: "Published",
  archived: "Archived",
};

const networkIcon = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
} as const;

const networkLabel = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
} as const;

export default async function ContentPage() {
  const [blogPosts, socialPosts, totals] = await Promise.all([
    getBlogPosts(),
    getSocialPosts(),
    getContentTotals(),
  ]);

  return (
    <>
      <PageHeader
        title="Content & social"
        subtitle="Articles and social posts in the agency's voice. Every one of them is approved by a human before it publishes."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New draft
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Published articles
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">{totals.published}</div>
          <div className="text-3 text-[11.5px]">{totals.legacy} migrated from Wix</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Views, 30 days
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {totals.views.toLocaleString()}
          </div>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardTitle>Publishing and readership</CardTitle>
          {/* views_30d is a current rollup, not a stored series - there is no month by
              month history to plot yet, so the panel says so rather than inventing one. */}
          <Empty>No readership history yet</Empty>
        </Card>
      </div>

      <div className="mb-6">
        <Callout tone="queue" title="The blog is a migration, not a fresh start">
          51 posts already exist on the Wix site and keep their /post/ addresses exactly.
          Rewriting those URLs would throw away the rankings they have earned — the whole
          reason the archive is worth carrying across.
        </Callout>
      </div>

      <Section title="Articles">
        <Table minWidth={900}>
          <THead>
            <TR>
              <TH>Title</TH>
              <TH>URL</TH>
              <TH>Status</TH>
              <TH className="text-right">Words</TH>
              <TH className="text-right">Views 30d</TH>
              <TH>Updated</TH>
              <TH></TH>
            </TR>
          </THead>
          <tbody>
            {blogPosts.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium min-w-[240px]">
                  {p.title}
                  {p.legacy && (
                    <Badge tone="neutral" className="ml-2">
                      migrated
                    </Badge>
                  )}
                </TD>
                <TD className="font-mono text-[11.5px] text-2 max-w-[260px] truncate">
                  /post/{p.slug}
                </TD>
                <TD>
                  <Badge tone={statusTone[p.status] ?? "neutral"}>
                    {statusLabel[p.status] ?? p.status}
                  </Badge>
                </TD>
                <TD className="text-right tabular text-2">{p.words ?? "—"}</TD>
                <TD className="text-right tabular text-2">
                  {p.views30d ? p.views30d.toLocaleString() : "—"}
                </TD>
                <TD className="text-2 whitespace-nowrap">
                  {p.publishedAt ? shortDate(p.publishedAt) : relative(p.createdAt)}
                </TD>
                <TD className="text-right">
                  {p.status === "in_approval" ? (
                    <Button size="sm" variant="primary">
                      <ShieldCheck size={11} />
                      Review
                    </Button>
                  ) : (
                    <Button size="sm">
                      <Eye size={11} />
                      Open
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
        <ProtoNote>
          The weekly draft is generated by a repeatable job using the Batch API — it is
          not time-sensitive, so it runs at roughly half price.
        </ProtoNote>
      </Section>

      <Section title="Social">
        <div className="grid md:grid-cols-3 gap-3">
          {socialPosts.map((s) => {
            const Icon = networkIcon[s.network];
            return (
              <Card key={s.id}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className="text-3" />
                  <span className="text-[12.5px] font-semibold">
                    {networkLabel[s.network]}
                  </span>
                  <Badge tone={statusTone[s.status] ?? "neutral"} className="ml-auto">
                    {statusLabel[s.status] ?? s.status}
                  </Badge>
                </div>
                <p className="text-[12.5px] leading-relaxed">{s.body}</p>
                {s.listingId && s.address && (
                  <Link
                    href={`/listings/${s.listingId}`}
                    className="text-[11.5px] text-2 hover:underline underline-offset-2 block mt-2"
                  >
                    {s.address}
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                  <span className="text-3 text-[11.5px]">
                    {s.status === "published"
                      ? `${s.engagement} interactions`
                      : relative(s.createdAt)}
                  </span>
                  {s.status === "in_approval" && (
                    <Button size="sm" variant="primary" className="ml-auto">
                      Review
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
        <ProtoNote>
          Networks are not chosen yet (D7), so these are illustrative. Whichever are
          picked, outbound social is still gated by the approval queue.
        </ProtoNote>
      </Section>
    </>
  );
}
