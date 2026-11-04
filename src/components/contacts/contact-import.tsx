"use client";

import * as React from "react";
import { Upload } from "lucide-react";
import {
  useAction,
  Modal,
  Select,
  Input,
  Textarea,
  FormError,
  SubmitButton,
  CancelButton,
} from "@/components/forms/action-form";
import { importContacts, type ImportPreviewRow } from "@/server/actions/contacts-import";
import { detectAddressKind, type AddressKind } from "@/lib/address-kind";

/**
 * Import contacts from a CSV, Excel or vCard file (2026-11-04).
 *
 * The file is read here, in the browser: the server only ever sees mapped rows. Two
 * presses, like the property import — Check shows what would happen, Import saves the
 * ticked rows.
 */

const MAX_BYTES = 10 * 1024 * 1024;

type Field =
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "phone"
  | "phone2"
  | "suburb"
  | "address"
  | "tags"
  | "created"
  | "note"
  | "skip";
const FIELDS: { value: Field; label: string }[] = [
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "fullName", label: "Full name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Mobile (main number)" },
  { value: "phone2", label: "Second number" },
  { value: "suburb", label: "Suburb" },
  { value: "address", label: "Address" },
  { value: "tags", label: "Tags" },
  { value: "created", label: "Date added" },
  { value: "note", label: "Note on their history" },
  { value: "skip", label: "Don't import" },
];

/**
 * Guess a column from its heading. Status, label and type columns are never data: a Wix
 * export puts "Email subscriber status" beside "Email 1", and reading the status as the
 * address skipped every row (2026-11-04).
 */
function guess(h: string): Field {
  const s = h.toLowerCase().replace(/[^a-z]/g, "");
  if (/^(tags?|labels?|groups?|categor(y|ies)|segments?)$/.test(s)) return "tags";
  if (/^(created|createdat|createdon|datecreated|dateadded|added|addedon|signedup|signupdate|joined|datejoined)/.test(s)) return "created";
  if (/(status|subscri|consent|optin|optout|label|type|verified|date|count)/.test(s)) return "skip";
  if (/(mobile|cell)/.test(s)) return "phone";
  if (/(phone|tel|landline)/.test(s)) return "phone2";
  if (/^(first|given|firstname|givenname|fname)/.test(s)) return "firstName";
  if (/^(last|surname|family|lastname|familyname|lname)/.test(s)) return "lastName";
  if (/^(name|fullname|contactname|displayname)$/.test(s)) return "fullName";
  if (s.includes("email") || s.includes("mail")) return "email";
  if (/(address|street|location|area|lookingin|preferred)/.test(s)) return "address";
  if (/(suburb|city|town|locality)/.test(s)) return "suburb";
  if (/(note|comment|message)/.test(s)) return "note";
  return "skip";
}

/**
 * A file's date cell to ISO, or null. Australian order for slashes (12/05/2024 is
 * 12 May); ISO and "2024-05-12 10:22" as written; anything unreadable is left out
 * rather than guessed.
 */
function toIsoDate(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const au = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(t);
  let d: Date;
  if (au) {
    const y = au[3].length === 2 ? 2000 + Number(au[3]) : Number(au[3]);
    d = new Date(y, Number(au[2]) - 1, Number(au[1]), Number(au[4] ?? 0), Number(au[5] ?? 0), Number(au[6] ?? 0));
  } else {
    d = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(t) ? t.replace(" ", "T") : t);
  }
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 1990 || d > new Date()) return null;
  return d.toISOString();
}

/** RFC 4180 CSV (quotes, doubled quotes, newlines in quotes); tab-separated when tabs win. */
function parseDelimited(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const sep = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === sep) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); out.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((c) => c.trim()));
}

/** vCard (.vcf): one row per card, with fixed headings so the guesses land. */
function parseVcf(text: string): string[][] {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const rows: string[][] = [["First name", "Last name", "Email", "Phone", "Suburb", "Note"]];
  for (const card of unfolded.split(/BEGIN:VCARD/i).slice(1)) {
    const get = (k: string) =>
      card.match(new RegExp(`^${k}(?:;[^:]*)?:(.*)$`, "im"))?.[1]?.trim() ?? "";
    const [last = "", first = ""] = get("N").split(";");
    const fn = get("FN");
    const adr = get("ADR").split(";");
    rows.push([
      first || fn.split(" ")[0] || "",
      last || fn.split(" ").slice(1).join(" "),
      get("EMAIL"),
      get("TEL"),
      adr[3] ?? "",
      get("NOTE").replace(/\\n/g, "\n"),
    ]);
  }
  return rows;
}

