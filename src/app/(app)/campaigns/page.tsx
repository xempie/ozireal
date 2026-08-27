import Link from "next/link";
import { ShieldCheck, Send, Users, Ban } from "lucide-react";
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
import { Bars } from "@/components/charts";
import {
  getCampaignPerformance,
  getCampaigns,
  getContacts,
  getMatchesForListing,
} from "@/server/queries";
import { relative } from "@/lib/utils";
import { NewCampaignButton } from "@/components/forms/content-forms";
import { listingOptions } from "@/server/queries/pickers";

const statusTone: Record<string, "neutral" | "queue" | "brand" | "sent"> = {
  draft: "neutral",
  in_approval: "queue",
  sending: "brand",
  sent: "sent",
  cancelled: "neutral",
};

const statusLabel: Record<string, string> = {
  draft: "Draft",
  in_approval: "In approval",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

export default async function CampaignsPage() {
  const [campaigns, performance, contactRows, listingOpts] = await Promise.all([
    getCampaigns(),
    getCampaignPerformance(),
    getContacts(),
    listingOptions(),
  ]);

  /**
   * The builder shows the campaign that is still being assembled - the draft. Falling
   * back to whichever campaign has a listing keeps the panel populated rather than
   * pointing at a listing id that no longer exists.
   */
  const builder =
    campaigns.find((c) => c.status === "draft" && c.listingId) ??
    campaigns.find((c) => c.listingId) ??
    null;
  const builderMatches = builder?.listingId
    ? await getMatchesForListing(builder.listingId)
    : [];

  // Consent is per contact and per channel; the list read already carries the current state.
  const consentsFor = new Map(contactRows.map((c) => [c.id, c.consents]));

  return (
    <>
      <PageHeader
        title="Campaigns"
        subtitle="A new listing, its matched contacts, and a personalised draft for each. Every draft goes to the approval queue — there is no path from here to a send."
        actions={<NewCampaignButton listings={listingOpts} />}
      />

      <div className="mb-6">
        <Callout tone="queue" title="How a campaign reaches someone">
          Match → personalised draft → approval queue → consent re-checked at the instant
          of sending. A contact who unsubscribes between the draft and the send is blocked
          and logged, not skipped silently.
        </Callout>
      </div>

      <Section title="Campaigns">
        <Table minWidth={940}>
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
            {campaigns.map((c) => (
              <TR key={c.id}>
                <TD nowrap className="font-medium">{c.name}</TD>
                <TD nowrap>
                  {c.listingId && (
                    <Link
                      href={`/listings/${c.listingId}`}
                      className="text-2 hover:underline underline-offset-2"
                    >
                      {c.address}
                    </Link>
                  )}
                </TD>
                <TD>
                  <Badge tone={c.channel === "sms" ? "channel" : "brand"}>
                    {c.channel.toUpperCase()}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={statusTone[c.status] ?? "neutral"}>
                    {statusLabel[c.status] ?? c.status}
                  </Badge>
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
            ))}
          </tbody>
        </Table>
      </Section>

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Performance" hint="sent, opened, replied">
          <Card>
            {performance.length === 0 ? (
              <Empty>Nothing sent yet.</Empty>
            ) : (
              <Bars
                data={performance}
                keys={["Sent", "Opened", "Replied"]}
                xKey="name"
                height={230}
              />
            )}
            <ProtoNote>
              Reply rate is the number that matters. Opens are a weak signal and get
              weaker every year as mail clients pre-fetch images.
            </ProtoNote>
          </Card>
        </Section>

        <Section
          title="Builder"
          hint={builder ? `draft campaign for ${builder.address}` : "no draft campaign"}
        >
          <Card>
            <CardTitle>{builder ? builder.address : "No listing selected"}</CardTitle>
            <p className="text-3 text-[11.5px] -mt-1 mb-3">
              Matched contacts, and what would be drafted for each.
            </p>

            <div className="space-y-2">
              {builderMatches.map((m) => {
                const emailOk =
                  consentsFor
                    .get(m.contactId)
                    ?.find((x) => x.channel === "email")?.status === "granted";
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
                          href={`/contacts/${m.contactId}`}
                          className="text-[12.5px] font-medium hover:underline underline-offset-2"
                        >
                          {m.contactFirstName} {m.contactLastName}
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

            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
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
