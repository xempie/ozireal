import Link from "next/link";
import { GitMerge, ArrowRight, Sparkles } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Callout,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { getConfirmItems, getMergeReviews } from "@/server/queries";
import { relative } from "@/lib/utils";
import {
  ConfirmItemButtons,
  MergeReviewButtons,
} from "@/components/forms/contact-forms";

const kindLabel: Record<string, string> = {
  task: "Task",
  preference_change: "Preference change",
  intent_correction: "Intent correction",
};

export default async function ConfirmPage() {
  const [confirmItems, mergeReviews] = await Promise.all([
    getConfirmItems(),
    getMergeReviews(),
  ]);

  return (
    <>
      <PageHeader
        title="Confirm queue"
        subtitle="Everything the AI thinks it found, waiting for a human to commit it. Nothing here has been written to a contact record."
      />

      <div className="mb-6">
        <Callout tone="ai" title="Why this queue exists">
          An assistant that silently edits your database is one you stop trusting the
          moment it gets something wrong — and then you stop using it. Proposing instead
          of writing is what keeps the contact list worth having.
        </Callout>
      </div>

      <Section title="Proposals" hint={`${confirmItems.length} waiting`}>
        {confirmItems.length === 0 ? (
          <Empty>Nothing waiting.</Empty>
        ) : (
          <div className="space-y-3">
            {confirmItems.map((f) => {
              const source = f.source;
              return (
                <Card key={f.id}>
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge tone="ai">
                          <Sparkles size={10} />
                          {kindLabel[f.kind] ?? f.kind}
                        </Badge>
                        <span className="font-medium text-[13px]">{f.summary}</span>
                      </div>
                      <div className="text-3 text-[12px] mt-1">
                        <Link
                          href={`/contacts/${f.contactId}`}
                          className="hover:underline underline-offset-2"
                        >
                          {f.contactName}
                        </Link>
                        {" · "}
                        {f.confidence !== null && `confidence ${f.confidence.toFixed(2)} · `}
                        {relative(f.createdAt)}
                      </div>
                    </div>
                  </div>

                  {f.before ? (
                    <div className="grid md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                      <div className="surface-3 border rounded-md p-2.5 text-[12.5px] leading-relaxed">
                        <div className="text-3 text-[10.5px] uppercase tracking-[0.05em] font-medium mb-1">
                          Now
                        </div>
                        {f.before}
                      </div>
                      <ArrowRight size={14} className="text-3 mx-auto hidden md:block" />
                      <div className="border rounded-md p-2.5 text-[12.5px] leading-relaxed border-[#4a3aa7]/35 bg-[#4a3aa7]/[0.05]">
                        <div className="text-3 text-[10.5px] uppercase tracking-[0.05em] font-medium mb-1">
                          Proposed
                        </div>
                        {f.after}
                      </div>
                    </div>
                  ) : (
                    <div className="border rounded-md p-2.5 text-[12.5px] border-[#4a3aa7]/35 bg-[#4a3aa7]/[0.05]">
                      {f.after}
                    </div>
                  )}

                  {source && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-3 text-[10.5px] uppercase tracking-[0.05em] font-medium mb-1">
                        From this interaction
                      </div>
                      <p className="text-2 text-[12px] leading-relaxed italic">
                        “{source.body}”
                      </p>
                      <div className="text-3 text-[11px] mt-1">
                        {source.subject && `${source.subject} · `}
                        {relative(source.at)}
                      </div>
                    </div>
                  )}

                  <ConfirmItemButtons id={f.id} />
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Merge review" hint="never merged automatically on name similarity">
        {mergeReviews.length === 0 ? (
          <Empty>No possible duplicates.</Empty>
        ) : (
          <div className="space-y-3">
            {mergeReviews.map((m) => {
              const { a, b } = m;
              if (!a || !b) return null;
              return (
                <Card key={m.id}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge tone="queue">
                      <GitMerge size={10} />
                      Possible duplicate
                    </Badge>
                    <span className="text-3 text-[12px] tabular">
                      similarity {m.similarity.toFixed(2)}
                    </span>
                    <span className="text-3 text-[12px] ml-auto">
                      {relative(m.createdAt)}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    {[a, b].map((p) => (
                      <div key={p.id} className="surface-3 border rounded-md p-3">
                        <Link
                          href={`/contacts/${p.id}`}
                          className="font-medium text-[13px] hover:underline underline-offset-2"
                        >
                          {p.firstName} {p.lastName}
                        </Link>
                        <dl className="mt-2 space-y-1 text-[12px]">
                          <div className="flex gap-2">
                            <dt className="text-3 w-14 shrink-0">Email</dt>
                            <dd className="truncate">{p.emailRaw ?? "—"}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-3 w-14 shrink-0">Phone</dt>
                            <dd className="tabular">{p.phoneRaw ?? "—"}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-3 w-14 shrink-0">Source</dt>
                            <dd>{p.sourceChannel}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-3 w-14 shrink-0">Created</dt>
                            <dd>{relative(p.createdAt)}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>

                  <p className="text-2 text-[12.5px] mt-3">{m.matchedOn}</p>

                  <MergeReviewButtons id={m.id} />
                  <ProtoNote>
                    The phone numbers are identical, which is a strong signal — but the
                    emails differ, so a human decides. Auto-merging on name similarity is
                    how contact databases quietly corrupt.
                  </ProtoNote>
                </Card>
              );
            })}
          </div>
        )}
      </Section>
    </>
  );
}
