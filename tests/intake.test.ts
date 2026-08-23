import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";
import { systemTenantId } from "@/db";
import { ingestNormalised, ingestThrough } from "@/server/intake";
import type { NormalisedInteraction } from "@/server/intake/types";
import { emailAdapter, splitDisplayName } from "@/server/intake/adapters/email";
import { webFormAdapter } from "@/server/intake/adapters/web-form";
import {
  issueFormToken,
  verifyFormToken,
  MIN_FILL_MS,
  MAX_AGE_MS,
} from "@/server/intake/form-token";
import { verifySnsSignature, _certCache, type SnsEnvelope } from "@/server/intake/sns";

/**
 * The pipeline and its adapters (B3.2/B3.4/B3.5).
 *
 * The pipeline tests run against the real database — replay dedupe and consent
 * provenance are database behaviours, and a mock would pass while production
 * refused. The token and SNS tests are pure crypto: fast, no network, and the SNS
 * negative cases are the ones that matter (an open inbound endpoint that trusts a
 * forged envelope is an open door for planted "evidence").
 */

process.env.FORM_TOKEN_SECRET ??= "test-secret-at-least-16-chars";

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

function normalised(over: Partial<NormalisedInteraction> = {}): NormalisedInteraction {
  seq += 1;
  return {
    channel: "web_form",
    direction: "in",
    occurredAt: new Date(),
    subject: "Enquiry",
    body: `Interested in Powell St. [case ${seq}]`,
    identity: {
      kind: "claimed",
      email: `pipeline${seq}.${Date.now() % 100000}@example.com`,
      phone: null,
      firstName: "Pipeline",
      lastName: `Case${seq}`,
    },
    messageId: `test:${randomUUID()}`,
    threadRef: null,
    rawS3Key: null,
    listingRef: null,
    consents: [],
    ...over,
  };
}

describe("the pipeline writes what one enquiry means, atomically", () => {
  it("contact + interaction + adapter health in one pass", async () => {
    const n = normalised();
    const r = await ingestNormalised(n, tenantId);
    expect(r.duplicate).toBe(false);
    expect(r.resolution).toBe("new");

    const [i] = await sql<{ contact_id: string; channel: string; body: string }[]>`
      select contact_id, channel, body from interactions where id = ${r.interactionId}`;
    expect(i.contact_id).toBe(r.contactId);
    expect(i.channel).toBe("web_form");

    const [h] = await sql<{ last_received_at: Date }[]>`
      select last_received_at from channel_adapters
      where tenant_id = ${tenantId} and name = 'web_form'`;
    expect(h.last_received_at).not.toBeNull();
  });

  it("a replayed delivery collapses into the original — same contact, same row", async () => {
    const n = normalised();
    const first = await ingestNormalised(n, tenantId);
    const second = await ingestNormalised(n, tenantId);

    expect(second.duplicate).toBe(true);
    expect(second.interactionId).toBe(first.interactionId);
    expect(second.contactId).toBe(first.contactId);

    // And crucially: no second contact, no spurious merge review.
    const rows = await sql<{ n: number }[]>`
      select count(*)::int as n from interactions
      where message_id = ${n.messageId!}`;
    expect(rows[0].n).toBe(1);
  });

  it("a second enquiry from the same address attaches to the same person", async () => {
    const n1 = normalised();
    const first = await ingestNormalised(n1, tenantId);
    const n2 = normalised({
      identity: n1.identity,
      body: "Following up on my enquiry.",
    });
    const second = await ingestNormalised(n2, tenantId);

    expect(second.resolution).toBe("existing");
    expect(second.contactId).toBe(first.contactId);
    expect(second.interactionId).not.toBe(first.interactionId);
  });

  it("consent rides in the same transaction, wording and provenance frozen", async () => {
    const n = normalised({
      consents: [
        {
          channel: "email",
          status: "granted",
          sourceForm: "Website enquiry",
          wordingShown: "Yes, send me property updates by email.",
          ipAddress: "203.0.113.9",
        },
      ],
    });
    const r = await ingestNormalised(n, tenantId);

    const [c] = await sql<
      { status: string; source_form: string; wording_shown: string; ip_address: string }[]
    >`select status, source_form, wording_shown, ip_address
       from consents where contact_id = ${r.contactId}`;
    expect(c.status).toBe("granted");
    expect(c.source_form).toBe("Website enquiry");
    expect(c.wording_shown).toMatch(/property updates/);
    expect(c.ip_address).toBe("203.0.113.9");
  });

  it("an ambiguous enquiry still lands, with the review beside it", async () => {
    const n1 = normalised();
    await ingestNormalised(n1, tenantId);
    const claimed = n1.identity as Extract<NormalisedInteraction["identity"], { kind: "claimed" }>;
    // Same email, flatly different name — the family-mailbox pattern.
    const n2 = normalised({
      identity: {
        kind: "claimed",
        email: claimed.email,
        phone: null,
        firstName: "Wholly",
        lastName: "Different",
      },
    });
    const r = await ingestNormalised(n2, tenantId);
    expect(r.resolution).toBe("ambiguous");

    const reviews = await sql<{ n: number }[]>`
      select count(*)::int as n from merge_reviews where contact_b_id = ${r.contactId}`;
    expect(reviews[0].n).toBe(1);
  });
});

