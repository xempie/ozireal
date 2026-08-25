import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { systemTenantId } from "@/db";

/**
 * The AI layer (B4), tested at its real boundary: fetch is mocked — nothing else.
 * The ledger rows, the summary writes, the confirm items and the preference
 * commits all land in the real database, because "malformed output never reaches
 * a table" is a claim about the database.
 */

const enqueued: { name: string; entityId: string }[] = [];
vi.mock("@/server/jobs/queues", () => ({
  enqueue: async (name: string, payload: { entityId: string }) => {
    enqueued.push({ name, entityId: payload.entityId });
    return true;
  },
}));

const h = vi.hoisted(() => ({
  session: {
    user: { id: "", name: "Sam Whitfield", email: "sam@ozirealty.com.au", tenantId: "", role: "principal" },
  } as { user: Record<string, string> } | null,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { callClaude, ClaudeError } = await import("@/server/ai/claude");
const { runTask, extractJson, TaskOutputError } = await import("@/server/ai/run-task");
const { summariseInteraction, rebuildContactIntent } = await import("@/server/ai/handlers");
const { commitConfirmItem } = await import("@/server/actions/contacts");
const { z } = await import("zod");

let sql: postgres.Sql;
let tenantId: string;
let seq = 0;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = u.id;
});

afterAll(async () => {
  await sql?.end();
});

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  // The key now resolves from tenant_secrets first, environment second. Clear any
  // stored row so these tests exercise the fallback deterministically.
  await sql`delete from tenant_secrets where name = 'ANTHROPIC_API_KEY'`;
  enqueued.length = 0;
});

