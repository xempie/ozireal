import Link from "next/link";
import {
  Globe,
  ExternalLink,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
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
import { getRedirects, getSuburbPages, getListings } from "@/server/queries";
import { relative } from "@/lib/utils";

const redirectTone = {
  mapped: "sent",
  undecided: "queue",
  blocked: "blocked",
} as const;

export default async function WebsitePage() {
  const [redirects, suburbPages, listings] = await Promise.all([
    getRedirects(),
    getSuburbPages(),
    getListings(),
  ]);
  const mapped = redirects.filter((r) => r.status === "mapped").length;
  const live = listings.filter((l) => l.status === "live");

  return (
    <>
      <PageHeader
        title="Public site"
        subtitle="www.ozirealty.com.au — currently served by Wix. This is the migration console for taking it over."
        actions={
          <Button>
            <ExternalLink size={13} />
            View live site
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Migration readiness
          </div>
          {/* The cutover checklist is not a table yet, so there is nothing to count.
              A progress bar drawn from nothing would read as "not started". */}
          <div className="text-[26px] font-semibold tabular mt-1">—</div>
          <div className="text-3 text-[11.5px]">No checklist yet</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Redirects mapped
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {mapped}/{redirects.length}
          </div>
          <div className="text-3 text-[11.5px]">
            {redirects.length - mapped} still undecided
          </div>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-2">
          <CardTitle>Traffic on the live site</CardTitle>
          {/* views_7d is a rolling counter on each listing, not a stored weekly series,
              so there is no history to plot until the public site reports it. */}
          <Empty>No traffic history yet</Empty>
        </Card>
      </div>

      <div className="mb-6">
        <Callout tone="blocked" title="One live thing still needs a decision">
          <strong>/book-online</strong> takes real appointments through Wix Bookings
          today. Phase 2B has no public booking feature and the calendar is Phase 3.
          Either the new site gains a booking form, or that page keeps pointing at Wix
          past cutover. Left undecided, a working source of appointments disappears on
          switch-over day.
        </Callout>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Cutover checklist">
          <Empty>No checklist yet</Empty>
          <ProtoNote>
            Search Console has to be verified and today&apos;s rankings captured{" "}
            <em>before</em> the switch, so any drop afterwards is a measurable fact rather
            than an argument.
          </ProtoNote>
        </Section>

        <Section title="Live listings on the site">
          <Card padded={false} className="p-0">
            {live.map((l) => (
              <div key={l.id} className="p-3 border-b last:border-b-0">
                <div className="flex items-center gap-2">
                  <Globe size={12} className="text-3 shrink-0" />
                  <Link
                    href={`/listings/${l.id}`}
                    className="text-[12.5px] font-medium hover:underline underline-offset-2"
                  >
                    {l.address}
                  </Link>
                  <Badge tone="sent" className="ml-auto">
                    <RefreshCw size={9} />
                    live
                  </Badge>
                </div>
                <div className="font-mono text-[11px] text-3 mt-1 truncate">
                  /{l.type === "rent" ? "for-rent" : "for-sale"}/{l.slug}
                </div>
                <div className="text-3 text-[11.5px] mt-0.5">
                  published {l.publishedAt ? relative(l.publishedAt) : "—"} ·{" "}
                  {l.views7d} views this week
                </div>
              </div>
            ))}
          </Card>
        </Section>
      </div>

      <Section title="Redirect map" hint="every old URL needs a destination before cutover">
        <Table>
          <THead>
            <TR>
              <TH>Current URL on Wix</TH>
              <TH></TH>
              <TH>New destination</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {redirects.map((r) => (
              <TR key={r.from}>
                <TD className="font-mono text-[11.5px]">{r.from}</TD>
                <TD className="w-6 text-3">
                  <ArrowRight size={12} />
                </TD>
                <TD className="font-mono text-[11.5px]">
                  {r.to || (
                    <span className="text-3 italic font-sans">not decided</span>
                  )}
                </TD>
                <TD>
                  <Badge tone={redirectTone[r.status]}>
                    {r.status === "blocked" && <AlertTriangle size={10} />}
                    {r.status}
                  </Badge>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
        <ProtoNote>
          A page with no equivalent goes to the nearest parent — never to the home page
          and never to a 404. The two misspelled URLs
          (/oversees-investment, /contact-adelaide-realestae-agency) are corrected on the
          new site and redirected from the old spelling, which is never dropped.
        </ProtoNote>
      </Section>

      <Section title="Suburb pages" hint="the organic search asset, not built yet">
        <Table>
          <THead>
            <TR>
              <TH>Suburb</TH>
              <TH className="text-right">Live listings</TH>
              <TH className="text-right">Sold history</TH>
              <TH className="text-right">Agent copy</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {suburbPages.map((s) => (
              <TR key={s.suburb}>
                <TD className="font-medium">{s.suburb}</TD>
                <TD className="text-right tabular text-2">{s.live}</TD>
                <TD className="text-right tabular text-2">{s.sold}</TD>
                <TD className="text-right tabular text-2">
                  {s.words ? `${s.words} words` : "—"}
                </TD>
                <TD>
                  <Badge tone="queue">{s.status}</Badge>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
        <ProtoNote>
          Each page is assembled from live listings, sold history and the agent&apos;s own
          market commentary. This is the page type that earns organic traffic over time,
          which is why the sold archive is never deleted.
        </ProtoNote>
      </Section>
    </>
  );
}
