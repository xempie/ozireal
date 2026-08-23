import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";

/**
 * The guarantees CLAUDE.md calls non-negotiable, tested where they actually live.
 *
 * These assert on DATABASE behaviour, not application behaviour, so they keep holding
 * after a refactor forgets the rule. Every "rejects" case is something the schema must
 * make impossible - if one of these starts passing a write, a product rule has quietly
 * stopped being true.
 */

let sql: postgres.Sql;
let tenantId: string;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const [t] = await sql<{ id: string }[]>`select id from tenants limit 1`;
  tenantId = t.id;
});

afterAll(async () => {
  await sql?.end();
});

/** Asserts the database refuses the statement, and returns the message it refused with. */
async function rejects(statement: string) {
  try {
    await sql.unsafe(statement);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

describe("the interaction log is append-only (CLAUDE.md 4)", () => {
  it("refuses to edit the body of a recorded interaction", async () => {
    const msg = await rejects(
      `update interactions set body = 'tampered'
       where id = (select id from interactions limit 1)`,
    );
    expect(msg).toMatch(/append-only/i);
  });

  it("refuses to delete an interaction", async () => {
    const msg = await rejects(
      `delete from interactions where id = (select id from interactions limit 1)`,
    );
    expect(msg).toMatch(/append-only/i);
  });

  it("allows a privacy tombstone, which is the one permitted mutation", async () => {
    const msg = await rejects(
      `update interactions set tombstoned_at = now()
       where id = (select id from interactions where tombstoned_at is null limit 1)`,
    );
    expect(msg).toBeNull();
  });

  it("refuses to REVERSE a tombstone once set", async () => {
    await sql.unsafe(
      `update interactions set tombstoned_at = now()
       where id = (select id from interactions where tombstoned_at is null limit 1)`,
    );
    const msg = await rejects(
      `update interactions set tombstoned_at = null where tombstoned_at is not null`,
    );
    expect(msg).toMatch(/cannot be reversed/i);
  });

  it("refuses to edit a consent row, because a revocation is a new row", async () => {
    const msg = await rejects(
      `update consents set status = 'granted' where id = (select id from consents limit 1)`,
    );
    expect(msg).toMatch(/append-only/i);
  });
});

describe("nothing leaves without an audit trail (rules 1 and 2)", () => {
  it("refuses a blocked send with no stated reason", async () => {
    const msg = await rejects(
      `insert into approval_items (tenant_id, kind, status, draft_body)
       values ('${tenantId}', 'email', 'blocked', 'x')`,
    );
    expect(msg).toMatch(/approval_blocked_has_reason/);
  });

  it("refuses a sent item with no timestamp", async () => {
    const msg = await rejects(
      `insert into approval_items (tenant_id, kind, status, draft_body)
       values ('${tenantId}', 'email', 'sent', 'x')`,
    );
    expect(msg).toMatch(/approval_sent_has_timestamp/);
  });

  it("refuses a rejection with no reason", async () => {
    const msg = await rejects(
      `insert into approval_items (tenant_id, kind, status, draft_body)
       values ('${tenantId}', 'email', 'rejected', 'x')`,
    );
    expect(msg).toMatch(/approval_rejected_has_reason/);
  });

  it("refuses to delete the record of something already sent", async () => {
    const msg = await rejects(`delete from approval_items where status = 'sent'`);
    expect(msg).toMatch(/evidence and cannot be deleted/i);
  });

  it("refuses to delete the record of something blocked at the consent gate", async () => {
    const msg = await rejects(`delete from approval_items where status = 'blocked'`);
    expect(msg).toMatch(/evidence and cannot be deleted/i);
  });
});

describe("listings and matching (16, 6)", () => {
  it("refuses a live listing with no price wording a human authored", async () => {
    const msg = await rejects(
      `update listings set price_display = null where status = 'live'`,
    );
    expect(msg).toMatch(/listings_live_needs_price_display/);
  });

  it("refuses a match with a blank reason", async () => {
    const msg = await rejects(
      `insert into matches (tenant_id, listing_id, contact_id, score, reason, stage)
       select '${tenantId}', l.id, c.id, 0.5, '   ', 'ranked'
       from listings l, contacts c limit 1`,
    );
    expect(msg).toMatch(/matches_reason_not_blank/);
  });

  it("refuses two live campaigns over one property", async () => {
    const msg = await rejects(
      `insert into listings (tenant_id, property_id, listing_type, status, price_display, slug)
       select tenant_id, property_id, 'sale', 'live', 'X', 'dupe-slug'
       from listings where status = 'live' limit 1`,
    );
    expect(msg).toMatch(/one_live_per_property/);
  });
});

describe("identity resolution can do its job (4)", () => {
  it("lets two contacts share a phone number, so merge review can hold them", async () => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from (
        select phone_e164 from contacts
        where phone_e164 is not null
        group by tenant_id, phone_e164 having count(*) > 1
      ) dupes`;
    // The seed carries exactly this case. A unique constraint here would mean the
    // duplicate could never be written and the merge queue could never populate.
    expect(row.n).toBeGreaterThan(0);
  });

  it("refuses a merge review that compares a contact with itself", async () => {
    const msg = await rejects(
      `insert into merge_reviews (tenant_id, contact_a_id, contact_b_id, similarity, matched_on)
       select '${tenantId}', c.id, c.id, 0.9, 'x' from contacts c limit 1`,
    );
    expect(msg).toMatch(/merge_reviews_distinct/);
  });
});

describe("the evidence log cannot point at things that never existed", () => {
  it("refuses an interaction referencing an unknown listing", async () => {
    const msg = await rejects(
      `insert into interactions (tenant_id, contact_id, channel, direction, occurred_at, listing_id)
       select '${tenantId}', c.id, 'email', 'in', now(), gen_random_uuid()
       from contacts c limit 1`,
    );
    expect(msg).toMatch(/interactions_listing_id_fk/);
  });

  it("refuses a proposal referencing an unknown property", async () => {
    const msg = await rejects(
      `insert into proposals (tenant_id, contact_id, property_id)
       select '${tenantId}', c.id, gen_random_uuid() from contacts c limit 1`,
    );
    expect(msg).toMatch(/property_id/);
  });
});

describe("a merge points somewhere real, exactly one hop away", () => {
  it("refuses a record merged into itself", async () => {
    const msg = await rejects(
      `update contacts set merged_into_id = id, tombstoned_at = now()
       where id = (select id from contacts where merged_into_id is null limit 1)`,
    );
    expect(msg).toMatch(/contacts_merge_is_consistent/);
  });

  it("refuses a merged record that is still live in the list", async () => {
    // Without the tombstone the loser keeps appearing everywhere while its history
    // has moved, which is worse than not merging at all.
    const msg = await rejects(
      `update contacts a set merged_into_id =
         (select b.id from contacts b where b.id <> a.id and b.merged_into_id is null limit 1)
       where a.id = (select id from contacts where merged_into_id is null
                     and tombstoned_at is null limit 1)`,
    );
    expect(msg).toMatch(/contacts_merge_is_consistent/);
  });
});
