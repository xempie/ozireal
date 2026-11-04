"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  useAction,
  Modal,
  Select,
  Input,
  FormError,
  SubmitButton,
  CancelButton,
} from "@/components/forms/action-form";
import {
  bulkDeleteContacts,
  bulkAddRole,
  bulkRemoveRole,
  bulkSetOutcome,
  bulkDoNotContact,
  bulkProposeMerge,
} from "@/server/actions/contacts-bulk";

/**
 * Selection for the contacts table (2026-11-04). The table stays a Server Component;
 * only the tick boxes and the bar are client islands, sharing one Set through context.
 */

type Ctx = {
  selected: Set<string>;
  toggle: (id: string) => void;
  setAll: (on: boolean) => void;
  allIds: string[];
  clear: () => void;
};
const SelectionCtx = React.createContext<Ctx | null>(null);
const useSel = () => {
  const c = React.useContext(SelectionCtx);
  if (!c) throw new Error("Bulk selection controls must sit inside <BulkSelection>.");
  return c;
};

const ROLES = ["buyer", "vendor", "landlord", "tenant", "referrer", "investor", "business_vendor", "agent"];
const roleOptions = ROLES.map((r) => ({ value: r, label: r.replace("_", " ") }));

export function BulkSelection({
  allIds,
  names,
  children,
}: {
  allIds: string[];
  names: Record<string, string>;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const value: Ctx = {
    selected,
    allIds,
    toggle: (id) =>
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (on) => setSelected(on ? new Set(allIds) : new Set()),
    clear: () => setSelected(new Set()),
  };
  return (
    <SelectionCtx.Provider value={value}>
      <BulkBar names={names} />
      {children}
    </SelectionCtx.Provider>
  );
}

export function SelectAllBox() {
  const { selected, allIds, setAll } = useSel();
  const all = allIds.length > 0 && selected.size === allIds.length;
  return (
    <input
      type="checkbox"
      aria-label="Select all contacts"
      className="size-4 accent-[var(--accent)]"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = selected.size > 0 && !all;
      }}
      onChange={(e) => setAll(e.target.checked)}
    />
  );
}

export function RowBox({ id, name }: { id: string; name: string }) {
  const { selected, toggle } = useSel();
  return (
    <input
      type="checkbox"
      aria-label={`Select ${name}`}
      className="size-4 accent-[var(--accent)]"
      checked={selected.has(id)}
      onChange={() => toggle(id)}
    />
  );
}

type Dialog = null | "delete" | "add-role" | "remove-role" | "outcome" | "dnc";

function BulkBar({ names }: { names: Record<string, string> }) {
  const { selected, allIds, setAll, clear } = useSel();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const ids = [...selected];
  const n = ids.length;

  const merge = useAction(bulkProposeMerge, {
    onSuccess: () => {
      clear();
      setNotice("Sent to merge review.");
    },
  });

  if (!n) {
    return notice ? (
      <div role="status" className="mb-3 rounded-md border px-3 py-2 text-[13px] surface-2">
        {notice}
      </div>
    ) : null;
  }

  const btn =
    "min-h-9 px-3 rounded-md border border-white/25 text-[13px] hover:bg-white/10 disabled:opacity-50";
  const close = (msg?: string) => {
    setDialog(null);
    if (msg) {
      clear();
      setNotice(msg);
    }
  };

  return (
    <>
      <div className="sticky top-2 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-[#13254A] px-3 py-2 text-white shadow-lg">
        <strong className="text-[13.5px]">{n} selected</strong>
        {n < allIds.length && (
          <button className="text-[13px] underline underline-offset-2 text-[#AFC2FF]" onClick={() => setAll(true)}>
            Select all {allIds.length}
          </button>
        )}
        <span className="flex-1" />
        <button className={btn} onClick={() => setDialog("add-role")}>Add role</button>
        <button className={btn} onClick={() => setDialog("remove-role")}>Remove role</button>
        <button className={btn} onClick={() => setDialog("outcome")}>Set follow-up outcome</button>
        <button className={btn} onClick={() => setDialog("dnc")}>Mark do not contact</button>
        <a className={`${btn} inline-flex items-center`} href={`/api/export/contacts?ids=${ids.join(",")}`}>
          Export selected
        </a>
        <button
          className={btn}
          disabled={n !== 2 || merge.pending}
          title={n === 2 ? "Send these two to merge review" : "Pick exactly two"}
          onClick={() => merge.run({ contactIds: ids })}
        >
          {n === 2 ? "Merge…" : "Merge (pick 2)"}
        </button>
        <button
          className="min-h-9 px-3 rounded-md bg-[#D84315] text-[13px] font-semibold hover:bg-[#bf3a10]"
          onClick={() => setDialog("delete")}
        >
          Delete…
        </button>
        <button aria-label="Clear selection" className="min-h-9 px-2" onClick={clear}>
          <X size={16} />
        </button>
        {merge.error && <p className="basis-full text-[12.5px] text-[#FFB4A0]">{merge.error}</p>}
      </div>

      {dialog === "delete" && <DeleteDialog ids={ids} names={names} onClose={close} />}
      {(dialog === "add-role" || dialog === "remove-role") && (
        <RoleDialog ids={ids} mode={dialog} onClose={close} />
      )}
      {dialog === "outcome" && <OutcomeDialog ids={ids} onClose={close} />}
      {dialog === "dnc" && <DncDialog ids={ids} onClose={close} />}
    </>
  );
}

