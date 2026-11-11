import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Badge, Table, THead, TH, TD, TR } from "@/components/ui";
import { listBuildingChecks } from "@/server/queries/building-checks";
import { CONTEXTS } from "@/lib/building-check";
import { shortDate } from "@/lib/utils";

/** Building checks (the owner's "building-check" skill, 2026-11-11): every report, newest first. */
export default async function BuildingChecksPage() {
  const checks = await listBuildingChecks();
  const ctx = (k: string) => CONTEXTS.find((c) => c.key === k)?.title ?? k;
  const aud = (n: number) => `$${n.toLocaleString("en-AU")}`;
  return (
    <>
      <PageHeader
        title="Building checks"
        subtitle="Photos in, a Red / Amber / Green condition read out. Photo-based only; not a building and pest inspection."
        actions={
          <Link
            href="/building-checks/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9"
          >
            <Plus size={13} /> New building check
          </Link>
        }
      />
      {checks.length === 0 ? (
        <div className="surface-2 border rounded-xl p-8 text-center space-y-2">
          <p className="text-[15px] font-semibold">No checks yet</p>
          <p className="text-2 text-[13px]">
            Walk a property with your phone, take photos room by room, and get the read on the spot.
          </p>
          <Link
            href="/building-checks/new"
            className="inline-flex rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3 min-h-9 items-center"
          >
            Start a check
          </Link>
        </div>
      ) : (
        <Table minWidth={760}>
          <THead>
            <TR>
              <TH>Property</TH>
              <TH>For</TH>
              <TH>Result</TH>
              <TH>Indicative cost</TH>
              <TH>Date</TH>
            </TR>
          </THead>
          <tbody>
            {checks.map((c) => (
              <TR key={c.id}>
                <TD nowrap>
                  <Link href={`/building-checks/${c.id}`} className="font-medium hover:underline underline-offset-2">
                    {c.title}
                  </Link>
                  <div className="text-3 text-[12px]">{c.photos.length} photos</div>
                </TD>
                <TD className="text-2">{ctx(c.context)}</TD>
                <TD>
                  {c.status === "done" ? (
                    <div className="flex gap-1">
                      <Badge tone="blocked">{c.red} red</Badge>
                      <Badge tone="queue">{c.amber} amber</Badge>
                      <Badge tone="sent">{c.green} green</Badge>
                    </div>
                  ) : c.status === "failed" ? (
                    <Badge tone="blocked">Failed</Badge>
                  ) : (
                    <Badge tone="neutral">Running…</Badge>
                  )}
                </TD>
                <TD className="tabular text-2">
                  {c.status === "done" && c.costHigh ? `${aud(c.costLow)} – ${aud(c.costHigh)}` : "—"}
                </TD>
                <TD className="text-2 whitespace-nowrap">{shortDate(c.createdAt)}</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
