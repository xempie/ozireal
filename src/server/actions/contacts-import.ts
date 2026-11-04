"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, inArray, isNull, or } from "drizzle-orm";
import { contacts, contactRoles, consents, interactions, mergeReviews } from "@/db/schema";
import { defineAction, toE164, normaliseEmail } from "./action";

/**
 * Contact import from a file (owner's request, 2026-11-04).
 *
 * The browser reads the file (CSV, Excel, vCard) and maps the columns; this action gets
 * plain rows. Two presses, like the property import: `commit: false` classifies every
 * row and saves nothing, `commit: true` saves the rows the person kept ticked.
 *
 * A row matching an existing contact by email or phone fills in only what that contact
 * is missing; nothing on an existing record is overwritten. A row whose email and phone
 * point at two DIFFERENT contacts raises a merge review rather than guessing (§4).
 *
 * Consent: the owner states the imported contacts consented to marketing (2026-11-04) and
 * owns that judgement. When the import says so, one consent row per channel per contact
 * records the source and wording the owner entered, so every send can still be traced
 * to its provenance (§10). The send-time gate is unchanged.
 */

const row = z.object({
  firstName: z.string().trim().max(200).default(""),
  lastName: z.string().trim().max(200).default(""),
  email: z.string().trim().max(320).default(""),
  phone: z.string().trim().max(40).default(""),
  /** A second number (the landline beside a mobile). Stored for calling only. */
  phone2: z.string().trim().max(40).default(""),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  suburb: z.string().trim().max(120).default(""),
  note: z.string().trim().max(2000).default(""),
});

const ROLES = [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
  "business_vendor",
  "agent",
] as const;

export type ImportStatus = "new" | "update" | "duplicate" | "skip";
export type ImportPreviewRow = { status: ImportStatus; detail: string };

