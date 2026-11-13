"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { addSuburb } from "@/server/actions/suburbs";
import { AU_STATES, stateFromPostcode } from "@/lib/postcode";

type Option = { value: string; label: string };

/**
 * Suburb picker: type a name or postcode, choose from the list, or add a suburb that is
 * not on it yet (anywhere in Australia, state from the postcode). Posts `suburbId`.
 */
export function SuburbSearch({
  suburbs,
  errors,
  defaultValue,
  className = "col-span-2",
}: {
  suburbs: Option[];
  errors?: string[];
  defaultValue?: string | null;
  className?: string;
}) {
  const initial = defaultValue ? (suburbs.find((o) => o.value === defaultValue) ?? null) : null;
  const [extra, setExtra] = React.useState<Option[]>([]);
  const all = React.useMemo(() => [...extra, ...suburbs], [extra, suburbs]);
  const [text, setText] = React.useState(initial?.label ?? "");
  const [picked, setPicked] = React.useState<Option | null>(initial);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [adding, setAdding] = React.useState(false);
  const [pc, setPc] = React.useState("");
  const [st, setSt] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const q = text.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (q.length < 2) return [];
    const starts = all.filter((o) => o.label.toLowerCase().startsWith(q));
    const contains = all.filter((o) => !o.label.toLowerCase().startsWith(q) && o.label.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 10);
  }, [q, all]);

  const choose = (o: Option) => {
    setPicked(o);
    setText(o.label);
    setOpen(false);
    setAdding(false);
  };

  function startAdd() {
    const m = text.trim().match(/^(.*?)[\s,]*(\d{4})?$/);
    setText((m?.[1] ?? text).trim());
    if (m?.[2]) setPc(m[2]);
    setAdding(true);
    setOpen(false);
    setErr(null);
  }

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      const r = await addSuburb({ name: text.trim(), postcode: pc.trim(), state: st || undefined });
      if (!r.ok) setErr(r.fieldErrors ? Object.values(r.fieldErrors).flat()[0] ?? r.error : r.error);
      else {
        setExtra((prev) => [r.data, ...prev]);
        choose(r.data);
      }
    } catch {
      setErr("Could not reach the server. Reload and try again.");
    } finally {
      setBusy(false);
    }
  }

  const guessed = stateFromPostcode(pc);

  return (
    <div className={`${className} relative`}>
      <label htmlFor="suburb-search" className="block text-[12px] font-medium text-2 mb-1.5">
        Suburb
      </label>
      <input type="hidden" name="suburbId" value={picked?.value ?? ""} />
      <input
        id="suburb-search"
        role="combobox"
        aria-expanded={open && q.length >= 2}
        aria-controls="suburb-results"
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Type a suburb or postcode, anywhere in Australia…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPicked(null);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
        className={`w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 ${errors?.length ? "border-[#d03b3b]/60" : ""}`}
      />
      {open && q.length >= 2 && (
        <ul
          id="suburb-results"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto surface-2 border rounded-md shadow-lg text-[13.5px]"
        >
          {results.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-2 cursor-pointer ${i === active ? "bg-[var(--accent)] text-white" : "hover:surface-3"}`}
            >
              {o.label}
            </li>
          ))}
          <li
            role="option"
            aria-selected={false}
            onMouseDown={(e) => {
              e.preventDefault();
              startAdd();
            }}
            className="px-3 py-2 cursor-pointer text-[var(--accent)] font-medium border-t inline-flex items-center gap-1.5 w-full hover:surface-3"
          >
            <Plus size={14} /> Add &ldquo;{text.trim()}&rdquo; as a new suburb (any state)
          </li>
        </ul>
      )}
      {adding && (
        <div className="mt-2 rounded-md border surface-3 p-2.5 space-y-2">
          <div className="grid grid-cols-[1fr_90px_90px] gap-2">
            <input
              aria-label="Suburb name"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="surface-2 border rounded-md px-2 py-1.5 text-[16px] sm:text-[13px]"
            />
            <input
              aria-label="Postcode"
              placeholder="Postcode"
              inputMode="numeric"
              maxLength={4}
              value={pc}
              onChange={(e) => setPc(e.target.value.replace(/\D/g, ""))}
              className="surface-2 border rounded-md px-2 py-1.5 text-[16px] sm:text-[13px]"
            />
            <select
              aria-label="State"
              value={st}
              onChange={(e) => setSt(e.target.value)}
              className="surface-2 border rounded-md px-1.5 py-1.5 text-[16px] sm:text-[13px]"
            >
              <option value="">{guessed ? `${guessed} (auto)` : "State"}</option>
              {AU_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {err && <p className="text-[11.5px] text-[#b02f2f]">{err}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || pc.length !== 4 || text.trim().length < 2}
              onClick={add}
              className="rounded-md bg-[var(--accent)] text-white text-[12.5px] font-medium px-3 min-h-8 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add suburb"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-md surface-2 border text-[12.5px] px-3 min-h-8">
              Cancel
            </button>
          </div>
        </div>
      )}
      {text && !picked && !open && !adding && (
        <p className="text-[11.5px] text-[#b02f2f] mt-1">Pick a suburb from the list, or add it.</p>
      )}
      {errors?.map((m) => (
        <p key={m} className="text-[11.5px] text-[#b02f2f] mt-1">
          {m}
        </p>
      ))}
    </div>
  );
}
