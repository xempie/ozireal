import Link from "next/link";
import { Plus, ShieldCheck, Send, Users, Ban } from "lucide-react";
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
  ProtoNote,
} from "@/components/ui";
import { Bars } from "@/components/charts";
import { campaigns, campaignPerformance } from "@/lib/sample-data-2";
import { listingById, listingAddress, matchesForListing, contactById } from "@/lib/sample-data";
import { relative } from "@/lib/utils";

const statusTone = {
  draft: "neutral",
  in_approval: "queue",
  sending: "brand",
  sent: "sent",
} as const;

const statusLabel = {
  draft: "Draft",
  in_approval: "In approval",
  sending: "Sending",
  sent: "Sent",
} as const;

export default function CampaignsPage() {
  const builderListing = listingById("l5");
  const builderMatches = builderListing ? matchesForListing(builderListing.id) : [];

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="A new listing, its matched contacts, and a personalised draft for each. Every draft goes to the approval queue — there is no path from here to a send."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New campaign
          </Button>
        }
      />

      <div className="mb-6">
        <Callout tone="queue" title="How a campaign reaches someone">
          Match → personalised draft → approval queue → consent re-checked at the instant
          of sending. A contact who unsubscribes between the draft and the send is blocked
          and logged, not skipped silently.
        </Callout>
      </div>

      <Section title="Campaigns">
        <Table>
          <THead>
            <TR>
              <TH>Campaign</TH>
              <TH>Listing</TH>
              <TH>Channel</TH>
              <TH>Status</TH>
              <TH className="text-right">Recipients</TH>
              <TH className="text-right">Approved</TH>
              <TH className="text-right">Blocked</TH>
              <TH className="text-right">Replied</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <tbody>
            {campaigns.map((c) => {
              const l = listingById(c.listingId);
              return (
                <TR key={c.id}>
                  <TD className="font-medium max-w-[240px]">{c.name}</TD>
                  <TD>
                    {l && (
                      <Link
                        href={`/listings/${l.id}`}
                        className="text-2 hover:underline underline-offset-2"
                      >
                        {listingAddress(l)}
                      </Link>
                    )}
                  </TD>
                  <TD>
                    <Badge tone={c.channel === "sms" ? "channel" : "brand"}>
                      {c.channel.toUpperCase()}
                    </Badge>
                  </TD>
                  <TD>
                    <Badge tone={statusTone[c.status]}>{statusLabel[c.status]}</Badge>
                  </TD>
                  <TD className="text-right tabular text-2">{c.recipients}</TD>
                  <TD className="text-right tabular text-2">{c.approved || "—"}</TD>
                  <TD className="text-right tabular">
                    {c.blocked > 0 ? (
                      <span className="text-[#b02f2f] dark:text-[#f08a8a] font-medium">
                        {c.blocked}
                      </span>
                    ) : (
                      <span className="text-2">0</span>
                    )}
                  </TD>
                  <TD className="text-right tabular text-2">{c.replied || "—"}</TD>
                  <TD className="text-2 whitespace-nowrap">{relative(c.createdAt)}</TD>
                </TR>
              );
            })}
          </tbody>
        </Table>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Performance" hint="sent, opened, replied">
          <Card>
            <Bars
              data={campaignPerformance}
              keys={["Sent", "Opened", "Replied"]}
              xKey="name"
              height={230}
            />
            <ProtoNote>
              Reply rate is the number that matters. Opens are a weak signal and get
              weaker every year as mail clients pre-fetch images.
            </ProtoNote>
          </Card>
        </Section>

        <Section title="Builder" hint="draft campaign for 5 Culvert Street">
          <Card>
            <CardTitle>
              {builderListing ? listingAddress(builderListing) : "No listing selected"}
            </CardTitle>
            <p className="text-3 text-[11.5px] -mt-1 mb-3">
              Matched contacts, and what would be drafted for each.
            </p>

            <div className="space-y-2">
              {builderMatches.map((m) => {
                const c = contactById(m.contactId);
                if (!c) return null;
                const emailOk =
                  c.consents.find((x) => x.channel === "email")?.status === "granted";
                return (
                  <div
                    key={m.contactId}
                    className="border rounded-md p-2.5 flex items-start gap-3"
                  >
                    <input
                      type="checkbox"
                      defaultChecked={emailOk}
                      disabled
                      className="mt-1 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/contacts/${c.id}`}
                          className="text-[12.5px] font-medium hover:underline underline-offset-2"
                        >
                          {c.firstName} {c.lastName}
                        </Link>
                        {emailOk ? (
                          <Badge tone="sent">
                            <ShieldCheck size={10} />
                            email ok
                          </Badge>
                        ) : (
                          <Badge tone="blocked">
                            <Ban size={10} />
                            no consent
                          </Badge>
                        )}
                      </div>
                      <p className="text-2 text-[12px] mt-1 leading-relaxed">
                        {m.reason}
                      </p>
                    </div>
                  </div>
                );
              })}
              {builderMatches.length === 0 && (
                <div className="text-3 text-[13px]">No matches for this listing yet.</div>
              )}
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Button variant="primary" size="sm">
                <Users size={12} />
                Generate {builderMatches.length} drafts
              </Button>
              <Button size="sm">
                <Send size={12} />
                Send to approval queue
              </Button>
            </div>
            <ProtoNote>
              Contacts without consent are pre-unticked rather than hidden, so it is
              obvious why they are not receiving anything.
            </ProtoNote>
          </Card>
        </Section>
      </div>
    </>
  );
}
