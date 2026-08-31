"use client";

import * as React from "react";
import { Users, ShieldAlert, PhoneOff, Ban, UserX, Save, Loader2, X } from "lucide-react";
import {
  useAction,
  Modal,
  Input,
  Select,
  SubmitButton,
  CancelButton,
  FormError,
  RowButton,
  ConfirmButton,
} from "./action-form";
import { previewAudience, saveSegment, deleteSegment } from "@/server/actions/segments";
import type { SegmentFilter } from "@/server/segments/schema";
import type { SegmentPreview } from "@/server/segments/preview";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };
export type SavedSegment = {
  id: string;
  name: string;
  description: string | null;
  filter: SegmentFilter;
  applicable: boolean;
};

export type BuilderOptions = {
  listings: Option[];
  suburbs: Option[];
  roles: Option[];
  intents: Option[];
  sentiments: Option[];
  propertyTypes: Option[];
  timelines: Option[];
  financeStatuses: Option[];
  campaigns: Option[];
  saved: SavedSegment[];
};

/**
 * The segment builder.
 *
 * The panel on the right is the point of the screen. "38 people match" is not enough
 * to press send on — the number that stops a mistake is "and 6 more would have, except
 * four never gave SMS consent and two have no mobile on file". An agent seeing that
 * goes and fixes two records instead of quietly reaching 38 people when they meant 44.
 */
