"use client";

import * as React from "react";
import { Upload, FileText } from "lucide-react";
import { useAction, Modal, CancelButton, FormError, FormSuccess } from "./action-form";
import { Badge, Table, THead, TH, TD, TR } from "@/components/ui";
import { previewPropertyImport, commitPropertyImport } from "@/server/actions/property-import";
import type { ResolvedRow, PersonMatch } from "@/server/import/properties";

/**
 * Import properties from a JSON, Markdown or PDF file.
 *
 * Two presses, on purpose. The first reads the file and shows what WOULD happen —
 * nothing is saved. The second imports only the ticked rows. For Markdown and PDF the
 * reading is done by Claude, and §3.5 means a model's reading is shown to a person
 * before it becomes a record.
 */

const MAX_BYTES = 5 * 1024 * 1024;

function kindOf(name: string): "json" | "md" | "pdf" | null {
  const ext = name.toLowerCase().split(".").pop();
  if (ext === "json") return "json";
  if (ext === "md" || ext === "markdown" || ext === "txt") return "md";
  if (ext === "pdf") return "pdf";
  return null;
}

function readFile(file: File, kind: "json" | "md" | "pdf"): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error("The file could not be read."));
    if (kind === "pdf") {
      // data:application/pdf;base64,XXXX -> XXXX
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.readAsDataURL(file);
    } else {
      r.onload = () => resolve(String(r.result));
      r.readAsText(file);
    }
  });
}

function PersonCell({ p, role }: { p: PersonMatch; role: string }) {
  return (
    <div className="leading-tight">
      <span>{p.name}</span>{" "}
      {p.match === "existing" ? (
        <Badge tone="sent">
          existing{p.existingName && p.existingName !== p.name ? `: ${p.existingName}` : ""}
        </Badge>
      ) : p.match === "review" ? (
        <Badge tone="queue">new + merge review</Badge>
      ) : (
        <Badge tone="neutral">new {role}</Badge>
      )}
      {p.phone && <div className="text-3 text-[11px] tabular">{p.phone}</div>}
    </div>
  );
}

