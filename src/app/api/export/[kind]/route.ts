import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getAuditLog,
  getContacts,
  getListings,
  getProperties,
  getTasks,
} from "@/server/queries";

/**
 * CSV export.
 *
 * The Export buttons on /audit and /reports were inert. This is the smallest thing
 * that makes them real, and it is a Route Handler rather than a Server Action
 * because the browser has to receive a file — an action returns a value to React,
 * which is not a download.
 *
 * Everything here reads through the same tenant-scoped query layer the screens use,
 * so an export can never see rows a screen could not. That matters more here than
 * anywhere else in the app: an export leaves the building.
 */

export const dynamic = "force-dynamic";

/**
 * RFC 4180 quoting.
 *
 * The leading-character check is not pedantry. A cell beginning `=`, `+`, `-` or `@`
 * is executed as a formula when the file is opened in Excel or Sheets, and this
 * export carries free text a stranger typed into a web form. Prefixing a single
 * quote is the standard defence; without it, "CSV injection" is a live path from an
 * enquiry form to code running on the agent's machine.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "boolean"
        ? value
          ? "yes"
          : "no"
        : Array.isArray(value)
          ? value.join("; ")
          : String(value);

  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Excel needs CRLF inside a quoted field, and a bare CR would split the row.
  s = s.replace(/\r\n?/g, "\n");
  return `"${s.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))];
  // A BOM, so Excel on Windows reads the file as UTF-8 rather than as the local
  // codepage — without it every apostrophe in a street name comes out mangled.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

type Export = { headers: string[]; rows: () => Promise<unknown[][]> };

const EXPORTS: Record<string, Export> = {
  audit: {
    headers: ["When", "Actor", "Kind", "Action", "Target"],
    rows: async () =>
      // Not the screen's 20-row window: an export of the last twenty rows is not an
      // audit trail, it is a screenshot.
      (await getAuditLog(10_000)).map((r) => [r.at, r.actor, r.kind, r.action, r.target]),
  },
  contacts: {
    headers: [
      "First name",
      "Last name",
      "Email",
      "Phone",
      "Suburb",
      "Roles",
      "Source",
      "Owner",
      "Do not contact",
      "Consent",
      "Intent",
      "Budget band",
      "Last follow-up",
      "Last outcome",
      "Follow-up due",
      "Created",
    ],
    rows: async () =>
      (await getContacts()).map((c) => [
        c.firstName,
        c.lastName,
        c.email,
        c.phone,
        c.suburb,
        c.roles,
        c.source,
        c.owner,
        c.doNotContact,
        // The current state per channel, which is what decides whether this row may
        // be contacted at all. Exporting names without it invites a send from a
        // spreadsheet that never sees the consent trail.
        c.consents.map((k) => `${k.channel}:${k.status}`),
        c.intentType,
        c.budgetBand,
        c.lastFollowupAt,
        c.lastFollowupOutcome,
        c.followupDueAt,
        c.createdAt,
      ]),
  },
  properties: {
    headers: [
      "Address",
      "Suburb",
      "State",
      "Postcode",
      "Type",
      "Status",
      "Beds",
      "Baths",
      "Parking",
      "Land sqm",
      "Owner",
    ],
    rows: async () =>
      (await getProperties()).map((p) => [
        p.address,
        p.suburb,
        p.state,
        p.postcode,
        p.type,
        p.status,
        p.beds,
        p.baths,
        p.parking,
        p.landSqm,
        p.ownerName,
      ]),
    // internalNotes and internalPriceExpectation are deliberately absent. Rule 8
    // keeps them off public pages; a spreadsheet that gets emailed to a vendor is
    // the same disclosure by a slower route.
  },
  listings: {
    headers: [
      "Address",
      "Type",
      "Status",
      "Price shown",
      "Result",
      "Slug",
      "Listed",
      "Published",
      "Views 7d",
      "Enquiries 7d",
      "Photos",
    ],
    rows: async () =>
      (await getListings()).map((l) => [
        l.address,
        l.type,
        l.status,
        l.priceDisplay,
        l.resultDisplay,
        l.slug,
        l.listedAt,
        l.publishedAt,
        l.views7d,
        l.enquiries7d,
        l.photos,
      ]),
  },
  tasks: {
    headers: ["Title", "Contact", "Due", "Done", "Source"],
    rows: async () =>
      (await getTasks()).map((t) => [
        t.title,
        t.contactName,
        t.dueAt,
        t.done,
        t.source,
      ]),
  },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { kind } = await params;
  const spec = EXPORTS[kind];
  if (!spec) {
    return NextResponse.json(
      { error: `No export called "${kind}".`, available: Object.keys(EXPORTS) },
      { status: 404 },
    );
  }

  const csv = toCsv(spec.headers, await spec.rows());
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ozirealty-${kind}-${stamp}.csv"`,
      // It contains contact details. Nothing caches this.
      "Cache-Control": "no-store, private",
    },
  });
}
