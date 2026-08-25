"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, X, ShieldAlert } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  SubmitButton,
  FormError,
} from "./action-form";
import { approveAndSend, rejectDraft, editDraft } from "@/server/actions/approvals";

/**
 * The approval controls (B5.4).
 *
 * "Approve and send" is one button because it is one decision. The interesting
 * case is the third outcome: a send can come back BLOCKED — consent lapsed
 * between drafting and now — which is neither success nor error. It renders as
 * its own state, with the gate's reason, because the person needs to understand
 * that the system refused on their behalf and why.
 */
export function ApprovalActions({
  id,
  subject,
  body,
}: {
  id: string;
  subject: string | null;
  body: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [blocked, setBlocked] = React.useState<string | null>(null);

  const router = useRouter();
  /**
   * Refresh is suppressed here and driven by hand.
   *
   * On a block the automatic refresh re-renders the server component, the item is
   * no longer pending, and this whole control unmounts — taking the explanation
   * with it before anyone has read it. The person clicked send and the system
   * refused on their behalf; they are owed the reason on screen, not a card that
   * silently moves. So a block holds until they acknowledge it, and a successful
   * send refreshes immediately as usual.
   */
  const send = useAction(approveAndSend, {
    refreshOnSuccess: false,
    onSuccess: (d) => {
      if (d.blocked) setBlocked(d.reason);
      else router.refresh();
    },
  });
  const reject = useAction(rejectDraft, { onSuccess: () => setRejecting(false) });
  const edit = useAction(editDraft, { onSuccess: () => setEditing(false) });

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={send.pending}
          onClick={() => {
            setBlocked(null);
            send.run({ id });
          }}
          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 min-h-8 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Check size={12} />
          {send.pending ? "Sending…" : "Approve and send"}
        </button>
        <button
          type="button"
          onClick={() => {
            edit.reset();
            setEditing(true);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 min-h-8 rounded-md surface-2 border hover:surface-3"
        >
          <Pencil size={12} />
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            reject.reset();
            setRejecting(true);
          }}
          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 min-h-8 rounded-md surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] hover:bg-[#d03b3b]/8"
        >
          <X size={12} />
          Reject
        </button>
      </div>

      {blocked && (
        <div className="flex items-start gap-2 text-[12.5px] rounded-md border border-[#eda100]/50 bg-[#eda100]/10 p-2.5">
          <ShieldAlert size={14} className="shrink-0 mt-px" />
          <div>
            <div className="font-semibold mb-0.5">Refused at the consent gate</div>
            <p className="text-2 leading-relaxed">{blocked}</p>
            <p className="text-3 text-[11.5px] mt-1">
              Consent is re-checked at the moment of sending, not when the draft was
              written. Nothing was sent, and the refusal is recorded.
            </p>
            <button
              type="button"
              onClick={() => {
                setBlocked(null);
                router.refresh();
              }}
              className="mt-2 text-[11.5px] px-2 min-h-7 rounded-md surface-2 border hover:surface-3"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      <FormError message={send.error ?? reject.error} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit before approving">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            edit.run({ id, subject: f.get("subject"), body: f.get("body") });
          }}
        >
          {subject !== null && (
            <Input label="Subject" name="subject" defaultValue={subject} errors={edit.fieldErrors.subject} />
          )}
          <Textarea
            label="Message"
            name="body"
            rows={10}
            defaultValue={body}
            required
            errors={edit.fieldErrors.body}
          />
          <p className="text-3 text-[11.5px] leading-relaxed">
            The AI&apos;s original wording is kept the first time you edit, so the audit
            trail shows what you changed.
          </p>
          <FormError message={edit.error} />
          <div className="flex gap-2">
            <SubmitButton pending={edit.pending}>Save changes</SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Reject this draft">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            reject.run({ id, reason: f.get("reason") });
          }}
        >
          <Textarea
            label="Why?"
            name="reason"
            rows={3}
            required
            placeholder="Too pushy for a first contact"
            errors={reject.fieldErrors.reason}
          />
          <p className="text-3 text-[11.5px] leading-relaxed">
            The reason is stored on the record. It is what makes a rejected draft
            useful later rather than just absent.
          </p>
          <FormError message={reject.error} />
          <div className="flex gap-2">
            <SubmitButton pending={reject.pending} variant="danger">
              Reject
            </SubmitButton>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
