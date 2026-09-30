"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { runMatching } from "@/server/actions/matching";

/**
 * Starts a matching run for one listing or one contact, and says what happened in a
 * line under the button: how many matches, or why it could not run.
 */
export function RunMatchingButton({
  propertyId,
  listingId,
  contactId,
  label,
}: {
  propertyId?: string;
  listingId?: string;
  contactId?: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setPending(true);
    setNote(null);
    try {
      const r = await runMatching(
        propertyId ? { propertyId } : listingId ? { listingId } : { contactId },
      );
      if (!r.ok) setNote({ ok: false, text: r.error });
      else {
        setNote({ ok: r.data.ok, text: r.data.message });
        if (r.data.ok) router.refresh();
      }
    } catch {
      setNote({ ok: false, text: "Could not reach the server. Reload the page and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md bg-[#7a4fd6] text-white text-[12px] font-medium px-2.5 min-h-8 hover:opacity-90 disabled:opacity-60 whitespace-nowrap"
      >
        {pending ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
        {pending ? "Matching…" : label}
      </button>
      {note && (
        <p
          className={`text-[11.5px] max-w-[260px] text-right leading-snug ${
            note.ok ? "text-[#006300] dark:text-[#5fc45f]" : "text-[#b02f2f] dark:text-[#f08a8a]"
          }`}
        >
          {note.text}
        </p>
      )}
    </div>
  );
}