export const importContacts = defineAction({
  input: z.object({
    rows: z.array(row).min(1, "The file has no rows").max(2000, "Import at most 2,000 rows at a time"),
    /** Indexes into `rows` to save; ignored on the preview press. */
    keep: z.array(z.number().int().min(0)).default([]),
    commit: z.boolean(),
    role: z.enum(ROLES).nullable(),
    source: z.string().trim().min(2, "Say where this list came from").max(120),
    consent: z
      .object({
        email: z.boolean(),
        sms: z.boolean(),
        wording: z.string().trim().min(10, "Enter the consent wording people agreed to").max(2000),
      })
      .nullable(),
  }),
  async handler(input, ctx) {
    const rows = input.rows.map((r) => ({
      ...r,
      emailN: normaliseEmail(r.email || null),
      phoneE: toE164(r.phone || null),
    }));

    const emails = [...new Set(rows.map((r) => r.emailN).filter((x): x is string => !!x))];
    const phones = [...new Set(rows.map((r) => r.phoneE).filter((x): x is string => !!x))];
    const existing =
      emails.length || phones.length
        ? await ctx.tx
            .select({
              id: contacts.id,
              email: contacts.emailNormalised,
              phone: contacts.phoneE164,
              suburb: contacts.suburb,
              phone2: contacts.secondaryPhone,
              tags: contacts.tags,
              firstName: contacts.firstName,
              lastName: contacts.lastName,
            })
            .from(contacts)
            .where(
              and(
                isNull(contacts.tombstonedAt),
                isNull(contacts.mergedIntoId),
                or(
                  emails.length ? inArray(contacts.emailNormalised, emails) : undefined,
                  phones.length ? inArray(contacts.phoneE164, phones) : undefined,
                ),
              ),
            )
        : [];
    const byEmail = new Map(existing.filter((c) => c.email).map((c) => [c.email!, c]));
    const byPhone = new Map(existing.filter((c) => c.phone).map((c) => [c.phone!, c]));

    // Within the file too: the second row for the same person updates the first.
    const seen = new Set<string>();
    const preview: ImportPreviewRow[] = rows.map((r) => {
      if (!r.emailN && !r.phoneE) return { status: "skip", detail: "No email or phone" };
      if (!r.firstName && !r.lastName && !r.emailN) return { status: "skip", detail: "No name or email" };
      const key = r.emailN ?? r.phoneE!;
      if (seen.has(key)) return { status: "skip", detail: "Repeated in this file" };
      seen.add(key);
      const e = r.emailN ? byEmail.get(r.emailN) : undefined;
      const p = r.phoneE ? byPhone.get(r.phoneE) : undefined;
      if (e && p && e.id !== p.id) {
        return { status: "duplicate", detail: `Matches ${e.firstName} ${e.lastName} and ${p.firstName} ${p.lastName}, to merge review` };
      }
      const hit = e ?? p;
      if (hit) {
        const adds = [
          !hit.phone && r.phoneE ? "phone" : null,
          !hit.email && r.emailN ? "email" : null,
          !hit.suburb && r.suburb ? "suburb" : null,
          !hit.phone2 && r.phone2 ? "second number" : null,
          r.tags.some((t) => !hit.tags.includes(t)) ? "tags" : null,
        ].filter(Boolean);
        return {
          status: "update",
          detail: `Already in CRM (${hit.firstName} ${hit.lastName})${adds.length ? `, adds ${adds.join(", ")}` : ""}`,
        };
      }
      return { status: "new", detail: "New contact" };
    });

    if (!input.commit) return { preview, saved: null };

    const keep = new Set(input.keep);
    const now = new Date();
    const counts = { created: 0, updated: 0, merges: 0 };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const st = preview[i].status;
      if (!keep.has(i) || st === "skip") continue;

      let contactId: string;
      if (st === "new") {
        const [c] = await ctx.tx
          .insert(contacts)
          .values({
            tenantId: ctx.tenantId,
            firstName: r.firstName || (r.email.split("@")[0] ?? ""),
            lastName: r.lastName,
            emailRaw: r.email || null,
            emailNormalised: r.emailN,
            phoneRaw: r.phone || null,
            phoneE164: r.phoneE,
            suburb: r.suburb || null,
            secondaryPhone: r.phone2 || null,
            tags: r.tags,
            sourceChannel: "manual",
            ownerUserId: ctx.userId,
          })
          .returning({ id: contacts.id });
        contactId = c.id;
        counts.created++;
      } else {
        const e = r.emailN ? byEmail.get(r.emailN) : undefined;
        const p = r.phoneE ? byPhone.get(r.phoneE) : undefined;
        const hit = (e ?? p)!;
        contactId = hit.id;
        if (st === "duplicate" && e && p) {
          await ctx.tx.insert(mergeReviews).values({
            tenantId: ctx.tenantId,
            contactAId: e.id,
            contactBId: p.id,
            similarity: 0.9,
            matchedOn: `Imported row from "${input.source}" has one's email and the other's phone.`,
          });
          counts.merges++;
        } else {
          const fill: Partial<typeof contacts.$inferInsert> = {};
          if (!hit.phone && r.phoneE) Object.assign(fill, { phoneRaw: r.phone, phoneE164: r.phoneE });
          if (!hit.email && r.emailN) Object.assign(fill, { emailRaw: r.email, emailNormalised: r.emailN });
          if (!hit.suburb && r.suburb) fill.suburb = r.suburb;
          if (!hit.phone2 && r.phone2) fill.secondaryPhone = r.phone2;
          // Tags add up; an import never removes one.
          const tags = [...new Set([...hit.tags, ...r.tags])];
          if (tags.length !== hit.tags.length) fill.tags = tags;
          if (Object.keys(fill).length) {
            await ctx.tx.update(contacts).set({ ...fill, updatedAt: now }).where(inArray(contacts.id, [hit.id]));
          }
          counts.updated++;
        }
      }

      if (input.role) {
        await ctx.tx
          .insert(contactRoles)
          .values({ tenantId: ctx.tenantId, contactId, role: input.role })
          .onConflictDoNothing();
      }

      // The import itself is a touch on the record, with the file's note if it had one.
      await ctx.tx.insert(interactions).values({
        tenantId: ctx.tenantId,
        contactId,
        channel: "manual",
        direction: "in",
        occurredAt: now,
        subject: `Imported from ${input.source}`,
        body: r.note || null,
        createdByUserId: ctx.userId,
      });

      if (input.consent) {
        const channels = [
          input.consent.email && r.emailN ? ("email" as const) : null,
          input.consent.sms && r.phoneE ? ("sms" as const) : null,
        ].filter((c): c is "email" | "sms" => c !== null);
        for (const channel of channels) {
          await ctx.tx.insert(consents).values({
            tenantId: ctx.tenantId,
            contactId,
            channel,
            status: "granted",
            sourceForm: `Import: ${input.source}`,
            wordingShown: input.consent.wording,
            occurredAt: now,
          });
        }
      }
    }

    await ctx.audit({
      kind: "edit",
      action: `Imported contacts from ${input.source}: ${counts.created} new, ${counts.updated} updated, ${counts.merges} to merge review${input.consent ? ", consent recorded" : ""}`,
      target: input.source,
    });
    revalidatePath("/contacts");
    revalidatePath("/dashboard");
    revalidatePath("/confirm");
    return { preview, saved: counts };
  },
});
