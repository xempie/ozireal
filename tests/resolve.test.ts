import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { withTenant, systemTenantId } from "@/db";
import { resolveContact } from "@/server/intake/resolve";
import type { InboundIdentity } from "@/server/intake/types";

/**
 * resolveContact, table-driven (B3.3). The table IS the deliverable as much as the
 * code: each row is a person the resolver could wrongly split or wrongly merge.
 *
 * Sourced from a generated 37-case table plus its adversarial review
 * (docs/research/b3-identity-cases.json). One deliberate divergence: the table
 * argued a tombstoned record should match so downstream can refuse; the review and
 * the product rules say otherwise — a privacy deletion ends the relationship, so a
 * returning enquirer starts a FRESH record (the enquiry must land; the forgotten
 * history must stay forgotten). The tests below pin the review's version.
 */

let sql: postgres.Sql;
let tenantId: string;
let seq = 0;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
});

afterAll(async () => {
  await sql?.end();
});

/** Unique-per-test identity fragments so cases cannot contaminate each other. */
function fresh() {
  seq += 1;
  const n = String(30_000_000 + seq * 111).slice(0, 8);
  return {
    mobile: `04${n}`,
    mobileE164: `+614${n}`,
    landline: `08${n}`,
    landlineE164: `+618${n}`,
    email: `case${seq}.${Date.now() % 100000}@example.com`,
  };
}

type Spec = {
  firstName: string;
  lastName: string;
  email?: string | null;
  secondaryEmail?: string | null;
  phone?: string | null;
  tombstoned?: boolean;
  mergedInto?: string;
};

async function seedContact(s: Spec): Promise<string> {
  const { normaliseEmail, toE164 } = await import("@/lib/normalise");
  const [row] = await sql<{ id: string }[]>`
    insert into contacts
      (tenant_id, first_name, last_name, email_raw, email_normalised,
       secondary_email, phone_raw, phone_e164, source_channel,
       tombstoned_at, merged_into_id)
    values
      (${tenantId}, ${s.firstName}, ${s.lastName},
       ${s.email ?? null}, ${normaliseEmail(s.email) ?? null},
       ${s.secondaryEmail ? normaliseEmail(s.secondaryEmail) : null},
       ${s.phone ?? null}, ${toE164(s.phone) ?? null}, 'manual',
       ${s.tombstoned || s.mergedInto ? new Date() : null},
       ${s.mergedInto ?? null})
    returning id`;
  return row.id;
}

async function resolve(identity: Partial<Extract<InboundIdentity, { kind: "claimed" }>>) {
  return withTenant(tenantId, (tx) =>
    resolveContact(
      tx,
      tenantId,
      {
        kind: "claimed",
        email: null,
        phone: null,
        firstName: null,
        lastName: null,
        ...identity,
      },
      { channel: "web_form", summary: "test enquiry" },
    ),
  );
}

describe("no plausible match → new", () => {
  it("an empty book", async () => {
    const f = fresh();
    const r = await resolve({ firstName: "Priya", lastName: "Raman", email: f.email, phone: f.mobile });
    expect(r.outcome).toBe("new");
    expect(r.reviewIds).toHaveLength(0);
  });

  it("same name only NEVER matches — a name is demographic coincidence", async () => {
    const f = fresh();
    const existing = await seedContact({
      firstName: "Somebody", lastName: "Keen", email: f.email, phone: f.mobile,
    });
    const r = await resolve({ firstName: "Somebody", lastName: "Keen" });
    expect(r.outcome).toBe("new");
    expect(r.contactId).not.toBe(existing);
  });

  it("junk phone and junk email leave no keys at all", async () => {
    const r = await resolve({
      firstName: "Jane", lastName: "Doe", email: "not-an-email", phone: "call me",
    });
    expect(r.outcome).toBe("new");
  });

  it("a local number with no area code matches nothing rather than guessing", async () => {
    const f = fresh();
    await seedContact({ firstName: "Raj", lastName: "Patel", phone: f.landline });
    const r = await resolve({
      firstName: "Raj", lastName: "Patel", phone: f.landline.slice(2),
    });
    expect(r.outcome).toBe("new");
  });
});