export function SegmentBuilder({
  options,
  initialSegmentId,
  onAudience,
}: {
  options: BuilderOptions;
  /** Opens with a saved segment already applied, so a chip elsewhere can link here. */
  initialSegmentId?: string;
  /** Called whenever the audience settles, so the parent can enable "draft messages". */
  onAudience?: (filter: SegmentFilter, preview: SegmentPreview) => void;
}) {
  const opening = initialSegmentId
    ? (options.saved.find((v) => v.id === initialSegmentId) ?? null)
    : null;
  const [filter, setFilter] = React.useState<SegmentFilter>(
    opening ? { ...EMPTY, ...opening.filter } : EMPTY,
  );
  const [preview, setPreview] = React.useState<
    (SegmentPreview & { description: string }) | null
  >(null);
  const [loadedFrom, setLoadedFrom] = React.useState<SavedSegment | null>(opening);
  const run = useAction(previewAudience, { refreshOnSuccess: false });

  const set = <K extends keyof SegmentFilter>(key: K, value: SegmentFilter[K]) =>
    setFilter((f) => ({ ...f, [key]: value }));

  /**
   * Debounced, because this runs a couple of aggregate queries and the agent is
   * typing. 350ms is long enough that a four-digit price is one query rather than
   * four, and short enough that the number feels attached to the control.
   */
  const runRef = React.useRef(run.run);
  runRef.current = run.run;
  const onAudienceRef = React.useRef(onAudience);
  onAudienceRef.current = onAudience;

  /**
   * `stale` is the whole reason this is not just `if (r.ok) setPreview(...)`.
   *
   * When the filter is rejected — a number past the schema's ceiling, say — the last
   * good preview is still in state, and rendering it plainly tells the agent that
   * their new criterion matches those people. It does not; it was never run. The
   * count is dimmed and labelled instead, which is the read-path equivalent of the
   * "a write that fails silently is worse than one that never happened" rule the rest
   * of this form kit is built on.
   */
  const [stale, setStale] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(async () => {
      const r = await runRef.current({ filter });
      if (r.ok) {
        setPreview(r.data);
        setStale(false);
        onAudienceRef.current?.(filter, r.data);
      } else {
        setStale(true);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [filter]);

  function apply(v: SavedSegment) {
    setLoadedFrom(v);
    setFilter({ ...EMPTY, ...v.filter });
  }

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4 items-start">
      <div className="space-y-4 min-w-0">
        {options.saved.length > 0 && (
          <Card title="Saved segments">
            <div className="flex flex-wrap gap-2">
              {options.saved.map((v) => (
                <span key={v.id} className="inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => apply(v)}
                    title={v.description ?? undefined}
                    className={cn(
                      "text-[12px] border rounded-l-md px-2.5 py-1.5 hover:border-[var(--line-strong)] transition-colors",
                      loadedFrom?.id === v.id ? "accent-soft border-[var(--accent)]" : "surface-3",
                      // A view saved before the filter schema existed holds the seed's
                      // placeholder and narrows nothing. Saying so beats a chip that
                      // appears to work and returns everyone.
                      !v.applicable && "opacity-55",
                    )}
                  >
                    <span className="font-medium">{v.name}</span>
                    {!v.applicable && (
                      <span className="text-3 ml-1.5">· no criteria</span>
                    )}
                  </button>
                  <ConfirmButton
                    action={deleteSegment}
                    input={{ id: v.id }}
                    confirmLabel="Delete"
                    title="Delete this segment"
                    className="-ml-px"
                  >
                    <X size={10} />
                  </ConfirmButton>
                </span>
              ))}
            </div>
          </Card>
        )}

        <Card title="Anchor to a listing">
          <Select
            label="Listing"
            name="listingId"
            value={filter.listingId ?? ""}
            onChange={(e) => set("listingId", e.target.value)}
            options={[{ value: "", label: "Not about one property" }, ...options.listings]}
          />
          <Hint>
            Anchoring starts from that listing&apos;s ranked matches, and each
            match&apos;s written reason becomes material for the message. The criteria
            below still apply on top.
          </Hint>
        </Card>

        <Card title="What they want">
          <div className="grid sm:grid-cols-2 gap-3">
            <NumberField
              label="Budget reaches at least"
              value={filter.budgetAtLeast}
              onChange={(v) => set("budgetAtLeast", v)}
              placeholder="650000"
            />
            <NumberField
              label="Budget starts no higher than"
              value={filter.budgetAtMost}
              onChange={(v) => set("budgetAtMost", v)}
              placeholder="900000"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <NumberField
              label="Beds"
              max={30}
              value={filter.bedsAtLeast}
              onChange={(v) => set("bedsAtLeast", v)}
            />
            <NumberField
              label="Baths"
              max={30}
              value={filter.bathsAtLeast}
              onChange={(v) => set("bathsAtLeast", v)}
            />
            <NumberField
              label="Car"
              max={30}
              value={filter.parkingAtLeast}
              onChange={(v) => set("parkingAtLeast", v)}
            />
          </div>
          <ChipGroup
            label="Property type"
            options={options.propertyTypes}
            selected={filter.propertyTypes ?? []}
            onChange={(v) => set("propertyTypes", v.length ? (v as never) : undefined)}
          />
          <ChipGroup
            label="Suburbs they want"
            options={options.suburbs}
            selected={filter.wantsSuburbIds ?? []}
            onChange={(v) => set("wantsSuburbIds", v.length ? v : undefined)}
          />
          <Hint>
            Where they want to buy, from the suburbs on their record — not where they
            live now, which is a different question and a different field.
          </Hint>
        </Card>

        <Card title="Who they are">
          <ChipGroup
            label="Role"
            options={options.roles}
            selected={filter.roles ?? []}
            onChange={(v) => set("roles", v.length ? (v as never) : undefined)}
          />
          <label className="flex items-center gap-2 text-[12.5px] mt-1.5">
            <input
              type="checkbox"
              checked={filter.includeLapsedRoles}
              onChange={(e) => set("includeLapsedRoles", e.target.checked)}
            />
            Include roles that have lapsed
          </label>
          <ChipGroup
            label="Intent"
            options={options.intents}
            selected={filter.intentTypes ?? []}
            onChange={(v) => set("intentTypes", v.length ? (v as never) : undefined)}
          />
          <ChipGroup
            label="Sentiment"
            options={options.sentiments}
            selected={filter.sentiments ?? []}
            onChange={(v) => set("sentiments", v.length ? (v as never) : undefined)}
          />
          <Hint>
            Intent and sentiment are derived from the conversation log and rebuilt after
            every touch, so a segment on them can shift under you between now and
            sending.
          </Hint>
        </Card>

        <Card title="Where they are up to">
          <ChipGroup
            label="Timeline"
            options={options.timelines}
            selected={filter.timelineAny ?? []}
            onChange={(v) => set("timelineAny", v.length ? v : undefined)}
            empty="Nothing recorded yet."
          />
          <ChipGroup
            label="Finance"
            options={options.financeStatuses}
            selected={filter.financeStatusAny ?? []}
            onChange={(v) => set("financeStatusAny", v.length ? v : undefined)}
            empty="Nothing recorded yet."
          />
          <Hint>
            These come from what has actually been written on records, with the count
            beside each. There is no fixed list to choose from — the wording is whatever
            the conversation produced.
          </Hint>
        </Card>

        <Card title="Leave people alone">
          <div className="grid sm:grid-cols-2 gap-3">
            <NumberField
              label="Not contacted in the last N days"
              max={3650}
              value={filter.notContactedWithinDays}
              onChange={(v) => set("notContactedWithinDays", v)}
              placeholder="14"
            />
            <div>
              <span className="block text-[12px] font-medium text-2 mb-1.5">
                Lives in suburb
              </span>
              <input
                value={filter.livesInSuburb ?? ""}
                onChange={(e) => set("livesInSuburb", e.target.value || undefined)}
                placeholder="Norwood"
                className="w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>
          </div>
          <ChipGroup
            label="Already sent one of these"
            options={options.campaigns}
            selected={filter.excludeCampaignIds ?? []}
            onChange={(v) => set("excludeCampaignIds", v.length ? v : undefined)}
            empty="No campaign has sent anything yet."
          />
        </Card>

        <Card title="Unstated values">
          <label className="flex items-start gap-2 text-[12.5px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={filter.includeUnknowns}
              onChange={(e) => set("includeUnknowns", e.target.checked)}
            />
            <span>
              Also include people whose record does not say
              <Hint className="mt-1">
                Off by default. Asking for a budget of $800k means people whose budget
                reaches $800k — someone with no budget recorded is{" "}
                <strong>unknown, not yes</strong>. Turning this on adds them back, which
                is right for a general market update and wrong for a targeted one.
              </Hint>
            </span>
          </label>
        </Card>
      </div>

      <AudiencePanel
        preview={preview}
        pending={run.pending}
        error={run.error}
        stale={stale}
        filter={filter}
        loadedFrom={loadedFrom}
      />
    </div>
  );
}

/* ------------------------------------------------------------- the panel */

function AudiencePanel({
  preview,
  pending,
  error,
  stale,
  filter,
  loadedFrom,
}: {
  preview: (SegmentPreview & { description: string }) | null;
  pending: boolean;
  error: string | null;
  stale: boolean;
  filter: SegmentFilter;
  loadedFrom: SavedSegment | null;
}) {
  const x = preview?.excluded;
  return (
    <div className="lg:sticky lg:top-[76px] space-y-3">
      <div className="surface-2 border rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-3" />
          <span className="text-[11px] uppercase tracking-[0.06em] text-3 font-medium">
            Audience
          </span>
          {pending && <Loader2 size={12} className="animate-spin text-3 ml-auto" />}
        </div>

        <div
          className={cn(
            "text-[34px] font-semibold tabular leading-none mt-2",
            stale && "opacity-40",
          )}
        >
          {preview ? preview.eligible : "—"}
        </div>
        <div className="text-3 text-[12px] mt-1">
          {stale
            ? "not counted — the criteria below were refused"
            : preview
              ? `of ${preview.matchedCriteria} matching, who can be messaged`
              : "working it out…"}
        </div>

        {error && (
          <div className="text-[11.5px] text-[#b02f2f] dark:text-[#f08a8a] mt-2 leading-snug">
            {error}
          </div>
        )}

        {!stale && preview && preview.excludedTotal > 0 && x && (
          <div className="mt-3 pt-3 border-t space-y-1.5">
            <div className="text-[11.5px] font-medium">
              {preview.excludedTotal} matched but cannot be messaged
            </div>
            <Reason icon={ShieldAlert} n={x.noConsent} what="no SMS consent on record" />
            <Reason icon={PhoneOff} n={x.noMobile} what="no mobile number" />
            <Reason icon={Ban} n={x.doNotContact} what="marked do-not-contact" />
            <Reason icon={UserX} n={x.notLive} what="removed or merged away" />
            {/* The causes overlap — one person can be two of these — so they are not
                presented as adding up to the total. */}
            <p className="text-3 text-[11px] leading-relaxed pt-1">
              Reasons can overlap, so these do not sum. Consent is re-checked at the
              moment of sending, so this is an estimate — anyone who opts out between
              now and then is blocked then, and shown.
            </p>
          </div>
        )}

        {!stale && preview && preview.eligible === 0 && (
          <p className="text-3 text-[11.5px] leading-relaxed mt-3 pt-3 border-t">
            Nobody. Either the criteria are too narrow, or the people who match cannot
            be contacted — the breakdown above says which.
          </p>
        )}
      </div>

      {!stale && preview && (
        <div className="surface-2 border rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-3 font-medium mb-1.5">
            In words
          </div>
          <p className="text-[12.5px] leading-relaxed">{preview.description}</p>
        </div>
      )}

      <SaveSegmentButton filter={filter} loadedFrom={loadedFrom} />

      {!stale && preview && preview.sample.length > 0 && (
        <div className="surface-2 border rounded-lg p-3">
          <div className="text-[11px] uppercase tracking-[0.06em] text-3 font-medium mb-2">
            Who they are
          </div>
          <ul className="space-y-1.5 max-h-[320px] overflow-y-auto">
            {preview.sample.slice(0, 60).map((c) => (
              <li key={c.id} className="text-[12px] leading-snug">
                <span className="font-medium">
                  {c.firstName} {c.lastName}
                </span>
                <span className="text-3">
                  {c.intentType ? ` · ${c.intentType}` : ""}
                  {c.budgetBand ? ` · ${c.budgetBand}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {preview.eligible > 60 && (
            <div className="text-3 text-[11px] mt-2">
              …and {preview.eligible - 60} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Reason({
  icon: Icon,
  n,
  what,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  n: number;
  what: string;
}) {
  if (n === 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[11.5px] text-2">
      <Icon size={11} className="shrink-0 text-3" />
      <span className="tabular font-medium">{n}</span>
      <span className="text-3">{what}</span>
    </div>
  );
}

/* --------------------------------------------------------------- saving */

function SaveSegmentButton({
  filter,
  loadedFrom,
}: {
  filter: SegmentFilter;
  loadedFrom: SavedSegment | null;
}) {
  const [open, setOpen] = React.useState(false);
  const a = useAction(saveSegment, { onSuccess: () => setOpen(false) });

  return (
    <>
      <RowButton
        onClick={() => {
          a.reset();
          setOpen(true);
        }}
        className="w-full justify-center"
      >
        <Save size={11} />
        Save this segment
      </RowButton>

      <Modal open={open} onClose={() => setOpen(false)} title="Save segment">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            a.run({
              name: f.get("name"),
              description: f.get("description") ?? "",
              filter,
              id: f.get("overwrite") === "on" && loadedFrom ? loadedFrom.id : "",
            });
          }}
        >
          <Input
            label="Name"
            name="name"
            required
            defaultValue={loadedFrom?.name ?? ""}
            placeholder="Pre-approved buyers, eastern suburbs"
            errors={a.fieldErrors.name}
          />
          <Input
            label="Note"
            name="description"
            placeholder="Left blank, this is written from the criteria"
            errors={a.fieldErrors.description}
          />
          {loadedFrom && (
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="checkbox" name="overwrite" defaultChecked />
              Save over &ldquo;{loadedFrom.name}&rdquo; rather than creating a new one
            </label>
          )}
          <p className="text-3 text-[11px]">
            A saved segment stores the question, not the people. It finds whoever
            matches on the day it is used.
          </p>
          <FormError message={a.error} />
          <div className="flex gap-2 pt-1">
            <SubmitButton pending={a.pending}>Save</SubmitButton>
            <CancelButton onClick={() => setOpen(false)} />
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------- controls */

const EMPTY: SegmentFilter = {
  includeLapsedRoles: false,
  includeUnknowns: false,
} as SegmentFilter;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-2 border rounded-lg p-4">
      <div className="text-[13px] font-semibold mb-3">{title}</div>
      {children}
    </div>
  );
}

function Hint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-3 text-[11px] leading-relaxed mt-2", className)}>{children}</p>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  max = 50_000_000,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  /** Mirrors the schema's ceiling, so the control cannot produce a rejected filter. */
  max?: number;
}) {
  return (
    <div>
      <span className="block text-[12px] font-medium text-2 mb-1.5">{label}</span>
      <input
        type="number"
        min="0"
        max={max}
        value={value ?? ""}
        placeholder={placeholder}
        // Blank clears the criterion rather than setting it to zero — "not set" and
        // "zero" are different facts and the schema keeps them apart.
        onChange={(e) =>
          onChange(e.target.value === "" ? undefined : Number(e.target.value))
        }
        className="w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
      />
    </div>
  );
}

function ChipGroup({
  label,
  options,
  selected,
  onChange,
  empty,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
  empty?: string;
}) {
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);

  return (
    <div className="mt-3">
      <span className="block text-[12px] font-medium text-2 mb-1.5">{label}</span>
      {options.length === 0 ? (
        <span className="text-3 text-[11.5px]">{empty ?? "Nothing to choose from."}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5 max-h-[132px] overflow-y-auto">
          {options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => toggle(o.value)}
                className={cn(
                  "text-[12px] border rounded-md px-2 min-h-7 transition-colors",
                  on
                    ? "accent-soft border-[var(--accent)] font-medium"
                    : "surface-3 hover:border-[var(--line-strong)]",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
