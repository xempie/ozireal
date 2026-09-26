import Link from "next/link";
import { Download, Ban } from "lucide-react";
import {
  PageHeader,
  Badge,
  Table,
  THead,
  TH,
  TD,
  TR,
  Card,
  CardTitle,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { getContacts, getSavedViews, getContactsBySource } from "@/server/queries";
import { HBars } from "@/components/charts";
import { relative, money } from "@/lib/utils";
import { NewContactButton } from "@/components/forms/contact-forms";

const roleTone = {
  buyer: "brand",
  vendor: "stock",
  landlord: "stock",
  tenant: "neutral",
  referrer: "neutral",
  investor: "ai",
  business_vendor: "stock",
  agent: "brand",
} as const;

const filters = [
  "Role: any",
  "Intent: any",
  "Budget: any",
  "Suburb: any",
  "Consent: any",
  "Last outcome: any",
];

export default async function ContactsPage() {
  const [contacts, savedViews, contactsBySource] = await Promise.all([
    getContacts(),
    getSavedViews(),
    getContactsBySource(),
  ]);

  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} people. One record per person, accumulating roles over time — never one record per deal.`}
        actions={
          <>
            {/* The "Saved views" button here opened nothing and duplicated the card
                below. Replaced with the export, which is real — and which carries the
                consent state alongside every name, so a list pulled into a spreadsheet
                cannot be worked from without it. */}
            <a
              href="/api/export/contacts"
              className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
            >
              <Download size={13} />
              Export CSV
            </a>
            <NewContactButton />
          </>
        }
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 mb-4">
        <div className="space-y-4">
          <Card className="p-3">
            <CardTitle>Saved views</CardTitle>
            <div className="flex flex-wrap gap-2">
              {/* These now carry a real filter, so they lead somewhere: the audience
                  builder, which is the screen that can actually apply one. Filtering
                  this table in place is still to come. */}
              {savedViews.map((v) => (
                <Link
                  key={v.id}
                  href={`/campaigns/new?segment=${v.id}`}
                  title={v.detail ?? undefined}
                  className="text-[12px] border rounded-md px-2.5 py-1.5 surface-3 text-2 hover:border-[var(--line-strong)] transition-colors"
                >
                  <span className="font-medium">{v.name}</span>
                </Link>
              ))}
              {savedViews.length === 0 && (
                <span className="text-3 text-[12px]">No saved views yet.</span>
              )}
            </div>
            <ProtoNote>
              A saved view is a stored filter, not a copy of the data — it finds whoever
              matches on the day it is used. Opening one shows who that is now, with the
              people it cannot reach counted separately.
            </ProtoNote>
          </Card>

          <Card className="p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <span
              key={f}
              className="text-[12px] border border-dashed rounded-md px-2 py-1 surface-3 text-3"
            >
              {f}
            </span>
          ))}
          <span className="text-3 text-[11.5px] ml-auto">
            Filtering is not built yet — these name the filters that will exist
          </span>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle>Where they came from</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">All time, by channel.</p>
          {contactsBySource.length === 0 ? (
            <Empty>No data yet.</Empty>
          ) : (
            <HBars
              data={contactsBySource}
              labelKey="source"
              valueKey="count"
              height={190}
            />
          )}
        </Card>
      </div>

      <Table minWidth={900}>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Roles</TH>
            <TH>Intent</TH>
            <TH>Budget</TH>
            <TH>Last outcome</TH>
            <TH>Last touch</TH>
            <TH>Consent</TH>
          </TR>
        </THead>
        <tbody>
          {contacts.map((c) => {
            const emailConsent = c.consents.find((x) => x.channel === "email");
            const smsConsent = c.consents.find((x) => x.channel === "sms");
            const identity = [c.suburb, c.phone].filter(Boolean).join(" · ");
            return (
              <TR key={c.id}>
                <TD nowrap>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  <div className="text-3 text-[12px]">{identity || "—"}</div>
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.roles.map((r) => (
                      <Badge key={r} tone={roleTone[r]}>
                        {r}
                      </Badge>
                    ))}
                  </div>
                </TD>
                <TD>
                  {c.intentType ? (
                    <>
                      <div className="capitalize text-[12.5px]">{c.intentType}</div>
                      <div className="text-3 text-[11.5px] capitalize">
                        {[
                          c.sentiment,
                          c.confidence !== null ? c.confidence.toFixed(2) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </>
                  ) : (
                    <span className="text-3">—</span>
                  )}
                </TD>
                <TD className="tabular whitespace-nowrap">
                  {c.priceMax && c.priceMax > 0 ? (
                    <span className="text-2 text-[12.5px]">
                      {money(c.priceMin ?? 0)}–{money(c.priceMax)}
                    </span>
                  ) : (
                    <span className="text-3">—</span>
                  )}
                </TD>
                <TD className="max-w-[260px] text-2">
                  {c.lastFollowupOutcome ?? "—"}
                </TD>
                <TD className="whitespace-nowrap text-2">
                  {c.lastFollowupAt ? relative(c.lastFollowupAt) : "—"}
                </TD>
                <TD>
                  <div className="flex flex-wrap gap-1">
                    {c.doNotContact && (
                      <Badge tone="blocked">
                        <Ban size={10} />
                        DNC
                      </Badge>
                    )}
                    {emailConsent && (
                      <Badge
                        tone={emailConsent.status === "granted" ? "sent" : "blocked"}
                      >
                        email
                      </Badge>
                    )}
                    {smsConsent && smsConsent.status === "granted" && (
                      <Badge tone="sent">sms</Badge>
                    )}
                  </div>
                </TD>
              </TR>
            );
          })}
        </tbody>
      </Table>

      {contacts.length === 0 && <Empty>No contacts yet.</Empty>}

      <ProtoNote>
        These rows come from Postgres through the tenant-scoped client, and{" "}
        <strong>New contact</strong> writes to it. Sorting and filtering are still to
        come. Consent state is a column because it decides what you are allowed to do
        with a row — it is not an afterthought.
      </ProtoNote>
    </>
  );
}
