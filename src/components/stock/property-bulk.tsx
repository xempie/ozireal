"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useAction, Modal, Select, FormError, SubmitButton, CancelButton } from "@/components/forms/action-form";
import {
  bulkSetPropertyStatus,
  bulkWebsite,
  bulkRematch,
  bulkDeleteProperties,
} from "@/server/actions/properties-bulk";

/**
 * Selection and bulk actions for the property list (2026-11-12), the same pattern as
 * the contacts table: the table stays a Server Component; tick boxes and the bar are
 * client islands sharing one Set.
 */

type Ctx = { selected: Set<string>; toggle: (id: string) => void; setAll: (on: boolean) => void; allIds: string[]; clear: () => void };
const SelCtx = React.createContext<Ctx | null>(null);
const useSel = () => {
  const c = React.useContext(SelCtx);
  if (!c) throw new Error("Property selection controls must sit inside <PropertyBulk>.");
  return c;
};

export function PropertyBulk({ allIds, names, children }: { allIds: string[]; names: Record<string, string>; children: React.ReactNode }) {
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
    <SelCtx.Provider value={value}>
      <Bar names={names} />
      {children}
    </SelCtx.Provider>
  );
}

export function PropertySelectAll() {
  const { selected, allIds, setAll } = useSel();
  const all = allIds.length > 0 && selected.size === allIds.length;
  return (
    <input
      type="checkbox"
      aria-label="Select all properties"
      className="size-4 accent-[var(--accent)]"
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = selected.size > 0 && !all;
      }}
      onChange={(e) => setAll(e.target.checked)}
    />
  );
}

export function PropertyRowBox({ id, name }: { id: string; name: string }) {
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

const plural = (k: number) => `${k} propert${k === 1 ? "y" : "ies"}`;
type Dialog = null | "status" | "live" | "withdraw" | "delete";

function Bar({ names }: { names: Record<string, string> }) {
  const { selected, allIds, setAll, clear } = useSel();
  const [dialog, setDialog] = React.useState<Dialog>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const ids = [...selected];
  const n = ids.length;

  const rematch = useAction(bulkRematch, {
    onSuccess: (d) => {
      clear();
      setNotice(`Matching again for ${plural(d.count)}${d.skipped ? ` (${d.skipped} sold or archived, skipped)` : ""}. New matches appear in a minute or two.`);
    },
  });

  if (!n) {
    return notice ? (
      <div role="status" className="mb-3 rounded-md border px-3 py-2 text-[13px] surface-2 flex items-center gap-2">
        <span className="flex-1">{notice}</span>
        <button aria-label="Dismiss" onClick={() => setNotice(null)}>
          <X size={14} />
        </button>
      </div>
    ) : null;
  }

  const btn = "min-h-9 px-3 rounded-md border border-white/25 text-[13px] hover:bg-white/10 disabled:opacity-50";
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
        <button className={btn} onClick={() => setDialog("status")}>Change status</button>
        <button className={btn} onClick={() => setDialog("live")}>Put on website</button>
        <button className={btn} onClick={() => setDialog("withdraw")}>Take off website</button>
        <button className={btn} disabled={rematch.pending} onClick={() => rematch.run({ propertyIds: ids })}>
          {rematch.pending ? "Starting…" : "Match again"}
        </button>
        <button className="min-h-9 px-3 rounded-md bg-[#D84315] text-[13px] font-semibold hover:bg-[#bf3a10]" onClick={() => setDialog("delete")}>
          Delete…
        </button>
        <button aria-label="Clear selection" className="min-h-9 px-2" onClick={clear}>
          <X size={16} />
        </button>
        {rematch.error && <p className="basis-full text-[12.5px] text-[#FFB4A0]">{rematch.error}</p>}
      </div>

      {dialog === "status" && <StatusDialog ids={ids} onClose={close} />}
      {(dialog === "live" || dialog === "withdraw") && <WebsiteDialog ids={ids} to={dialog === "live" ? "live" : "withdrawn"} onClose={close} />}
      {dialog === "delete" && <DeleteDialog ids={ids} names={names} onClose={close} />}
    </>
  );
}

const STATUSES = [
  { value: "prospect", label: "Prospect" },
  { value: "appraised", label: "Appraised" },
  { value: "off_market", label: "Off market" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived (hidden, not matched)" },
];

function StatusDialog({ ids, onClose }: { ids: string[]; onClose: (msg?: string) => void }) {
  const [status, setStatus] = React.useState("off_market");
  const a = useAction(bulkSetPropertyStatus, {
    onSuccess: (d) => onClose(`Set ${plural(d.count)} to ${STATUSES.find((s) => s.value === status)?.label.split(" (")[0]}.`),
  });
  return (
    <Modal open onClose={() => onClose()} title={`Change the status of ${plural(ids.length)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ propertyIds: ids, status });
        }}
      >
        <Select label="New status" name="status" value={status} onChange={(e) => setStatus(e.target.value)} options={STATUSES} />
        <p className="text-[12.5px] text-2">Sold and archived properties drop out of matching; the others are matched again.</p>
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending}>Change status</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function WebsiteDialog({ ids, to, onClose }: { ids: string[]; to: "live" | "withdrawn"; onClose: (msg?: string) => void }) {
  const live = to === "live";
  const a = useAction(bulkWebsite, {
    onSuccess: (d) =>
      onClose(
        `${live ? "Put" : "Took"} ${plural(d.count)} ${live ? "on" : "off"} the website.` +
          (d.skipped ? ` ${d.skipped} skipped: ${d.reasons.join("; ")}` : ""),
      ),
  });
  return (
    <Modal open onClose={() => onClose()} title={`${live ? "Put" : "Take"} ${plural(ids.length)} ${live ? "on" : "off"} the website?`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ propertyIds: ids, to });
        }}
      >
        <p className="text-[13.5px]">
          {live
            ? "Each property's draft listing goes live on www.ozirealty.com.au. Ones without a draft listing, or still missing what a live listing needs (like the price wording), are skipped and named."
            : "Each property's live listing is withdrawn from the website. It stays in the CRM and can go back on any time."}
        </p>
        <FormError message={a.error} />
        <div className="flex justify-end gap-2">
          <CancelButton onClick={() => onClose()} />
          <SubmitButton pending={a.pending}>{live ? "Put on website" : "Take off website"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ ids, names, onClose }: { ids: string[]; names: Record<string, string>; onClose: (msg?: string) => void }) {
  const a = useAction(bulkDeleteProperties, {
    onSuccess: (d) =>
      onClose(`Deleted ${plural(d.count)}.${d.skipped ? ` ${d.skipped} kept: they have been on the website (archive them instead).` : ""}`),
  });
  const shown = ids.slice(0, 5).map((id) => names[id]).join(", ");
  const more = ids.length > 5 ? ` and ${ids.length - 5} more` : "";
  return (
    <Modal open onClose={() => onClose()} title={`Delete ${plural(ids.length)}?`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          a.run({ propertyIds: ids });
        }}
      >
        <p className="text-[13.5px]">
          {shown}
          {more} will be deleted, with their draft listings, photos and matches. This cannot be undone.
        </p>
        <p className="text-[12.5px] text-2 surface-1 rounded-md p-2.5">
          Any that have been advertised on the website are kept for the sold archive; archive those instead.
        </p>
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