describe("the email adapter", () => {
  const MIME = [
    "From: Jane Citizen <jane.mime@example.com>",
    "To: enquiries@in.ozirealty.com.au",
    "Subject: 12 Powell St - Saturday inspection?",
    "Message-ID: <msg-1@mail.example.com>",
    "Date: Mon, 17 Aug 2026 09:30:00 +0930",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "Hi, is the Saturday inspection still on? We're pre-approved.",
  ].join("\r\n");

  it("parses identity, subject, body and message id from raw MIME", async () => {
    const n = await emailAdapter.ingest({ mime: MIME, rawS3Key: "s3://bucket/raw/1" });
    expect(n.channel).toBe("email");
    expect(n.subject).toBe("12 Powell St - Saturday inspection?");
    expect(n.body).toMatch(/pre-approved/);
    expect(n.messageId).toBe("<msg-1@mail.example.com>");
    expect(n.rawS3Key).toBe("s3://bucket/raw/1");
    const id = n.identity as { email: string; firstName: string; lastName: string };
    expect(id.email).toBe("jane.mime@example.com");
    expect(id.firstName).toBe("Jane");
    expect(id.lastName).toBe("Citizen");
  });

  it("threads a reply to the ROOT of its References chain", async () => {
    const reply = [
      "From: Jane Citizen <jane.mime@example.com>",
      "Subject: Re: 12 Powell St",
      "Message-ID: <msg-3@mail.example.com>",
      "In-Reply-To: <msg-2@mail.example.com>",
      "References: <msg-1@mail.example.com> <msg-2@mail.example.com>",
      "",
      "Great, see you Saturday.",
    ].join("\r\n");
    const n = await emailAdapter.ingest({ mime: reply });
    expect(n.threadRef).toBe("<msg-1@mail.example.com>");
  });

  it("extracts text from an HTML-only message rather than ingesting emptiness", async () => {
    const html = [
      "From: noreply@portal.example.com",
      "Subject: New enquiry",
      "Message-ID: <html-1@portal.example.com>",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<html><body><p>Enquiry about <b>4 Larkin Ave</b></p><p>Budget $850k</p></body></html>",
    ].join("\r\n");
    const n = await emailAdapter.ingest({ mime: html });
    expect(n.body).toMatch(/4 Larkin Ave/);
    expect(n.body).toMatch(/Budget \$850k/);
    expect(n.body).not.toMatch(/</);
  });

  it("end to end: MIME through the pipeline twice is one interaction (SNS redelivery)", async () => {
    const unique = `<e2e-${randomUUID()}@mail.example.com>`;
    const mime = MIME.replace("<msg-1@mail.example.com>", unique).replace(
      "jane.mime@example.com",
      `jane.${Date.now() % 100000}@example.com`,
    );
    const a = await ingestThrough("email", { mime, rawS3Key: null }, tenantId);
    const b = await ingestThrough("email", { mime, rawS3Key: null }, tenantId);
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(b.interactionId).toBe(a.interactionId);
  });

  it("splitDisplayName handles the shapes that actually arrive", () => {
    expect(splitDisplayName("Jane Citizen")).toEqual({ firstName: "Jane", lastName: "Citizen" });
    expect(splitDisplayName("Jane")).toEqual({ firstName: "Jane", lastName: null });
    expect(splitDisplayName("Mary Anne O'Brien")).toEqual({ firstName: "Mary Anne", lastName: "O'Brien" });
    expect(splitDisplayName("")).toEqual({ firstName: null, lastName: null });
    expect(splitDisplayName(undefined)).toEqual({ firstName: null, lastName: null });
  });
});