describe("one candidate on a personal key → existing", () => {
  it("mobile typed in a different format", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Jane", lastName: "Citizen", phone: f.mobile });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", phone: `+61 (0) ${f.mobile.slice(1)}`,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("plus-addressed email collapses onto the record", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Jane", lastName: "Citizen", email: f.email });
    const [local, domain] = f.email.split("@");
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: `${local}+houses@${domain.toUpperCase()}`,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("email decides even when the phone key matches nothing", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Jane", lastName: "Citizen", email: f.email });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: fresh().mobile,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("a junk phone does not poison a clean email match", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Jane", lastName: "Citizen", email: f.email });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: "call me after 5",
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("a hit on the secondary email column is a hit — one person, several mailboxes", async () => {
    const f = fresh();
    const second = fresh().email;
    const id = await seedContact({
      firstName: "Jane", lastName: "Citizen", email: f.email, secondaryEmail: second,
    });
    const r = await resolve({ firstName: "Jane", lastName: "Citizen", email: second });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("mobile + same name with a NEW email is the same person with an update", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Jane", lastName: "Citizen", phone: f.mobile, email: f.email });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", phone: f.mobile, email: fresh().email,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("a nickname-ish first name corroborates rather than conflicts", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Samantha", lastName: "Whitfield", email: f.email });
    const r = await resolve({ firstName: "Sam", lastName: "Whitfield", email: f.email });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("both keys agreeing on one record is the strongest signal, not a conflict", async () => {
    const f = fresh();
    const id = await seedContact({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: f.mobile,
    });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: f.mobile,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("a foreign number in exact E.164 matches like any other key", async () => {
    const overseas = `+4479${String(10_000_000 + seq * 7).slice(0, 8)}`;
    const [row] = await sql<{ id: string }[]>`
      insert into contacts (tenant_id, first_name, last_name, phone_raw, phone_e164, source_channel)
      values (${tenantId}, 'Oliver', 'Hart', ${overseas}, ${overseas}, 'manual') returning id`;
    const r = await resolve({ firstName: "Oliver", lastName: "Hart", phone: overseas });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(row.id);
  });
});

describe("household keys and conflicting evidence → ambiguous, with a merge review", () => {
  it("a landline with a different name is the shared-household pattern", async () => {
    const f = fresh();
    const raj = await seedContact({
      firstName: "Raj", lastName: "Patel", phone: f.landline, email: f.email,
    });
    const r = await resolve({
      firstName: "Meera", lastName: "Sharma", phone: f.landline, email: fresh().email,
    });
    expect(r.outcome).toBe("ambiguous");
    expect(r.contactId).not.toBe(raj);
    expect(r.reviewIds).toHaveLength(1);

    // The enquiry still landed — on its own record — and the review names the pair.
    const [review] = await sql<{ contact_a_id: string; contact_b_id: string; status: string }[]>`
      select contact_a_id, contact_b_id, status from merge_reviews where id = ${r.reviewIds[0]}`;
    expect(review.contact_a_id).toBe(raj);
    expect(review.contact_b_id).toBe(r.contactId);
    expect(review.status).toBe("open");
  });

  it("a landline needs the name to positively agree — partial is not enough", async () => {
    const f = fresh();
    await seedContact({ firstName: "Raj", lastName: "Patel", phone: f.landline });
    // Same surname, different first name: plausibly a spouse. Human decides.
    const r = await resolve({ firstName: "Meera", lastName: "Patel", phone: f.landline });
    expect(r.outcome).toBe("ambiguous");
  });

  it("a landline with an AGREEING name is safe", async () => {
    const f = fresh();
    const id = await seedContact({ firstName: "Raj", lastName: "Patel", phone: f.landline });
    const r = await resolve({ firstName: "Raj", lastName: "Patel", phone: f.landline });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(id);
  });

  it("an email hit with a flatly conflicting name is the family-mailbox pattern", async () => {
    const f = fresh();
    await seedContact({ firstName: "Annette", lastName: "D'Souza", email: f.email });
    const r = await resolve({ firstName: "Bruce", lastName: "Chen", email: f.email });
    expect(r.outcome).toBe("ambiguous");
    expect(r.reviewIds).toHaveLength(1);
  });

  it("a recycled mobile: conflicting name on a mobile goes to review", async () => {
    const f = fresh();
    await seedContact({ firstName: "Harpreet", lastName: "Gill", phone: f.mobile });
    const r = await resolve({ firstName: "Tom", lastName: "Okafor", phone: f.mobile });
    expect(r.outcome).toBe("ambiguous");
  });

  it("email hits A while phone hits B — two people, one enquiry, a person decides", async () => {
    const f1 = fresh();
    const f2 = fresh();
    const a = await seedContact({ firstName: "Aisha", lastName: "Rahman", email: f1.email });
    const b = await seedContact({ firstName: "Ben", lastName: "Torres", phone: f2.mobile });
    const r = await resolve({
      firstName: "Aisha", lastName: "Rahman", email: f1.email, phone: f2.mobile,
    });
    expect(r.outcome).toBe("ambiguous");
    expect(r.contactId).not.toBe(a);
    expect(r.contactId).not.toBe(b);
    // One review per candidate: the human sees both possible identities.
    expect(r.reviewIds).toHaveLength(2);
  });

  it("two records already share the email — the phone must NOT tie-break between them", async () => {
    const f = fresh();
    const a = await seedContact({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: f.mobile,
    });
    const b = await seedContact({ firstName: "Jane", lastName: "Citizen", email: f.email });
    // Phone matches only A. Using it to pick A would be an auto-merge in disguise.
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: f.mobile,
    });
    expect(r.outcome).toBe("ambiguous");
    expect(r.contactId).not.toBe(a);
    expect(r.contactId).not.toBe(b);
  });

  it("one landline shared by two known contacts", async () => {
    const f = fresh();
    await seedContact({ firstName: "Raj", lastName: "Patel", phone: f.landline });
    await seedContact({ firstName: "Meera", lastName: "Patel", phone: f.landline });
    const r = await resolve({ firstName: "R", lastName: "Patel", phone: f.landline });
    expect(r.outcome).toBe("ambiguous");
  });
});

describe("tombstones and merges", () => {
  it("a privacy-tombstoned record is invisible: the returning enquirer starts fresh", async () => {
    const f = fresh();
    const gone = await seedContact({
      firstName: "Erased", lastName: "Person", email: f.email, tombstoned: true,
    });
    const r = await resolve({ firstName: "Erased", lastName: "Person", email: f.email });
    expect(r.outcome).toBe("new");
    expect(r.contactId).not.toBe(gone);
    // And no review either — a review row would surface the forgotten record.
    expect(r.reviewIds).toHaveLength(0);
  });

  it("a tombstone does not block the OPEN record that shares its key", async () => {
    const f = fresh();
    await seedContact({
      firstName: "Old", lastName: "Record", email: f.email, tombstoned: true,
    });
    const open = await seedContact({ firstName: "Jane", lastName: "Citizen", email: f.email });
    // The tombstone is invisible, so this is a clean single-candidate match.
    const r = await resolve({ firstName: "Jane", lastName: "Citizen", email: f.email });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(open);
  });

  it("a key on a merged-away record resolves to the survivor", async () => {
    const f = fresh();
    const survivor = await seedContact({ firstName: "Jane", lastName: "Citizen", email: fresh().email });
    await seedContact({
      firstName: "Jane", lastName: "Citizen", email: f.email, mergedInto: survivor,
    });
    const r = await resolve({ firstName: "Jane", lastName: "Citizen", email: f.email });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(survivor);
  });

  it("keys hitting the loser AND the survivor collapse to one candidate, not a conflict", async () => {
    const f = fresh();
    const survivor = await seedContact({
      firstName: "Jane", lastName: "Citizen", email: f.email,
    });
    await seedContact({
      firstName: "Jane", lastName: "Citizen", phone: f.mobile, mergedInto: survivor,
    });
    const r = await resolve({
      firstName: "Jane", lastName: "Citizen", email: f.email, phone: f.mobile,
    });
    expect(r.outcome).toBe("existing");
    expect(r.contactId).toBe(survivor);
  });
});

describe("what an ambiguous resolution writes", () => {
  it("the new record exists, carries the claimed identity, and starts as a buyer", async () => {
    const f = fresh();
    await seedContact({ firstName: "Annette", lastName: "D'Souza", email: f.email });
    const r = await resolve({
      firstName: "Bruce", lastName: "Chen", email: f.email, phone: f.mobile,
    });
    const [row] = await sql<
      { first_name: string; email_normalised: string; phone_e164: string; source_channel: string }[]
    >`select first_name, email_normalised, phone_e164, source_channel
       from contacts where id = ${r.contactId}`;
    expect(row.first_name).toBe("Bruce");
    expect(row.email_normalised).toBe(f.email.toLowerCase());
    expect(row.phone_e164).toBe(f.mobileE164);
    expect(row.source_channel).toBe("web_form");
  });

  it("an enquiry with no name at all still lands, honestly labelled", async () => {
    const f = fresh();
    const r = await resolve({ email: f.email });
    const [row] = await sql<{ first_name: string; last_name: string }[]>`
      select first_name, last_name from contacts where id = ${r.contactId}`;
    expect(row.first_name).toBe("Unknown");
    expect(row.last_name).toBe("Enquirer");
  });
});
