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
  Table,
  THead,
  TH,
  TD,
  TR,
  Callout,
  Empty,
  ProtoNote,
} from "@/components/ui";
import {
  getRedirects,
  getSuburbPages,
  getListings,
  getSiteSettings,
  getSitePages,
  getSiteHistory,
  getWorkingTheme,
} from "@/server/queries";
import { THEME_PATH } from "@/lib/site-content";
import { AskButton } from "@/components/assistant/ask-button";
import {
  PreviewLink,
  PublishButton,
  DiscardButton,
  HistoryList,
  type HistoryRow,
} from "@/components/forms/site-editor-forms";
import { SiteToggle } from "@/components/forms/website-forms";
import {
  NewRedirectButton,
  EditRedirectButton,
  DeleteRedirectButton,
} from "@/components/forms/ops-forms";
import { relative } from "@/lib/utils";

const redirectTone = {
  mapped: "sent",
  undecided: "queue",
  blocked: "blocked",
} as const;

export default async function WebsitePage() {
  const [redirects, suburbPages, listings, site, pages, theme] = await Promise.all([
    getRedirects(),
    getSuburbPages(),
    getListings(),
    getSiteSettings(),
    getSitePages(),
    getWorkingTheme(),
  ]);
  // History only for paths that have ever been published; the rest have none.
  const historyPaths = [
    ...pages.filter((p) => p.publishedAt).map((p) => p.path),
    ...(theme.publishedAt ? [THEME_PATH] : []),
  ];
  const histories = new Map<string, HistoryRow[]>(
    await Promise.all(
      historyPaths.map(async (path) => {
        const rows = await getSiteHistory(path);
        return [
          path,
          rows.map((h) => ({ ...h, publishedAt: h.publishedAt ? h.publishedAt.toISOString() : null })),
        ] as const;
      }),
    ),
  );
  const edited = pages.filter((p) => p.hasDraft || p.publishedAt || !p.builtin);
  const untouched = pages.filter((p) => !edited.includes(p));
  const mapped = redirects.filter((r) => r.status === "mapped").length;
  const live = listings.filter((l) => l.status === "live");

  return (
    <>
      <PageHeader
        title="Website"
        subtitle="What the public site shows, and the migration from Wix. www.ozirealty.com.au is still served by Wix until cutover."
        actions={
          <a
            href="https://www.ozirealty.com.au"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
          >
            <ExternalLink size={13} />
            View live site
          </a>
        }
      />

      {/*
        The website editor. Changes are made by asking the assistant (bottom right); each
        one lands in a draft. Nothing reaches the public site until Publish is pressed here
        or the agent asks the assistant to publish.
      */}
      <Section
        title="Pages"
        hint="ask the assistant to add pages, change words, add sections or restyle the site; every change is a draft until you publish"
        actions={
          <AskButton
            prefill="Add a new page about "
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
          >
            Edit with the assistant
          </AskButton>
        }
      >
        <Card padded={false} className="p-0">
          {edited.map((p) => (
            <div key={p.path} className="p-3 border-b last:border-b-0 flex flex-wrap items-center gap-2">
              <div className="min-w-0 mr-auto">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium">{p.label}</span>
                  {!p.builtin && <Badge tone="brand">new page</Badge>}
                  {p.hasDraft && <Badge tone="queue">unpublished changes</Badge>}
                  {p.deleted && <Badge tone="blocked">taken down</Badge>}
                  {!p.hasDraft && p.publishedAt && <Badge tone="sent">live</Badge>}
                  {!p.hasDraft && !p.publishedAt && !p.builtin && <Badge tone="neutral">not published</Badge>}
                </div>
                <div className="font-mono text-[11px] text-3 mt-0.5">
                  {p.path}
                  {p.publishedAt ? ` · published ${relative(p.publishedAt)}` : ""}
                  {p.hasDraft && p.draftAt ? ` · draft edited ${relative(p.draftAt)}` : ""}
                </div>
                <div className="mt-2">
                  <HistoryList rows={histories.get(p.path) ?? []} />
                </div>
              </div>
              <PreviewLink path={p.path} />
              {p.hasDraft && <DiscardButton path={p.path} />}
              {p.hasDraft && <PublishButton path={p.path} />}
            </div>
          ))}
          <details className="p-3">
            <summary className="text-[12.5px] text-2 cursor-pointer">
              {untouched.length} built-in pages with no edits
            </summary>
            <ul className="mt-2 grid sm:grid-cols-2 gap-1">
              {untouched.map((p) => (
                <li key={p.path} className="flex items-center gap-2 text-[12px]">
                  <a href={p.path} target="_blank" rel="noopener" className="hover:underline underline-offset-2">
                    {p.label}
                  </a>
                  <span className="font-mono text-3 text-[11px]">{p.path}</span>
                  {p.locked && <Badge tone="neutral">legal, not editable</Badge>}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      </Section>

      <Section title="Theme" hint="colours, fonts and button shape across the whole site">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[12.5px] text-2 mr-auto">
              {Object.keys(theme.theme).length === 0
                ? "Original design."
                : Object.entries(theme.theme)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
              {theme.hasDraft ? " (unpublished)" : ""}
            </div>
            <AskButton
              prefill="Change the website theme: "
              className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[12px] font-medium px-2.5 min-h-8 hover:surface-3"
            >
              Change with the assistant
            </AskButton>
            <PreviewLink path={THEME_PATH} />
            {theme.hasDraft && <DiscardButton path={THEME_PATH} />}
            {theme.hasDraft && <PublishButton path={THEME_PATH} label="Publish theme" />}
          </div>
          <div className="mt-2">
            <HistoryList rows={histories.get(THEME_PATH) ?? []} />
          </div>
        </Card>
      </Section>

      <Section title="Homepage">
        <Card>
          <SiteToggle
            setting="homeListingFilters"
            value={site.homeListingFilters}
            label="Filter tabs on “Currently advertised”"
            hint="The For sale / Auction / For lease / Under offer tabs above the listings. With only a few listings they add little, so they can be hidden. Even when shown, they only appear once there are two or more kinds of listing."
          />
        </Card>
      </Section>

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

      <Section
        title="Redirect map"
        hint="every old URL needs a destination before cutover"
        /* This map was read-only, which made the migration console unable to do the
           one job it exists for: deciding where 22 pages and 51 posts go. */
        actions={<NewRedirectButton />}
      >
        {redirects.length === 0 ? (
          <Empty>Nothing in the map yet.</Empty>
        ) : (
          <Table minWidth={820}>
            <THead>
              <TR>
                <TH>Current URL on Wix</TH>
                <TH></TH>
                <TH>New destination</TH>
                <TH>Status</TH>
                <TH>Note</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <tbody>
              {redirects.map((r) => (
                <TR key={r.id}>
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
                  <TD className="text-2 text-[12px] max-w-[240px]">{r.note ?? "—"}</TD>
                  <TD>
                    <div className="flex flex-wrap items-start justify-end gap-1.5">
                      <EditRedirectButton redirect={r} />
                      <DeleteRedirectButton id={r.id} />
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
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
