import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, withTenant } from "@/db";
import { tenants, consentTemplates } from "@/db/schema";
import { ingestThrough } from "@/server/intake";
import { webFormPayload } from "@/server/intake/adapters/web-form";
import { issueFormToken, verifyFormToken } from "@/server/intake/form-token";
import { checkRateLimit } from "@/server/intake/rate-limit";

/**
 * The public enquiry endpoint (B3.4). No session — the whole world can POST here,
 * which is why it is the most defended route in the app:
 *
 *   addressed by per-tenant key   → a guessable tenant id is never the address
 *   size caps, strict schema      → §13, before anything touches the database
 *   signed token, min fill time   → drive-by bots fail the physics of the form
 *   single-use nonce              → a captured request replays into a no-op
 *   honeypot                      → naive bots volunteer themselves
 *   rate limits (fail open)       → a burst is blunted; an outage never eats a lead
 *
 * GET issues what a form needs to render: the token and the exact consent wording,
 * which the token pins by hash so the consent row records what was actually shown.
 */

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const DEFAULT_FORM = "Website enquiry";

async function tenantByKey(key: string) {
  // uuid column: a malformed key is a 404, not a database error.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) {
    return null;
  }
  const [t] = await db
    .select({ id: tenants.id, name: tenants.name })
    .from(tenants)
    .where(eq(tenants.formKey, key))
    .limit(1);
  return t ?? null;
}

async function consentWordingFor(tenantId: string, formName: string) {
  /**
   * Through withTenant, unlike the tenants lookup above — consent_templates is
   * RLS-protected, and a bare read as the app role returns ZERO rows rather than
   * erroring. Found by the B3 review: dev connects as the table owner (which RLS
   * exempts), so locally this bug was invisible, while production would have
   * silently served the fallback wording on every form forever.
   */
  const [tpl] = await withTenant(tenantId, (tx) =>
    tx
      .select({ wording: consentTemplates.wording })
      .from(consentTemplates)
      .where(
        and(
          eq(consentTemplates.tenantId, tenantId),
          eq(consentTemplates.formName, formName),
        ),
      )
      .limit(1),
  );
  return (
    tpl?.wording ??
    // A fallback that is legally honest rather than empty: no template means the
    // form can still render, and the row still records exactly this text.
    "Yes, send me property updates by email. You can unsubscribe at any time."
  );
}

/** The client's address as CloudFront delivers it. Behind CloudFront the last hop
 *  in X-Forwarded-For is the one CloudFront appended — the only one not chosen by
 *  the client. Locally there is no proxy and the header is absent. */
function clientIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return null;
  const hops = xff.split(",").map((s) => s.trim());
  return hops[hops.length - 1] || null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const tenant = await tenantByKey(key);
  if (!tenant) return NextResponse.json({ error: "Unknown form" }, { status: 404 });

  const formName = req.nextUrl.searchParams.get("form") || DEFAULT_FORM;
  const consentWording = await consentWordingFor(tenant.id, formName);

  return NextResponse.json({
    formName,
    consentWording,
    token: issueFormToken(key, consentWording),
    fields: ["firstName", "lastName", "email", "phone", "message", "marketingOptIn"],
  });
}

const submitEnvelope = z
  .object({
    token: z.string().min(10).max(512),
    /** The honeypot. A real browser leaves it empty; naming it 'website' makes it
     *  attractive to bots filling every field. */
    website: z.string().max(500).default(""),
    /**
     * Envelope caps are sanity bounds, set ABOVE the adapter's user-facing limits
     * (message 5000 etc.) so an over-limit field reaches webFormPayload and comes
     * back as a named field error — "your message is too long" — rather than this
     * layer's generic "malformed submission".
     */
    firstName: z.string().max(500).default(""),
    lastName: z.string().max(500).default(""),
    email: z.string().max(600).default(""),
    phone: z.string().max(100).default(""),
    message: z.string().max(12000).default(""),
    listingRef: z.string().max(120).nullable().default(null),
    formName: z.string().max(120).default(DEFAULT_FORM),
    marketingOptIn: z.boolean().default(false),
    consentWording: z.string().max(2000).default(""),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  const tenant = await tenantByKey(key);
  if (!tenant) return NextResponse.json({ error: "Unknown form" }, { status: 404 });

  // Size first, before parsing. Content-Length can lie under chunked encoding, so
  // the read body is measured again.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Enquiry too large" }, { status: 413 });
  }
  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Enquiry too large" }, { status: 413 });
  }

  let body: z.infer<typeof submitEnvelope>;
  try {
    body = submitEnvelope.parse(JSON.parse(text));
  } catch {
    return NextResponse.json({ error: "Malformed submission" }, { status: 400 });
  }

  const ip = clientIp(req);

  /**
   * Honeypot: accepted on the surface, recorded nowhere. The generic success is
   * deliberate — telling a bot which field betrayed it is free training data. The
   * console line is the quarantine record; if autofill ever starts tripping this
   * for real people, that log is how it will be noticed.
   */
  if (body.website.trim() !== "") {
    console.warn(
      `[forms] honeypot tripped: tenant=${tenant.id} ip=${ip ?? "?"} form=${body.formName}`,
    );
    return NextResponse.json({ ok: true });
  }

  const rate = await checkRateLimit(ip, tenant.id);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many enquiries from this address. Please try again shortly." },
      { status: 429 },
    );
  }

  const token = verifyFormToken(body.token, key, body.consentWording);
  if (!token.ok) {
    // One honest message for every token failure: distinguishing them helps only
    // the sender who is probing.
    return NextResponse.json(
      { error: "This form has expired. Please reload the page and try again." },
      { status: 403 },
    );
  }

  const parsed = webFormPayload.safeParse({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    message: body.message,
    listingRef: body.listingRef,
    formName: body.formName,
    marketingOptIn: body.marketingOptIn,
    consentWording: body.consentWording,
    ipAddress: ip,
    nonce: token.nonce,
    submittedAt: new Date(),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    return NextResponse.json(
      { error: "Some fields need attention.", fieldErrors: flat.fieldErrors },
      { status: 422 },
    );
  }

  try {
    const result = await ingestThrough("web_form", parsed.data, tenant.id);
    // duplicate:true is the burned nonce or a browser resubmit — the enquiry
    // already landed, so the honest answer to the person is still "received".
    return NextResponse.json({ ok: true, received: !result.duplicate ? "new" : "already" });
  } catch (e) {
    console.error("[forms] ingest failed:", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: "Something went wrong and the enquiry was not saved. Please phone the office." },
      { status: 500 },
    );
  }
}
