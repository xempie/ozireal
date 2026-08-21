import Link from "next/link";
import { Filter, Plus, Ban } from "lucide-react";
import {
  PageHeader,
  Badge,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  Card,
  CardTitle,
  ProtoNote,
} from "@/components/ui";
import { contacts } from "@/lib/sample-data";
import { savedViews, contactsBySource } from "@/lib/sample-data-2";
import { HBars } from "@/components/charts";
import { relative, money } from "@/lib/utils";

const roleTone = {
  buyer: "brand",
  vendor: "stock",
  landlord: "stock",
  tenant: "neutral",
  referrer: "neutral",
  investor: "ai",
} as const;

const filters = [
  "Role: any",
  "Intent: any",
  "Budget: any",
  "Suburb: any",
  "Consent: any",
  "Last outcome: any",
];

export default function ContactsPage() {
  return (
    <>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} people. One record per person, accumulating roles over time — never one record per deal.`}
        actions={
          <>
            <Button>
              <Filter size={13} />
              Saved views
            </Button>
            <Button variant="primary">
              <Plus size={13} />
              New contact
            </Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-[1fr_300px] gap-4 mb-4">
        <div className="space-y-4">
          <Card className="p-3">
            <CardTitle>Saved views</CardTitle>
            <div className="flex flex-wrap gap-2">
              {savedViews.map((v) => (
                <button
                  key={v.name}
                  type="button"
                  title={v.detail}
                  className="text-[12px] border rounded-md px-2.5 py-1.5 surface-3 text-left cursor-default hover:border-[var(--line-strong)] transition-colors"
                >
                  <span className="font-medium">{v.name}</span>
                  <span className="tabular text-3 ml-2">{v.count}</span>
                </button>
              ))}
            </div>
            <ProtoNote>
              A saved view is a stored filter, not a copy of the data. Hover one to see
              what it actually asks for.
            </ProtoNote>
          </Card>

          <Card className="p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              className="text-[12px] border rounded-md px-2 py-1 surface-3 text-2 cursor-default"
            >
              {f}
            </button>
          ))}
          <span className="text-3 text-[11.5px] ml-auto">
            Filters are inert in the prototype
          </span>
            </div>
          </Card>
        </div>

        <Card>
          <CardTitle>Where they came from</CardTitle>
          <p className="text-3 text-[11.5px] -mt-1 mb-2">All time, by channel.</p>
          <HBars
            data={contactsBySource}
            labelKey="source"
            valueKey="count"
            height={190}
          />
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
            return (
              <TR key={c.id}>
                <TD nowrap>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {c.firstName} {c.lastName}
                  </Link>
                  <div className="text-3 text-[12px]">
                    {c.suburb} · {c.phone}
                  </div>
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
                  {c.intent ? (
                    <>
                      <div className="capitalize text-[12.5px]">{c.intent.type}</div>
                      <div className="text-3 text-[11.5px] capitalize">
                        {c.intent.sentiment} · {c.intent.confidence.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <span className="text-3">—</span>
                  )}
                </TD>
                <TD className="tabular whitespace-nowrap">
                  {c.preferences && c.preferences.priceMax > 0 ? (
                    <span className="text-2 text-[12.5px]">
                      {money(c.preferences.priceMin)}–{money(c.preferences.priceMax)}
                    </span>
                  ) : (
                    <span className="text-3">—</span>
                  )}
                </TD>
                <TD className="max-w-[260px] text-2">{c.lastFollowupOutcome}</TD>
                <TD className="whitespace-nowrap text-2">
                  {relative(c.lastFollowupAt)}
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

      <ProtoNote>
        Phase 1 replaces this with a TanStack Table over the tenant-scoped Drizzle
        client. Consent state is shown here because it decides what you are allowed to
        do with a row — it is not an afterthought column.
      </ProtoNote>
    </>
  );
}