describe("the web form adapter", () => {
  function payload(over: Record<string, unknown> = {}) {
    seq += 1;
    return {
      firstName: "Web",
      lastName: `Form${seq}`,
      email: `web${seq}.${Date.now() % 100000}@example.com`,
      phone: "",
      message: "Is the Saturday open still on?",
      listingRef: null,
      formName: "Website enquiry",
      marketingOptIn: false,
      consentWording: "",
      ipAddress: "203.0.113.10",
      nonce: randomUUID(),
      submittedAt: new Date(),
      ...over,
    };
  }

  it("no ticked box means NO consent row — absence of consent is not consent", async () => {
    const n = await webFormAdapter.ingest(payload({ marketingOptIn: false }));
    expect(n.consents).toHaveLength(0);
  });

  it("a tick without the wording that was shown is worthless as evidence, so none is recorded", async () => {
    const n = await webFormAdapter.ingest(
      payload({ marketingOptIn: true, consentWording: "" }),
    );
    expect(n.consents).toHaveLength(0);
  });

  it("a tick with wording and an email records granted consent with full provenance", async () => {
    const n = await webFormAdapter.ingest(
      payload({ marketingOptIn: true, consentWording: "Yes, email me updates." }),
    );
    expect(n.consents).toHaveLength(1);
    expect(n.consents[0]).toMatchObject({
      channel: "email",
      status: "granted",
      sourceForm: "Website enquiry",
      wordingShown: "Yes, email me updates.",
      ipAddress: "203.0.113.10",
    });
  });

  it("the nonce becomes the replay key", async () => {
    const p = payload();
    const n = await webFormAdapter.ingest(p);
    expect(n.messageId).toBe(`form:${p.nonce}`);
  });
});

