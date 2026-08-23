import Link from "next/link";
import { ShieldCheck, ShieldX, Pencil, Check, X, Clock } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Button,
  Callout,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { getApprovals } from "@/server/queries";
import { approvalKindLabel } from "@/lib/labels";
import { relative, moneyPrecise } from "@/lib/utils";

type ApprovalItem = Awaited<ReturnType<typeof getApprovals>>[number];

function ConsentPill({ item }: { item: ApprovalItem }) {
  // No contact means no consent to show - a social post or an article has no recipient.
  if (!item.contactId || !item.consentNow) return null;
  // Only a recorded draft-time value can have changed; a missing one is not a change.
  const changed =
    item.consentAtDraft !== null && item.consentAtDraft !== item.consentNow;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge tone={item.consentNow === "granted" ? "sent" : "blocked"}>
        {item.consentNow === "granted" ? (
          <ShieldCheck size={10} />
        ) : (
          <ShieldX size={10} />
        )}
        consent {item.consentNow.replace("_", " ")}
      </Badge>
      {changed && <Badge tone="blocked">changed since drafting</Badge>}
    </span>
  );
}

function DraftCard({ item }: { item: ApprovalItem }) {
  return (
    <Card
      className={
        item.status === "blocked"
          ? "border-[#d03b3b]/40 bg-[#d03b3b]/[0.03]"
          : undefined
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={item.kind === "sms" ? "channel" : "brand"}>
              {approvalKindLabel[item.kind] ?? item.kind}
            </Badge>
            <span className="font-medium text-[13px]">
              {item.subject ?? "No subject"}
            </span>
          </div>
          <div className="text-3 text-[12px] mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Built as a list so a missing contact never leaves a dangling separator. */}
            {[
              item.contactId ? (
                <Link
                  key="contact"
                  href={`/contacts/${item.contactId}`}
                  className="hover:underline underline-offset-2"
                >
                  {item.contactName ?? "Unknown"}
                </Link>
              ) : null,
              item.listingId ? (
                <Link
                  key="listing"
                  href={`/listings/${item.listingId}`}
                  className="hover:underline underline-offset-2"
                >
                  {item.address}
                </Link>
              ) : null,
              <span key="drafted" className="inline-flex items-center gap-1">
                <Clock size={10} />
                drafted {relative(item.createdAt)}
              </span>,
              item.model ? (
                <span key="cost">
                  {item.model} · {moneyPrecise(item.costAud)}
                </span>
              ) : null,
            ]
              .filter(Boolean)
              .map((node, i, arr) => (
                <span key={i} className="inline-flex items-center gap-2 whitespace-nowrap">
                  {node}
                  {i < arr.length - 1 && <span aria-hidden>·</span>}
                </span>
              ))}
          </div>
        </div>
        <ConsentPill item={item} />
      </div>

      <div className="surface-3 border rounded-md p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap">
        {item.body}
      </div>

      {item.blockReason && (
        <div className="mt-3">
          <Callout tone="blocked" title="Blocked at send time">
            {item.blockReason}
          </Callout>
        </div>
      )}

      {item.rejectReason && (
        <div className="mt-3 text-[12.5px] text-2">
          <span className="font-medium">Rejected:</span> {item.rejectReason}
          {(item.reviewedBy || item.reviewedAt) && (
            <span className="text-3">
              {" "}
              —{" "}
              {[item.reviewedBy, item.reviewedAt ? relative(item.reviewedAt) : null]
                .filter(Boolean)
                .join(", ")}
            </span>
          )}
        </div>
      )}

      {item.status === "pending" && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button variant="primary" size="sm">
            <Check size={12} />
            Approve and send
          </Button>
          <Button size="sm">
            <Pencil size={12} />
            Edit
          </Button>
          <Button variant="danger" size="sm">
            <X size={12} />
            Reject
          </Button>
        </div>
      )}
    </Card>
  );
}

export default async function ApprovalsPage() {
  const approvals = await getApprovals();

  const pending = approvals.filter((a) => a.status === "pending");
  const blocked = approvals.filter((a) => a.status === "blocked");
  // "approved" is a decision too - leaving it out would drop the row from every section.
  const history = approvals.filter(
    (a) => a.status === "approved" || a.status === "sent" || a.status === "rejected",
  );

  return (
    <>
      <PageHeader
        title="Approval queue"
        subtitle="The single door every outbound message leaves through. There is no autonomous send path, and no setting that creates one."
      />

      <div className="mb-6">
        <Callout tone="brand" title="How consent is handled here">
          The badge on each draft is the consent state <em>right now</em>, not when the
          draft was written. It is checked again at the instant of sending, so an
          unsubscribe in between still stops the message.
        </Callout>
      </div>

      {blocked.length > 0 && (
        <Section title="Blocked" hint="consent lapsed between drafting and sending">
          <div className="space-y-3">
            {blocked.map((a) => (
              <DraftCard key={a.id} item={a} />
            ))}
          </div>
        </Section>
      )}

      <Section title="Awaiting review" hint={`${pending.length} drafts`}>
        {pending.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <div className="space-y-3">
            {pending.map((a) => (
              <DraftCard key={a.id} item={a} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Recent decisions">
        {history.length === 0 ? (
          <Empty>No decisions yet.</Empty>
        ) : (
          <div className="space-y-3">
            {history.map((a) => (
              <DraftCard key={a.id} item={a} />
            ))}
          </div>
        )}
        <ProtoNote>
          Every decision is kept with who made it and when. The audit trail is what makes
          a send defensible after the fact.
        </ProtoNote>
      </Section>
    </>
  );
}