const plural = (k: number) => `${k} contact${k === 1 ? "" : "s"}`;

function DeleteDialog({
  ids,
  names,
  onClose,
}: {
  ids: string[];
  names: Record<string, string>;
  onClose: (msg?: string) => void;
}) {
  const [reason, setReason] = React.useState("Test or spam enquiry");
  const [other, setOther] = React.useState("");
  const a = useAction(bulkDeleteContacts, {
    onSuccess: (d) => onClose(`Deleted ${plural(d.count)}.`),
  });
  const shown = ids.slice(0, 5).map((id) => names[id]).join(", ");
  const more = ids.length > 5 ? ` and ${ids.length - 5} more` : "";
  return (
    <Modal open onClose={() => onClose()} title={`Delete ${plural(ids.length)}?`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ contactIds: ids, reason: reason === "Other" ? other : reason });
        }}
      >
        <p className="text-[13.5px]">
          {shown}
          {more} will be removed from your contacts and every list, and marked do not contact so
          nothing can be sent to them again.
        </p>
        <p className="text-[12.5px] text-2 surface-1 rounded-md p-2.5">
          Their message history is sealed, not erased, so the agency can still show that past
          emails were lawful (Privacy Act, Spam Act). This cannot be undone.
        </p>
        <Select
          label="Reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            "Test or spam enquiry",
            "Duplicate record",
            "Person asked to be removed",
            "Other",
          ].map((v) => ({ value: v, label: v }))}
        />
        {reason === "Other" && (
          <Input label="Say why" name="other" value={other} onChange={(e) => setOther(e.target.value)} />
        )}
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending} className="!bg-[#D84315] !text-white">
            Delete {plural(ids.length)}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function RoleDialog({
  ids,
  mode,
  onClose,
}: {
  ids: string[];
  mode: "add-role" | "remove-role";
  onClose: (msg?: string) => void;
}) {
  const [role, setRole] = React.useState("buyer");
  const adding = mode === "add-role";
  const a = useAction(adding ? bulkAddRole : bulkRemoveRole, {
    onSuccess: (d) =>
      onClose(`${adding ? "Added" : "Removed"} ${role.replace("_", " ")} on ${plural(d.count)}.`),
  });
  return (
    <Modal open onClose={() => onClose()} title={`${adding ? "Add a role to" : "Remove a role from"} ${plural(ids.length)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ contactIds: ids, role });
        }}
      >
        <Select label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} />
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending}>{adding ? "Add role" : "Remove role"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function OutcomeDialog({ ids, onClose }: { ids: string[]; onClose: (msg?: string) => void }) {
  const [outcome, setOutcome] = React.useState("");
  const a = useAction(bulkSetOutcome, {
    onSuccess: (d) => onClose(`Recorded the outcome on ${plural(d.count)}.`),
  });
  return (
    <Modal open onClose={() => onClose()} title={`Follow-up outcome for ${plural(ids.length)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ contactIds: ids, outcome });
        }}
      >
        <Input
          label="What happened"
          name="outcome"
          placeholder="e.g. Sent the new Elizabeth Grove listing"
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
          errors={a.fieldErrors.outcome}
        />
        <p className="text-[12.5px] text-2">Logged on each contact's history as a manual follow-up.</p>
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending}>Save outcome</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function DncDialog({ ids, onClose }: { ids: string[]; onClose: (msg?: string) => void }) {
  const a = useAction(bulkDoNotContact, {
    onSuccess: (d) => onClose(`Marked ${plural(d.count)} do not contact.`),
  });
  return (
    <Modal open onClose={() => onClose()} title={`Mark ${plural(ids.length)} do not contact?`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ contactIds: ids });
        }}
      >
        <p className="text-[13.5px]">
          No email or SMS will be sent to them, even from an approved campaign. You can turn it
          back off on each contact&rsquo;s page.
        </p>
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending}>
            Mark do not contact
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