/** A Messages API response whose single content block is `text`. */
function claudeResponse(text: string, usage: Partial<Record<string, number>> = {}) {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text }],
      usage: {
        input_tokens: usage.input ?? 500,
        output_tokens: usage.output ?? 100,
        cache_read_input_tokens: usage.cacheRead ?? 0,
        cache_creation_input_tokens: usage.cacheWrite ?? 0,
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function mockFetch(handler: (body: string) => Response) {
  const spy = vi.fn(async (_url: unknown, init?: RequestInit) =>
    handler(String(init?.body ?? "")),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

async function seedContact(over: Record<string, string> = {}) {
  seq += 1;
  const [c] = await sql<{ id: string }[]>`
    insert into contacts (tenant_id, first_name, last_name, email_raw, email_normalised, source_channel)
    values (${tenantId}, ${over.firstName ?? "Ada"}, ${`Aicase${seq}`},
            ${`ai${seq}.${Date.now() % 100000}@example.com`}, ${`ai${seq}.${Date.now() % 100000}@example.com`}, 'web_form')
    returning id`;
  await sql`insert into contact_roles (tenant_id, contact_id, role)
            values (${tenantId}, ${c.id}, 'buyer') on conflict do nothing`;
  return c.id;
}

async function seedInteraction(contactId: string, body: string) {
  const [i] = await sql<{ id: string }[]>`
    insert into interactions (tenant_id, contact_id, channel, direction, occurred_at, subject, body, message_id)
    values (${tenantId}, ${contactId}, 'web_form', 'in', now(), 'Enquiry', ${body}, ${`ai-test:${randomUUID()}`})
    returning id`;
  return i.id;
}

/* ------------------------------------------------------------ extractJson */

describe("extractJson", () => {
  it("takes clean JSON as-is", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });
  it("strips markdown fences", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("skips a prose preamble", () => {
    expect(extractJson('Here is the JSON:\n{"a":{"b":2}}')).toEqual({ a: { b: 2 } });
  });
  it("keeps braces inside strings intact", () => {
    expect(extractJson('{"note":"use {curly} braces","n":1}')).toEqual({
      note: "use {curly} braces",
      n: 1,
    });
  });
  it("returns null when there is no object at all", () => {
    expect(extractJson("I could not produce JSON, sorry.")).toBeNull();
  });
  it("returns null for a truncated object rather than guessing", () => {
    expect(extractJson('{"a": 1, "b": ')).toBeNull();
  });
});

/* -------------------------------------------------------- callClaude ledger */

describe("callClaude writes the ledger", () => {
  it("records model, tokens, cache reads, cost and the entity on success", async () => {
    mockFetch(() => claudeResponse("hello", { input: 1000, output: 200, cacheRead: 3000 }));
    const entityId = randomUUID();
    const r = await callClaude({
      task: "test-ledger",
      model: "haiku",
      tenantId,
      entity: { type: "interaction", id: entityId },
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.text).toBe("hello");

    const [row] = await sql<
      { model: string; input_tokens: number; cached_input_tokens: number; cost_aud: string; succeeded: boolean }[]
    >`select model, input_tokens, cached_input_tokens, cost_aud, succeeded
       from ai_generations where id = ${r.generationId}`;
    expect(row.model).toMatch(/haiku/);
    expect(row.input_tokens).toBe(1000);
    expect(row.cached_input_tokens).toBe(3000);
    expect(row.succeeded).toBe(true);
    // 1000×$1 + 200×$5 + 3000×$0.1 per MTok = $0.0023 USD → AUD at the configured rate.
    expect(Number(row.cost_aud)).toBeCloseTo(0.0023 * 1.55, 4);
  });

  it("throws retryable on 429 and writes no ledger row", async () => {
    mockFetch(() => new Response("rate limited", { status: 429 }));
    const before = await sql<{ n: number }[]>`select count(*)::int as n from ai_generations`;
    await expect(
      callClaude({ task: "t", model: "haiku", tenantId, messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ retryable: true });
    const after = await sql<{ n: number }[]>`select count(*)::int as n from ai_generations`;
    expect(after[0].n).toBe(before[0].n);
  });

  it("throws non-retryable on 400 — retrying our own bad request helps nobody", async () => {
    mockFetch(() => new Response("bad request", { status: 400 }));
    await expect(
      callClaude({ task: "t", model: "haiku", tenantId, messages: [{ role: "user", content: "x" }] }),
    ).rejects.toMatchObject({ retryable: false });
  });

  it("refuses to run at all without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(
      callClaude({ task: "t", model: "haiku", tenantId, messages: [{ role: "user", content: "x" }] }),
    ).rejects.toBeInstanceOf(ClaudeError);
  });
});

describe("runTask is the only doorway to the database", () => {
  const schema = z.object({ answer: z.number() });

  it("returns validated data", async () => {
    mockFetch(() => claudeResponse('{"answer": 42}'));
    const { data } = await runTask(schema, {
      task: "t", model: "haiku", tenantId, messages: [{ role: "user", content: "x" }],
    });
    expect(data.answer).toBe(42);
  });

  it("fails the job on schema-invalid output and KEEPS the raw response", async () => {
    mockFetch(() => claudeResponse('{"answer": "forty-two"}'));
    let generationId = "";
    try {
      await runTask(schema, {
        task: "t", model: "haiku", tenantId, messages: [{ role: "user", content: "x" }],
      });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TaskOutputError);
      const [row] = await sql<{ id: string; succeeded: boolean; raw_response: string }[]>`
        select id, succeeded, raw_response from ai_generations
        where task = 't' and succeeded = false
        order by created_at desc limit 1`;
      generationId = row.id;
      expect(row.succeeded).toBe(false);
      expect(row.raw_response).toMatch(/forty-two/);
    }
    expect(generationId).not.toBe("");
  });
});

/* --------------------------------------------------------------- handlers */

const VALID_EXTRACTION = JSON.stringify({
  summary: "Priya asked whether Powell St is still available and said she is pre-approved.",
  intent: {
    intentType: "buying",
    budgetBand: null,
    timeline: "could move quickly",
    sentiment: "hot",
    confidence: 0.85,
  },
  proposedTasks: [
    {
      title: "Confirm Powell St availability",
      dueInDays: 1,
      reason: "Direct question in an inbound enquiry.",
    },
  ],
  proposedPreferenceChanges: [
    { field: "financeStatus", value: "pre-approved", reason: '"We\'re pre-approved."' },
  ],
  listingAddressMentions: ["Powell St"],
});

describe("SummariseInteraction", () => {
  it("writes the summary, queues proposals, and chains the rebuild", async () => {
    const contactId = await seedContact();
    const interactionId = await seedInteraction(contactId, "Is Powell St still available? We're pre-approved.");
    mockFetch(() => claudeResponse(VALID_EXTRACTION));

    const r = await summariseInteraction(tenantId, interactionId);
    expect(r).toMatchObject({ summarised: true, proposals: 2 });

    const [i] = await sql<{ ai_summary: string }[]>`
      select ai_summary from interactions where id = ${interactionId}`;
    expect(i.ai_summary).toMatch(/Powell St/);

    const items = await sql<{ kind: string; summary: string; proposed: unknown }[]>`
      select kind, summary, proposed from confirm_items
      where source_interaction_id = ${interactionId}`;
    // Postgres orders enums by definition position, so select by kind, not by index.
    expect(items.map((x) => x.kind).sort()).toEqual(["preference_change", "task"]);
    const pref = items.find((x) => x.kind === "preference_change")!;
    // The proposal carries DATA — committing must never re-parse prose.
    expect(pref.proposed).toMatchObject({ field: "financeStatus", value: "pre-approved" });

    expect(enqueued).toContainEqual({ name: "RebuildContactIntent", entityId: contactId });
  });

  it("running twice does not double the queue — at-least-once is survivable", async () => {
    const contactId = await seedContact();
    const interactionId = await seedInteraction(contactId, "Is Powell St still available?");
    mockFetch(() => claudeResponse(VALID_EXTRACTION));

    await summariseInteraction(tenantId, interactionId);
    const again = await summariseInteraction(tenantId, interactionId);
    expect(again).toMatchObject({ skipped: "already-summarised" });

    const [n] = await sql<{ n: number }[]>`
      select count(*)::int as n from confirm_items where source_interaction_id = ${interactionId}`;
    expect(n.n).toBe(2);
  });

  it("schema-invalid model output writes NOTHING to the contact", async () => {
    const contactId = await seedContact();
    const interactionId = await seedInteraction(contactId, "Hello there.");
    mockFetch(() => claudeResponse('{"summary": "ok", "intent": {"intentType": "hostile-takeover"}}'));

    await expect(summariseInteraction(tenantId, interactionId)).rejects.toBeInstanceOf(TaskOutputError);

    const [i] = await sql<{ ai_summary: string | null }[]>`
      select ai_summary from interactions where id = ${interactionId}`;
    expect(i.ai_summary).toBeNull();
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int as n from confirm_items where source_interaction_id = ${interactionId}`;
    expect(n.n).toBe(0);
  });

  it("without an API key it skips, honestly, instead of failing or faking", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const contactId = await seedContact();
    const interactionId = await seedInteraction(contactId, "Hello.");
    const r = await summariseInteraction(tenantId, interactionId);
    expect(r).toMatchObject({ skipped: "no-api-key" });
  });
});

const VALID_BRIEF = JSON.stringify({
  rollingBrief:
    "Ada enquired three days ago about Powell St and is pre-approved. Budget unknown. Timeline: could move quickly. Nothing is currently blocking.",
  intentType: "buying",
  budgetBand: null,
  timeline: "could move quickly",
  blockers: [],
  sentiment: "warm",
  confidence: 0.7,
});

describe("RebuildContactIntent", () => {
  it("upserts the derived intent record directly — rule 5 does not apply to derived data", async () => {
    const contactId = await seedContact();
    await seedInteraction(contactId, "Is Powell St available? Pre-approved here.");
    mockFetch(() => claudeResponse(VALID_BRIEF));

    const r = await rebuildContactIntent(tenantId, contactId);
    expect(r).toMatchObject({ rebuilt: true });

    const [row] = await sql<
      { rolling_brief: string; intent_type: string; sentiment: string; confidence: number }[]
    >`select rolling_brief, intent_type, sentiment, confidence
       from contact_intent where contact_id = ${contactId}`;
    expect(row.rolling_brief).toMatch(/Ada enquired/);
    expect(row.intent_type).toBe("buying");

    // Rebuild is idempotent by nature: run again, still one row.
    mockFetch(() => claudeResponse(VALID_BRIEF));
    await rebuildContactIntent(tenantId, contactId);
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int as n from contact_intent where contact_id = ${contactId}`;
    expect(n.n).toBe(1);
  });

  it("a contact with no interactions gets NO brief — empty is honest", async () => {
    const contactId = await seedContact();
    const r = await rebuildContactIntent(tenantId, contactId);
    expect(r).toMatchObject({ skipped: "no-interactions" });
  });

  it("a merged-away contact is not rebuilt", async () => {
    const survivor = await seedContact();
    const loser = await seedContact();
    await seedInteraction(loser, "Old enquiry.");
    await sql`update contacts set merged_into_id = ${survivor}, tombstoned_at = now()
              where id = ${loser}`;
    const r = await rebuildContactIntent(tenantId, loser);
    expect(r).toMatchObject({ skipped: "gone-tombstoned-or-merged" });
  });
});

/* ------------------------------------------------- committing a proposal */

describe("committing a preference change applies data, not prose (B4.5)", () => {
  async function proposal(contactId: string, proposed: unknown, kind = "preference_change") {
    const [item] = await sql<{ id: string }[]>`
      insert into confirm_items (tenant_id, contact_id, kind, summary, after_text, proposed, confidence)
      values (${tenantId}, ${contactId}, ${kind}, 'Proposed change', 'after', ${sql.json(proposed as never)}, 0.8)
      returning id`;
    return item.id;
  }

  it("sets a numeric field with range checking", async () => {
    const contactId = await seedContact();
    const id = await proposal(contactId, {
      field: "priceMax", value: 700000, reason: "Said up to $700k.",
    });
    const r = await commitConfirmItem({ id });
    expect(r.ok).toBe(true);

    const [prefs] = await sql<{ price_max: number }[]>`
      select price_max from contact_preferences where contact_id = ${contactId}`;
    expect(prefs.price_max).toBe(700000);
  });

  it("adds suburbs by name without removing the ones already wanted", async () => {
    const contactId = await seedContact();
    const [sub1] = await sql<{ id: string; name: string }[]>`select id, name from suburbs limit 1`;
    const [sub2] = await sql<{ id: string; name: string }[]>`select id, name from suburbs offset 1 limit 1`;
    const [prefs] = await sql<{ id: string }[]>`
      insert into contact_preferences (tenant_id, contact_id) values (${tenantId}, ${contactId})
      returning id`;
    await sql`insert into contact_preference_suburbs (preference_id, suburb_id)
              values (${prefs.id}, ${sub1.id})`;

    const id = await proposal(contactId, {
      field: "suburbs", value: [sub2.name], reason: "Also open to it.",
    });
    const r = await commitConfirmItem({ id });
    expect(r.ok).toBe(true);

    const rows = await sql<{ suburb_id: string }[]>`
      select suburb_id from contact_preference_suburbs where preference_id = ${prefs.id}`;
    expect(rows.map((x) => x.suburb_id).sort()).toEqual([sub1.id, sub2.id].sort());
  });

  it("refuses a suburb that resolves to nothing rather than pretending it applied", async () => {
    const contactId = await seedContact();
    const id = await proposal(contactId, {
      field: "suburbs", value: ["Atlantis Heights"], reason: "Typo'd suburb.",
    });
    const r = await commitConfirmItem({ id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nothing was applied/i);
  });

  it("refuses an unusable numeric value", async () => {
    const contactId = await seedContact();
    const id = await proposal(contactId, {
      field: "bedsMin", value: "several", reason: "Vague.",
    });
    const r = await commitConfirmItem({ id });
    expect(r.ok).toBe(false);
  });

  it("a committed task carries its due date from the proposal", async () => {
    const contactId = await seedContact();
    const id = await proposal(
      contactId,
      { title: "Call about the shed", dueInDays: 3, reason: "Asked directly." },
      "task",
    );
    const r = await commitConfirmItem({ id });
    expect(r.ok).toBe(true);

    const [t] = await sql<{ due_at: Date | null }[]>`
      select due_at from tasks where contact_id = ${contactId} order by created_at desc limit 1`;
    expect(t.due_at).not.toBeNull();
    const days = (t.due_at!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.5);
    expect(days).toBeLessThan(3.5);
  });
});

describe("truncation is not retried (B4 review)", () => {
  it("a max_tokens stop is non-retryable, ledgered, and keeps the partial text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              content: [{ type: "text", text: '{"summary": "starts fine but then it j' }],
              stop_reason: "max_tokens",
              usage: { input_tokens: 900, output_tokens: 1200 },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    await expect(
      callClaude({
        task: "truncation-check",
        model: "haiku",
        tenantId,
        messages: [{ role: "user", content: "x" }],
        maxTokens: 1200,
      }),
      // Deterministic: the same input truncates every attempt, so five paid retries
      // would buy nothing but the bill.
    ).rejects.toMatchObject({ retryable: false });

    const [row] = await sql<{ succeeded: boolean; raw_response: string; output_tokens: number }[]>`
      select succeeded, raw_response, output_tokens from ai_generations
      where task = 'truncation-check' order by created_at desc limit 1`;
    expect(row.succeeded).toBe(false);
    // The tokens WERE billed, so they are on the ledger.
    expect(row.output_tokens).toBe(1200);
    expect(row.raw_response).toMatch(/starts fine/);
  });
});
