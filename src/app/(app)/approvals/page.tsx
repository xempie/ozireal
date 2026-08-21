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
import {
  approvals,
  approvalKindLabel,
  contactName,
  listingById,
  listingAddress,
  type ApprovalItem,
} from "@/lib/sample-data";
import { relative, moneyPrecise } from "@/lib/utils";

function ConsentPill({ item }: { item: ApprovalItem }) {
  if (!item.contactId) return null;
  const changed = item.consentAtDraft !== item.consentNow;
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
  const listing = item.listingId ? listingById(item.listingId) : undefined;
  return (
    <Card
      className={
        item.status === "blocked"
          ? "border-[#d03b3b]/40 bg-[#d03b3b]/[0.03]"
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4 mb-2.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone={item.kind === "sms" ? "channel" : "brand"}>
              {approvalKindLabel[item.kind]}
            </Badge>
            <span className="font-medium text-[13px]">{item.subject}</span>
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
                  {contactName(item.contactId)}
                </Link>
              ) : null,
              listing ? (
                <Link
                  key="listing"
                  href={`/listings/${listing.id}`}
                  className="hover:underline underline-offset-2"
                >
                  {listingAddress(listing)}
                </Link>
              ) : null,
              <span key="drafted" className="inline-flex items-center gap-1">
                <Clock size={10} />
                drafted {relative(item.createdAt)}
              </span>,
              <span key="cost">
                {item.model} · {moneyPrecise(item.costAud)}
              </span>,
            ]
              .filter(Boolean)
              .map((node, i) => (
                <span key={i} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden>·</span>}
                  {node}
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
          <span className="text-3">
            {" "}
            — {item.reviewedBy}, {relative(item.reviewedAt!)}
          </span>
        </div>
      )}

      {item.status === "pending" && (
        <div className="flex items-center gap-2 mt-3">
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

export default function ApprovalsPage() {
  const pending = approvals.filter((a) => a.status === "pending");
  const blocked = approvals.filter((a) => a.status === "blocked");
  const history = approvals.filter(
    (a) => a.status === "sent" || a.status === "rejected",
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
        <div className="space-y-3">
          {history.map((a) => (
            <DraftCard key={a.id} item={a} />
          ))}
        </div>
        <ProtoNote>
          Every decision is kept with who made it and when. The audit trail is what makes
          a send defensible after the fact.
        </ProtoNote>
      </Section>
    </>
  );
}