describe("the form token", () => {
  const KEY = "0f0e0d0c-0b0a-4990-8877-665544332211";
  const WORDING = "Yes, send me updates.";

  it("round-trips after the minimum fill time", () => {
    const token = issueFormToken(KEY, WORDING);
    const check = verifyFormToken(token, KEY, WORDING, Date.now() + MIN_FILL_MS + 100);
    expect(check.ok).toBe(true);
  });

  it("refuses a submit faster than a human can type — the bot trap", () => {
    const token = issueFormToken(KEY, WORDING);
    const check = verifyFormToken(token, KEY, WORDING, Date.now() + 400);
    expect(check).toMatchObject({ ok: false, reason: "too-fast" });
  });

  it("refuses a token older than a day — the stale-tab case", () => {
    const token = issueFormToken(KEY, WORDING);
    const check = verifyFormToken(token, KEY, WORDING, Date.now() + MAX_AGE_MS + 1000);
    expect(check).toMatchObject({ ok: false, reason: "expired" });
  });

  it("refuses a token issued for a different form key", () => {
    const token = issueFormToken(KEY, WORDING);
    const other = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const check = verifyFormToken(token, other, WORDING, Date.now() + MIN_FILL_MS + 100);
    expect(check.ok).toBe(false);
  });

  it("refuses when the consent wording changed between fetch and submit", () => {
    const token = issueFormToken(KEY, WORDING);
    const check = verifyFormToken(
      token, KEY, "Completely different wording.", Date.now() + MIN_FILL_MS + 100,
    );
    expect(check).toMatchObject({ ok: false, reason: "wording-mismatch" });
  });

  it("refuses a tampered signature", () => {
    const token = issueFormToken(KEY, WORDING);
    const parts = token.split(".");
    parts[5] = parts[5].slice(0, -4) + "AAAA";
    const check = verifyFormToken(parts.join("."), KEY, WORDING, Date.now() + MIN_FILL_MS + 100);
    expect(check).toMatchObject({ ok: false, reason: "bad-signature" });
  });

  it("refuses garbage outright", () => {
    expect(verifyFormToken("not-a-token", KEY, WORDING).ok).toBe(false);
    expect(verifyFormToken("", KEY, WORDING).ok).toBe(false);
  });
});

describe("SNS signature verification", () => {
  /**
   * A self-signed certificate stands in for Amazon's: the cache is seeded directly
   * so no network fetch happens, and the envelope is signed with the matching
   * private key exactly the way SNS signs (SignatureVersion 1, SHA1withRSA over
   * the canonical field string).
   */
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const CERT_URL = "https://sns.ap-southeast-2.amazonaws.com/SimpleNotificationService-test.pem";
  _certCache.set(CERT_URL, publicKey.export({ type: "spki", format: "pem" }).toString());

  function signedEnvelope(over: Partial<SnsEnvelope> = {}): SnsEnvelope {
    const e: SnsEnvelope = {
      Type: "Notification",
      MessageId: randomUUID(),
      TopicArn: "arn:aws:sns:ap-southeast-2:123456789012:ozirealty-inbound",
      Message: JSON.stringify({ mail: { messageId: "x" } }),
      Timestamp: new Date().toISOString(),
      SignatureVersion: "1",
      Signature: "",
      SigningCertURL: CERT_URL,
      ...over,
    };
    const fields = ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"] as const;
    let canonical = "";
    for (const f of fields) {
      const v = e[f as keyof SnsEnvelope];
      if (v === undefined) continue;
      canonical += `${f}\n${v}\n`;
    }
    const signer = createSign("RSA-SHA1");
    signer.update(canonical, "utf8");
    e.Signature = signer.sign(privateKey, "base64");
    return e;
  }

  it("accepts a genuinely signed notification", async () => {
    expect(await verifySnsSignature(signedEnvelope())).toBe(true);
  });

  it("refuses when the message body was altered after signing", async () => {
    const e = signedEnvelope();
    e.Message = JSON.stringify({ mail: { messageId: "forged" } });
    expect(await verifySnsSignature(e)).toBe(false);
  });

  it("refuses a signature from the wrong key", async () => {
    const { privateKey: wrongKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const e = signedEnvelope();
    const signer = createSign("RSA-SHA1");
    signer.update(`Message\n${e.Message}\n`, "utf8");
    e.Signature = signer.sign(wrongKey, "base64");
    expect(await verifySnsSignature(e)).toBe(false);
  });

  it("refuses a certificate URL that is not Amazon's — the attacker-controlled field", async () => {
    for (const url of [
      "https://evil.example.com/cert.pem",
      "http://sns.ap-southeast-2.amazonaws.com/cert.pem", // http, not https
      "https://sns.ap-southeast-2.amazonaws.com.evil.com/cert.pem",
      "https://sns.ap-southeast-2.amazonaws.com/cert.txt", // not a .pem path
    ]) {
      const e = signedEnvelope({ SigningCertURL: url });
      expect(await verifySnsSignature(e), url).toBe(false);
    }
  });
});