export function ImportPropertiesButton() {
  const [open, setOpen] = React.useState(false);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [readError, setReadError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<ResolvedRow[] | null>(null);
  const [ticked, setTicked] = React.useState<Set<number>>(new Set());

  const preview = useAction(previewPropertyImport, { refreshOnSuccess: false });
  const commit = useAction(commitPropertyImport);

  function reset() {
    setFileName(null);
    setReadError(null);
    setRows(null);
    setTicked(new Set());
    preview.reset();
    commit.reset();
  }

  async function onFile(file: File | undefined) {
    setReadError(null);
    setRows(null);
    commit.reset();
    if (!file) return;
    const kind = kindOf(file.name);
    if (!kind) {
      setReadError("Upload a .json, .md or .pdf file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setReadError("That file is larger than 5 MB.");
      return;
    }
    setFileName(file.name);
    let content: string;
    try {
      content = await readFile(file, kind);
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "The file could not be read.");
      return;
    }
    const result = await preview.run({ fileName: file.name, kind, content });
    if (result.ok) {
      setRows(result.data.rows);
      setTicked(
        new Set(result.data.rows.map((r, i) => (r.problem ? -1 : i)).filter((i) => i >= 0)),
      );
    }
  }

  const commitState = commit.state;
  const done = commitState && commitState.ok ? commitState.data : null;
  const readyCount = rows?.filter((r) => !r.problem).length ?? 0;

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
      >
        <Upload size={13} />
        Import
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Import properties" wide>
        {done ? (
          <div className="space-y-3">
            <FormSuccess
              message={`Imported ${done.imported.length} ${done.imported.length === 1 ? "property" : "properties"}. ${done.newContacts} new ${done.newContacts === 1 ? "contact" : "contacts"}, ${done.linkedContacts} linked to existing ${done.linkedContacts === 1 ? "contact" : "contacts"}.`}
            />
            {done.reviews > 0 && (
              <p className="text-[12.5px] text-2">
                {done.reviews} {done.reviews === 1 ? "person matches" : "people match"} more than
                one existing contact. They were added as new records with a merge review
                raised; nothing was merged automatically.
              </p>
            )}
            {done.skipped.length > 0 && (
              <div className="text-[12.5px]">
                <div className="font-medium mb-1">Skipped</div>
                <ul className="list-disc pl-5 text-2 space-y-0.5">
                  {done.skipped.map((s) => (
                    <li key={s.address}>
                      {s.address}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex items-center rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90"
              >
                Done
              </button>
              <CancelButton onClick={reset}>Import another file</CancelButton>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-lg border border-dashed p-4 cursor-pointer hover:surface-3">
              <FileText size={18} className="text-3 shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] font-medium truncate">
                  {fileName ?? "Choose a JSON, Markdown or PDF file"}
                </div>
                <div className="text-3 text-[11.5px]">
                  {preview.pending
                    ? "Reading the file…"
                    : "Up to 5 MB. Nothing is saved until you press Import."}
                </div>
              </div>
              <input
                type="file"
                accept=".json,.md,.markdown,.txt,.pdf,application/json,text/markdown,application/pdf"
                className="sr-only"
                disabled={preview.pending || commit.pending}
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-3 text-[11px] -mt-1">
              Markdown and PDF files are read by Claude, which costs a few cents and is
              logged on the Costs page. JSON is imported as written. Rent, arrears, lease
              and trust figures are ignored: rentals are advertised here, not managed.
            </p>

            <FormError message={readError ?? preview.error} />

            {rows && (
              <>
                <Table minWidth={860}>
                  <THead>
                    <TR>
                      <TH className="w-8">{""}</TH>
                      <TH>Address</TH>
                      <TH>Type</TH>
                      <TH>Owner</TH>
                      <TH>Tenants</TH>
                      <TH>Result</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {rows.map((r, i) => (
                      <TR key={i} className={r.problem ? "opacity-60" : undefined}>
                        <TD>
                          <input
                            type="checkbox"
                            aria-label={`Import ${r.address}`}
                            className="size-4"
                            disabled={!!r.problem}
                            checked={ticked.has(i)}
                            onChange={(e) =>
                              setTicked((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(i);
                                else next.delete(i);
                                return next;
                              })
                            }
                          />
                        </TD>
                        <TD>
                          <div className="font-medium">{r.address}</div>
                          <div className="text-3 text-[11.5px]">
                            {r.suburbLabel}{" "}
                            {r.newSuburb && <Badge tone="queue">new suburb</Badge>}
                          </div>
                        </TD>
                        <TD className="text-2 whitespace-nowrap">
                          <div className="capitalize">{r.row.propertyType}</div>
                          <div className="text-3 text-[11.5px] tabular">
                            {r.row.beds ?? "—"} bed · {r.row.baths ?? "—"} bath · {r.row.parking ?? "—"} car
                          </div>
                        </TD>
                        <TD>
                          {r.owner ? <PersonCell p={r.owner} role="landlord" /> : <span className="text-3">—</span>}
                        </TD>
                        <TD>
                          <div className="space-y-1">
                            {r.tenants.length === 0 && <span className="text-3">—</span>}
                            {r.tenants.map((t, j) => (
                              <PersonCell key={j} p={t} role="tenant" />
                            ))}
                          </div>
                        </TD>
                        <TD className="text-[12px]">
                          {r.problem ? (
                            <span className="text-[#b02f2f] dark:text-[#f08a8a]">{r.problem}</span>
                          ) : (
                            <Badge tone="stock">ready</Badge>
                          )}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
                <p className="text-3 text-[11px]">
                  {readyCount} of {rows.length} ready. Imported properties are set to
                  Off market. Owners get the landlord role and tenants the tenant role; people
                  are matched to existing contacts by phone or email only, never by name.
                </p>

                <FormError message={commit.error} />
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={ticked.size === 0 || commit.pending}
                    onClick={() =>
                      commit.run({
                        fileName: fileName ?? "upload",
                        rows: rows.filter((_, i) => ticked.has(i)).map((r) => r.row),
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 hover:opacity-90 disabled:opacity-50"
                  >
                    {commit.pending
                      ? "Importing…"
                      : `Import ${ticked.size} ${ticked.size === 1 ? "property" : "properties"}`}
                  </button>
                  <CancelButton onClick={() => setOpen(false)} />
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