async function readTable(file: File): Promise<string[][]> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "xlsx") {
    const { readSheet } = await import("read-excel-file/browser");
    const data = await readSheet(file);
    return data.map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString() : String(c))));
  }
  const text = await file.text();
  if (ext === "vcf") return parseVcf(text);
  if (ext === "csv" || ext === "tsv" || ext === "txt") return parseDelimited(text.replace(/^﻿/, ""));
  throw new Error("Upload a .csv, .xlsx, .tsv or .vcf file. From Excel's older .xls, save as .xlsx or CSV first.");
}

const ROLE_OPTIONS = [
  { value: "", label: "No role" },
  ...["buyer", "vendor", "landlord", "tenant", "referrer", "investor", "business_vendor", "agent"].map((r) => ({
    value: r,
    label: r.replace("_", " "),
  })),
];

const STATUS_STYLE: Record<ImportPreviewRow["status"], string> = {
  new: "text-[#1B6B3F]",
  update: "text-[#0034C8]",
  duplicate: "text-[#8A4B00]",
  skip: "text-[#A12A12]",
};

export function ImportContactsButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3"
      >
        <Upload size={13} />
        Import
      </button>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const [fileName, setFileName] = React.useState("");
  const [readError, setReadError] = React.useState<string | null>(null);
  const [table, setTable] = React.useState<string[][]>([]);
  const [map, setMap] = React.useState<Field[]>([]);
  const [role, setRole] = React.useState("");
  const [addressMeans, setAddressMeans] = React.useState<"auto" | AddressKind>("auto");
  const [source, setSource] = React.useState("");
  const [consentOn, setConsentOn] = React.useState(true);
  const [cEmail, setCEmail] = React.useState(true);
  const [cSms, setCSms] = React.useState(true);
  const [wording, setWording] = React.useState("");
  const [preview, setPreview] = React.useState<ImportPreviewRow[] | null>(null);
  const [keep, setKeep] = React.useState<Set<number>>(new Set());
  const [done, setDone] = React.useState<string | null>(null);

  const headers = table[0] ?? [];
  const body = table.slice(1);

  const rows = React.useMemo(
    () =>
      body.map((cells) => {
        const r = {
          firstName: "",
          lastName: "",
          email: "",
          phone: "",
          phone2: "",
          suburb: "",
          address: "",
          addressKind: "lives" as AddressKind,
          createdAt: null as string | null,
          note: "",
          tags: [] as string[],
        };
        map.forEach((f, i) => {
          const v = (cells[i] ?? "").trim();
          if (!v || f === "skip") return;
          if (f === "fullName") {
            const parts = v.split(/\s+/);
            r.firstName ||= parts[0] ?? "";
            r.lastName ||= parts.slice(1).join(" ");
          } else if (f === "address") {
            if (!r.address) {
              r.address = v;
              r.addressKind = addressMeans === "auto" ? detectAddressKind(headers[i] ?? "", v) : addressMeans;
            }
          } else if (f === "created") {
            r.createdAt ||= toIsoDate(v);
          } else if (f === "tags") {
            for (const t of v.split(/[,;|]/)) {
              const x = t.trim().slice(0, 60);
              if (x && !r.tags.includes(x)) r.tags.push(x);
            }
          } else if (f === "note") r.note = r.note ? `${r.note}\n${v}` : v;
          else r[f] ||= v;
        });
        return r;
      }),
    [body, map, headers, addressMeans],
  );

  const check = useAction(importContacts, {
    refreshOnSuccess: false,
    onSuccess: (d) => {
      setPreview(d.preview);
      setKeep(new Set(d.preview.flatMap((p, i) => (p.status === "skip" ? [] : [i]))));
    },
  });
  const save = useAction(importContacts, {
    onSuccess: (d) => {
      const s = d.saved!;
      setDone(
        `Imported: ${s.created} new, ${s.updated} updated${s.merges ? `, ${s.merges} sent to merge review` : ""}.`,
      );
    },
  });

  async function onFile(file: File | undefined) {
    setReadError(null);
    setPreview(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setReadError("That file is over 10 MB.");
    try {
      const t = await readTable(file);
      if (t.length < 2) throw new Error("No rows found under the heading row.");
      setFileName(file.name);
      setTable(t);
      // One column per field: a second "Email 2" or "Phone 2" is left for the person to choose.
      const used = new Set<Field>();
      const guesses = t[0].map(guess);
      // No mobile column: the first other phone becomes the main number.
      const firstPhone2 = guesses.indexOf("phone2");
      if (!guesses.includes("phone") && firstPhone2 >= 0) guesses[firstPhone2] = "phone";
      setMap(
        guesses.map((g) => {
          if (g === "skip" || g === "note" || g === "tags") return g;
          if (used.has(g)) return "skip";
          used.add(g);
          return g;
        }),
      );
      setSource((s) => s || file.name.replace(/\.[^.]+$/, ""));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "The file could not be read.");
    }
  }

  const payload = (commit: boolean) => ({
    rows,
    keep: [...keep],
    commit,
    role: role || null,
    source,
    consent: consentOn ? { email: cEmail, sms: cSms, wording } : null,
  });

  const counts = preview?.reduce(
    (a, p) => ({ ...a, [p.status]: (a[p.status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const fe = { ...check.fieldErrors, ...save.fieldErrors };
  // The generic "Some fields need attention" names no field; say what is actually wrong.
  const shown = new Set([...(fe.source ?? []), ...(fe.consent ?? [])]);
  const other = Object.values(fe).flat().filter((m) => !shown.has(m));
  const raw = check.error ?? save.error;
  const error = raw && Object.keys(fe).length ? (other.length ? other.join(" ") : "Fill in the highlighted field above.") : raw;

  return (
    <Modal open onClose={onClose} title="Import contacts" wide>
      {done ? (
        <div className="space-y-3">
          <p role="status" className="text-[14px] font-medium">{done}</p>
          <div className="flex justify-end">
            <SubmitButton pending={false} onClick={onClose} type="button">Close</SubmitButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="flex flex-col gap-2 rounded-lg border border-dashed p-4 text-[13px] cursor-pointer surface-1">
            <span className="font-medium">{fileName || "Choose a file"}</span>
            <span className="text-2 text-[12.5px]">
              CSV, Excel (.xlsx), tab-separated or vCard (.vcf), with one heading row. Google and
              Outlook contact exports work as they are.
            </span>
            <input
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.vcf,text/csv,text/vcard"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
          </label>
          <FormError message={readError} />

          {headers.length > 0 && (
            <>
              <div>
                <h3 className="text-[13px] font-semibold mb-2">
                  Columns ({body.length} rows read)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {headers.map((h, i) => (
                    <Select
                      key={i}
                      label={h || `Column ${i + 1}`}
                      name={`col-${i}`}
                      value={map[i]}
                      onChange={(e) => {
                        const next = [...map];
                        next[i] = e.target.value as Field;
                        setMap(next);
                        setPreview(null);
                      }}
                      options={FIELDS}
                    />
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Select label="Give everyone the role" name="role" value={role} onChange={(e) => setRole(e.target.value)} options={ROLE_OPTIONS} />
                <Input label="Where this list came from" name="source" value={source} onChange={(e) => setSource(e.target.value)} errors={fe.source} />
              </div>

              {map.includes("address") && (
                <fieldset className="rounded-lg border p-3 space-y-2">
                  <legend className="px-1 text-[13px] font-medium">The address column is</legend>
                  <label className="flex items-start gap-2 text-[13px]">
                    <input
                      type="radio"
                      name="addressMeans"
                      checked={addressMeans === "auto"}
                      onChange={() => {
                        setAddressMeans("auto");
                        setPreview(null);
                      }}
                    />
                    <span>
                      <strong>Detect for each row (recommended).</strong> A street address is where they
                      live; a list of suburbs or postcodes is where they&rsquo;re looking. The heading
                      decides when it says, e.g. &ldquo;Looking in&rdquo; or &ldquo;Home address&rdquo;.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-[13px]">
                    <input
                      type="radio"
                      name="addressMeans"
                      checked={addressMeans === "lives"}
                      onChange={() => {
                        setAddressMeans("lives");
                        setPreview(null);
                      }}
                    />
                    <span>
                      <strong>All are where they live.</strong> Saved as their own address, and the suburb
                      is taken from it when the suburb column is empty.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-[13px]">
                    <input
                      type="radio"
                      name="addressMeans"
                      checked={addressMeans === "looking"}
                      onChange={() => {
                        setAddressMeans("looking");
                        setPreview(null);
                      }}
                    />
                    <span>
                      <strong>All are where they want to buy or rent.</strong> Suburbs and postcodes go into what
                      they&rsquo;re looking for, so they show up in property matching.
                    </span>
                  </label>
                </fieldset>
              )}

              <div className="rounded-lg border p-3 space-y-2">
                <label className="flex items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={consentOn} onChange={(e) => setConsentOn(e.target.checked)} />
                  These contacts consented to marketing
                </label>
                {consentOn && (
                  <>
                    <div className="flex gap-4 text-[13px]">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={cEmail} onChange={(e) => setCEmail(e.target.checked)} /> Email
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" checked={cSms} onChange={(e) => setCSms(e.target.checked)} /> SMS
                      </label>
                    </div>
                    <Textarea
                      label="The consent wording they agreed to (kept as the evidence for every send)"
                      name="wording"
                      rows={2}
                      value={wording}
                      onChange={(e) => setWording(e.target.value)}
                      errors={fe.consent}
                      placeholder="e.g. I agree to receive property news and listings from Ozi Realty by email and SMS. I can unsubscribe at any time."
                    />
                  </>
                )}
              </div>

              {preview && counts && (
                <>
                  <div className="flex flex-wrap gap-2 text-[12.5px]">
                    <span className="px-2.5 py-1 rounded-md bg-[#E8F6EE] text-[#1B6B3F]"><strong>{counts.new ?? 0}</strong> new</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#EEF3FF] text-[#0034C8]"><strong>{counts.update ?? 0}</strong> already in CRM</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#FFF4E5] text-[#8A4B00]"><strong>{counts.duplicate ?? 0}</strong> to merge review</span>
                    <span className="px-2.5 py-1 rounded-md bg-[#FDECEA] text-[#A12A12]"><strong>{counts.skip ?? 0}</strong> skipped</span>
                  </div>
                  <div className="max-h-[340px] overflow-auto rounded-lg border">
                    <table className="w-full text-[12.5px]">
                      <thead className="surface-2 sticky top-0 z-10 shadow-[0_1px_0_var(--border,#e5e7eb)]">
                        <tr className="text-left text-2">
                          <th className="p-2 w-8"></th>
                          <th className="p-2">Name</th>
                          <th className="p-2">Email</th>
                          <th className="p-2">Mobile</th>
                          <th className="p-2">Second number</th>
                          <th className="p-2">Tags</th>
                          <th className="p-2">Added</th>
                          <th className="p-2">Suburb</th>
                          <th className="p-2">Address</th>
                          <th className="p-2">What happens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => {
                          const p = preview[i];
                          return (
                            <tr key={i} className="border-t">
                              <td className="p-2">
                                <input
                                  type="checkbox"
                                  aria-label={`Import row ${i + 1}`}
                                  disabled={p.status === "skip"}
                                  checked={keep.has(i)}
                                  onChange={() =>
                                    setKeep((k) => {
                                      const n = new Set(k);
                                      if (n.has(i)) n.delete(i);
                                      else n.add(i);
                                      return n;
                                    })
                                  }
                                />
                              </td>
                              <td className="p-2 font-medium">{`${r.firstName} ${r.lastName}`.trim() || "—"}</td>
                              <td className="p-2">{r.email || "—"}</td>
                              <td className="p-2">{r.phone || "—"}</td>
                              <td className="p-2">{r.phone2 || "—"}</td>
                              <td className="p-2">{r.tags.join(", ") || "—"}</td>
                              <td className="p-2 whitespace-nowrap">
                                {r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-AU") : "—"}
                              </td>
                              <td className="p-2">{r.suburb || "—"}</td>
                              <td className="p-2">
                                {r.address ? (
                                  <>
                                    <span className="text-2 text-[11.5px] font-medium">
                                      {r.addressKind === "lives" ? "Lives at" : "Looking in"}:
                                    </span>{" "}
                                    {r.address}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className={`p-2 font-medium ${STATUS_STYLE[p.status]}`}>{p.detail}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <FormError message={error} />
              <div className="flex justify-end gap-2">
                <CancelButton onClick={onClose} />
                {preview ? (
                  <SubmitButton pending={save.pending} disabled={!keep.size} onClick={() => save.run(payload(true))} type="button">
                    Import {keep.size} contact{keep.size === 1 ? "" : "s"}
                  </SubmitButton>
                ) : (
                  <SubmitButton pending={check.pending} onClick={() => check.run(payload(false))} type="button">
                    Check the file
                  </SubmitButton>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
