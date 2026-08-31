"use client";

import * as React from "react";
import { Plus, PhoneCall, MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Textarea,
  Select,
  SubmitButton,
  CancelButton,
  FormError,
} from "./action-form";
import {
  createContact,
  recordFollowupOutcome,
  logInteraction,
  commitConfirmItem,
  discardConfirmItem,
  resolveMergeReview,
  updateContact,
  tombstoneContact,
} from "@/server/actions/contacts";

const ROLES = [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
] as const;

/* ------------------------------------------------------------ new contact */

export function NewContactButton() {
  const [open, setOpen] = React.useState(false);
  const [duplicate, setDuplicate] = React.useState(false);
  const a = useAction(createContact, {
    onSuccess: (d) => {
      setDuplicate(!!d.duplicateOf);
      // Close on the spot rather than on a timer. A deferred close can fire after the
      // user has reopened the dialog, shutting it under them for no visible reason.
      // A duplicate keeps it open, because that result needs reading.
      if (!d.duplicateOf) setOpen(false);
    },
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    a.run({
      firstName: f.get("firstName"),
      lastName: f.get("lastName"),
      email: f.get("email") ?? "",
      phone: f.get("phone") ?? "",
      suburb: f.get("suburb") ?? "",
      roles: f.getAll("roles"),
      doNotContact: f.get("doNotContact") === "on",
    });
  }

  return (
    <>
      <button
        onClick={() => {
          setDuplicate(false);
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90 transition-opacity"
      >
        <Plus size={13} />
        New contact
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="New contact">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="First name" name="firstName" required errors={a.fieldErrors.firstName} />
            <Input label="Last name" name="lastName" required errors={a.fieldErrors.lastName} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Email" name="email" type="email" errors={a.fieldErrors.email} />
            <Input label="Phone" name="phone" placeholder="0412 345 678" errors={a.fieldErrors.phone} />
          </div>
          <Input label="Suburb" name="suburb" errors={a.fieldErrors.suburb} />

          <div>
            <span className="block text-[12px] font-medium text-2 mb-1.5">Roles</span>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  className="inline-flex items-center gap-1.5 text-[12.5px] border rounded-md px-2 py-1.5 surface-3 cursor-pointer"
                >
                  <input type="checkbox" name="roles" value={r} defaultChecked={r === "buyer"} />
                  {r}
                </label>
              ))}
            </div>
            {a.fieldErrors.roles?.[0] && (
              <p className="text-[11.5px] text-[#b02f2f] dark:text-[#f08a8a] mt-1">
                {a.fieldErrors.roles[0]}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-[12.5px]">
            <input type="checkbox" name="doNotContact" />
            Do not contact
          </label>

          <FormError message={a.error} />
          {duplicate && (
            <div className="text-[12.5px] rounded-md border border-[#eda100]/50 bg-[#eda100]/10 p-2.5">
              Saved — but someone with that email or phone already exists, so a{" "}
              <strong>merge review</strong> has been raised. Nothing was merged
              automatically.
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Create contact</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              {a.succeeded ? "Close" : "Cancel"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------- follow-up outcome */

export function RecordOutcomeButton({ contactId }: { contactId: string }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(recordFollowupOutcome, {
    onSuccess: () => setOpen(false),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    a.run({
      contactId,
      outcome: f.get("outcome"),
      channel: f.get("channel"),
      nextDueInDays: f.get("nextDueInDays"),
    });
  }

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
      >
        <PhoneCall size={13} />
        Record outcome
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Record a follow-up outcome">
        <form onSubmit={submit} className="space-y-3">
          <Textarea
            label="What happened?"
            name="outcome"
            rows={3}
            required
            placeholder="Wants to see Powell St before making an offer"
            errors={a.fieldErrors.outcome}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Channel"
              name="channel"
              defaultValue="phone"
              errors={a.fieldErrors.channel}
              options={[
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
                { value: "manual", label: "In person" },
              ]}
            />
            <Select
              label="Follow up again in"
              name="nextDueInDays"
              defaultValue="7"
              options={[
                { value: "0", label: "No follow-up scheduled" },
                { value: "1", label: "1 day" },
                { value: "3", label: "3 days" },
                { value: "7", label: "1 week" },
                { value: "14", label: "2 weeks" },
                { value: "30", label: "1 month" },
              ]}
            />
          </div>

          <p className="text-3 text-[11.5px] leading-relaxed">
            This also writes an interaction, so the outcome has a record behind it rather
            than being a claim on its own. That row is append-only.
          </p>

          <FormError message={a.error} />

          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Record outcome</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------- manual adapter */

export function LogInteractionButton({ contactId }: { contactId: string }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(logInteraction, {
    onSuccess: () => setOpen(false),
  });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    a.run({
      contactId,
      channel: f.get("channel"),
      direction: f.get("direction"),
      subject: f.get("subject") ?? "",
      body: f.get("body"),
    });
  }

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
      >
        <MessageSquarePlus size={13} />
        Log interaction
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Log an interaction">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="Channel"
              name="channel"
              defaultValue="phone"
              options={[
                { value: "phone", label: "Phone" },
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" },
                { value: "social", label: "Social" },
                { value: "manual", label: "In person" },
              ]}
            />
            <Select
              label="Direction"
              name="direction"
              defaultValue="in"
              options={[
                { value: "in", label: "They contacted us" },
                { value: "out", label: "We contacted them" },
              ]}
            />
          </div>
          <Input label="Subject" name="subject" errors={a.fieldErrors.subject} />
          <Textarea
            label="What was said"
            name="body"
            rows={4}
            required
            errors={a.fieldErrors.body}
          />

          <p className="text-3 text-[11.5px] leading-relaxed">
            The manual adapter (§5). A typed-up call goes through the same pipeline as an
            email or a web form, and the row cannot be edited afterwards — a correction
            is a new entry.
          </p>

          <FormError message={a.error} />

          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Log it</SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------- confirm queue */

/**
 * Commit / discard for one queued draft.
 *
 * Rule 1: nothing leaves the building without a human pressing this. The button is the
 * gate, so it says what it is doing while it does it — a queue item that silently
 * stayed put reads identically to one that went out.
 */
export function ConfirmItemButtons({ id }: { id: string }) {
  const commit = useAction(commitConfirmItem);
  const discard = useAction(discardConfirmItem);
  const busy = commit.pending || discard.pending;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => commit.run({ id })}
          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 min-h-8 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {commit.pending ? "Committing…" : "Commit"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => discard.run({ id })}
          className="text-[12px] px-2.5 min-h-8 rounded-md surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] hover:bg-[#d03b3b]/8 disabled:opacity-60"
        >
          {discard.pending ? "Discarding…" : "Discard"}
        </button>
      </div>
      <FormError message={commit.error ?? discard.error} />
    </div>
  );
}

export function MergeReviewButtons({ id }: { id: string }) {
  const a = useAction(resolveMergeReview);
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={a.pending}
          onClick={() => a.run({ id, decision: "merged" })}
          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 min-h-8 rounded-md bg-[var(--accent)] text-white font-medium hover:opacity-90 disabled:opacity-60"
        >
          {a.pending ? "Working…" : "Merge into the older record"}
        </button>
        <button
          type="button"
          disabled={a.pending}
          onClick={() => a.run({ id, decision: "kept_both" })}
          className="text-[12px] px-2.5 min-h-8 rounded-md surface-2 border hover:surface-3 disabled:opacity-60"
        >
          Keep both
        </button>
      </div>
      <FormError message={a.error} />
    </div>
  );
}

/* ------------------------------------------------------- editing a contact */

export type EditableContact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  suburb: string | null;
  roles: string[];
  doNotContact: boolean;
};

/**
 * Correcting a contact.
 *
 * The same fields as creation and deliberately the same shape, because a record
 * created by hand and one corrected later should end up indistinguishable. What is
 * NOT here is any way to edit the rolling brief or the intent — §4 says those are
 * derived, and the way to fix a wrong brief is to correct the interaction
 * underneath it and let the job rebuild.
 */
export function EditContactButton({ contact }: { contact: EditableContact }) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(updateContact, { onSuccess: () => setOpen(false) });

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    a.run({
      id: contact.id,
      firstName: f.get("firstName"),
      lastName: f.get("lastName"),
      email: f.get("email") ?? "",
      phone: f.get("phone") ?? "",
      suburb: f.get("suburb") ?? "",
      roles: f.getAll("roles"),
      doNotContact: f.get("doNotContact") === "on",
    });
  }

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
      >
        <Pencil size={13} />
        Edit
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Edit contact">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="First name"
              name="firstName"
              required
              defaultValue={contact.firstName}
              errors={a.fieldErrors.firstName}
            />
            <Input
              label="Last name"
              name="lastName"
              required
              defaultValue={contact.lastName}
              errors={a.fieldErrors.lastName}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Email"
              name="email"
              type="email"
              defaultValue={contact.email ?? ""}
              errors={a.fieldErrors.email}
            />
            <Input
              label="Phone"
              name="phone"
              placeholder="0412 345 678"
              defaultValue={contact.phone ?? ""}
              errors={a.fieldErrors.phone}
            />
          </div>
          <p className="text-3 text-[11px] -mt-2">
            Changing either of these re-normalises the dedupe keys. It does not merge
            anything — if the new address already belongs to somebody, that is still a
            decision for the merge queue.
          </p>
          <Input
            label="Suburb"
            name="suburb"
            defaultValue={contact.suburb ?? ""}
            errors={a.fieldErrors.suburb}
          />

          <div>
            <span className="block text-[12px] font-medium text-2 mb-1.5">Roles</span>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <label
                  key={r}
                  className="inline-flex items-center gap-1.5 text-[12.5px] border rounded-md px-2 py-1.5 surface-3 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    name="roles"
                    value={r}
                    defaultChecked={contact.roles.includes(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
            {a.fieldErrors.roles?.[0] && (
              <p className="text-[11.5px] text-[#b02f2f] dark:text-[#f08a8a] mt-1">
                {a.fieldErrors.roles[0]}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              name="doNotContact"
              defaultChecked={contact.doNotContact}
            />
            Do not contact
          </label>
          <p className="text-3 text-[11px] -mt-2">
            A flag on the record, separate from the per-channel consent trail below it.
            Ticking it stops everything; unticking it does not grant a consent that was
            never given.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save changes</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/**
 * A privacy request (§10, APP 12/13).
 *
 * Not a delete, and the dialog says so rather than letting the button imply it. The
 * interaction log is the evidence behind every message this agency has sent, so the
 * record is tombstoned: it stops taking activity, disappears from the working list
 * and from matching, and the history stays where it is. A reason is required
 * because a deletion request is a thing that has to be demonstrable afterwards.
 */
export function RemoveContactButton({
  contactId,
  name,
}: {
  contactId: string;
  name: string;
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(tombstoneContact, { onSuccess: () => setOpen(false) });

  return (
    <>
      <button
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md surface-2 border border-[#d03b3b]/40 text-[#b02f2f] dark:text-[#f08a8a] text-[13px] font-medium px-3 min-h-9 hover:bg-[#d03b3b]/8"
      >
        <Trash2 size={13} />
        Remove
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={`Remove ${name}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            a.run({ contactId, reason: f.get("reason") });
          }}
        >
          <div className="text-[12.5px] rounded-md border border-[#eda100]/50 bg-[#eda100]/10 p-2.5 leading-relaxed">
            This tombstones the record rather than deleting it. {name} stops appearing
            in the contact list, in matching and in every send path, and is marked do
            not contact. The interactions and consents stay, because they are the
            evidence behind messages that were lawful when they were sent — destroying
            them would remove this agency&apos;s ability to defend them.
            <br />
            <br />
            It cannot be undone: the database refuses to un-tombstone a record.
          </div>

          <Input
            label="Why"
            name="reason"
            required
            placeholder="Deletion request received by email, 28 Aug"
            errors={a.fieldErrors.reason}
          />
          <p className="text-3 text-[11px] -mt-2">
            Recorded on the audit row. A privacy request you cannot evidence is one you
            cannot show you honoured.
          </p>

          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending} variant="danger">
              Remove this contact
            </SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}
