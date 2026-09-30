"use client";

import * as React from "react";
import { useAction, FormError } from "./action-form";
import { setSiteSettings } from "@/server/actions/website";

/**
 * One website on/off switch. Saves as soon as it is flipped, and says so, because a
 * setting that changes the public site should never leave anyone wondering whether
 * it took.
 */
export function SiteToggle({
  setting,
  value,
  label,
  hint,
}: {
  setting: "homeListingFilters";
  value: boolean;
  label: string;
  hint: string;
}) {
  const [on, setOn] = React.useState(value);
  const a = useAction(setSiteSettings);

  async function flip() {
    const next = !on;
    setOn(next);
    const r = await a.run({ [setting]: next });
    if (!r.ok) setOn(!next);
  }

  return (
    <div>
      <div className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={flip}
          disabled={a.pending}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors mt-0.5 disabled:opacity-60 ${
            on ? "bg-[var(--accent)]" : "bg-[var(--line-strong)]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              on ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium">{label}</div>
          <p className="text-2 text-[12.5px] mt-0.5">{hint}</p>
          <p className="text-3 text-[11.5px] mt-1">
            {a.pending ? "Saving…" : a.succeeded ? `Saved: ${on ? "shown" : "hidden"} on the site.` : on ? "Shown" : "Hidden"}
          </p>
        </div>
      </div>
      <FormError message={a.error} />
    </div>
  );
}
