import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { systemTenantId } from "@/db";
import { ingestThrough } from "@/server/intake";
import { verifySnsSignature, type SnsEnvelope } from "@/server/intake/sns";

/**
 * Inbound email (B3.5): SES receipt rule → S3/SNS → here → the email adapter.
 *
 * SES receiving is confirmed available in ap-southeast-2 (docs/research — verified
 * against the current endpoints table, Sydney row present). The rule set delivers
 * either the raw MIME inline (SNS action, small mail) or an S3 pointer (S3 action,
 * the durable path and the one production uses — the S3 object IS the evidence
 * copy the interaction row points at).
 *
 * Every request must prove it is Amazon: the SNS signature is verified before the
 * payload is even parsed as mail. SNS retries deliveries, so everything downstream
 * is idempotent — the MIME Message-ID is the replay key, and a redelivered
 * notification collapses into the interaction it already created.
 */

export const dynamic = "force-dynamic";

const verdict = z.object({ status: z.string() }).optional();

const sesNotification = z.object({
  notificationType: z.literal("Received").optional(),
  mail: z.object({
    messageId: z.string(),
    source: z.string().optional(),
    destination: z.array(z.string()).optional(),
  }),
  receipt: z
    .object({
      /** SES scans on receipt. FAILed spam/virus verdicts are honoured below. */
      spamVerdict: verdict,
      virusVerdict: verdict,
      spfVerdict: verdict,
      dkimVerdict: verdict,
      action: z.object({
        type: z.string(),
        bucketName: z.string().optional(),
        objectKey: z.string().optional(),
        // SNS action: raw MIME travels inline, base64 when encoding says so.
        encoding: z.string().optional(),
      }),
    })
    .optional(),
  content: z.string().optional(),
});

let s3: S3Client | null = null;
function s3Client() {
  if (!s3) s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-southeast-2" });
  return s3;
}

async function fetchRawMime(bucket: string, key: string): Promise<string> {
  const res = await s3Client().send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) throw new Error(`Empty S3 object s3://${bucket}/${key}`);
  return res.Body.transformToString();
}

export async function POST(req: NextRequest) {
  let envelope: SnsEnvelope;
  try {
    envelope = (await req.json()) as SnsEnvelope;
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }

  /**
   * Tests and local development post with a shared secret instead of an SNS
   * signature. Refused outright in production — there, Amazon's signature is the
   * only accepted proof.
   */
  const testSecret = process.env.INGEST_TEST_SECRET;
  const viaTestSecret =
    process.env.NODE_ENV !== "production" &&
    !!testSecret &&
    req.headers.get("x-ozi-ingest-secret") === testSecret;

  if (!viaTestSecret) {
    const genuine = await verifySnsSignature(envelope);
    if (!genuine) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 403 });
    }

    /**
     * The signature only proves the envelope came from SNS — ANY topic in ANY AWS
     * account signs validly, so an attacker who subscribes this URL to their own
     * topic can deliver genuinely-signed notifications carrying whatever "mail"
     * they like. The topic pin closes that: production refuses everything not
     * from OUR topic, and refuses to run at all without the pin configured (found
     * by the B3 review — signature-without-topic-check is the classic SNS trap).
     */
    const expectedTopic = process.env.SES_TOPIC_ARN;
    if (process.env.NODE_ENV === "production" && !expectedTopic) {
      console.error("[inbound/ses] SES_TOPIC_ARN is not set — refusing all SNS traffic.");
      return NextResponse.json({ error: "Inbound not configured" }, { status: 503 });
    }
    if (expectedTopic && envelope.TopicArn !== expectedTopic) {
      return NextResponse.json({ error: "Unrecognised topic" }, { status: 403 });
    }
  }

  /**
   * Subscription handshake: SNS sends a confirmation URL when the topic is wired
   * to this endpoint (B6 does the wiring). Confirming automatically — after the
   * signature and topic checks above — is what the SNS docs prescribe for HTTPS
   * endpoints. The URL must be the SNS service host itself, same shape as the
   * signing-cert rule; `.amazonaws.com` alone also matches S3 buckets, whose
   * names anyone can register.
   */
  if (envelope.Type === "SubscriptionConfirmation" && envelope.SubscribeURL) {
    const u = new URL(envelope.SubscribeURL);
    if (u.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname)) {
      await fetch(envelope.SubscribeURL);
      return NextResponse.json({ ok: true, confirmed: true });
    }
    return NextResponse.json({ error: "Suspicious SubscribeURL" }, { status: 400 });
  }

  if (envelope.Type !== "Notification") {
    return NextResponse.json({ ok: true, ignored: envelope.Type });
  }

  let notification: z.infer<typeof sesNotification>;
  try {
    notification = sesNotification.parse(JSON.parse(envelope.Message));
  } catch {
    return NextResponse.json({ error: "Unrecognised SES payload" }, { status: 422 });
  }

  /**
   * SES scanned the message on receipt; honour the verdicts it attached. Spam and
   * virus FAILs are dropped — acknowledged with 200, because a 4xx/5xx makes SNS
   * redeliver the same spam for days. SPF/DKIM failures are NOT dropped: small
   * agencies receive legitimate mail from mis-configured senders constantly, and
   * losing an enquiry is the one failure intake is not allowed. The residual
   * From-spoofing risk is bounded by design — a spoofed sender can add an
   * interaction to a record but never merge records (ambiguity goes to human
   * review), never edit history (append-only), and never trigger a send (rule 1).
   */
  const failed = (v?: { status: string }) => v?.status?.toUpperCase() === "FAIL";
  if (failed(notification.receipt?.spamVerdict) || failed(notification.receipt?.virusVerdict)) {
    console.warn(
      `[inbound/ses] dropped mail ${notification.mail.messageId}: spam=${notification.receipt?.spamVerdict?.status} virus=${notification.receipt?.virusVerdict?.status}`,
    );
    return NextResponse.json({ ok: true, dropped: "failed-receipt-verdict" });
  }

  // Where the MIME is decides nothing else about the pipeline.
  let mime: string;
  let rawS3Key: string | null = null;
  const action = notification.receipt?.action;
  if (action?.type === "S3" && action.bucketName && action.objectKey) {
    rawS3Key = `s3://${action.bucketName}/${action.objectKey}`;
    mime = await fetchRawMime(action.bucketName, action.objectKey);
  } else if (notification.content) {
    mime =
      action?.encoding?.toUpperCase() === "BASE64"
        ? Buffer.from(notification.content, "base64").toString("utf8")
        : notification.content;
  } else {
    return NextResponse.json({ error: "Notification carries no mail content" }, { status: 422 });
  }

  /**
   * Single-tenant deployment (D1): all inbound mail belongs to the one tenant.
   * Multi-tenant routing would key on the destination address — the schema is
   * ready for it, this lookup is the only line that changes.
   */
  const tenantId = await systemTenantId();

  try {
    const result = await ingestThrough("email", { mime, rawS3Key }, tenantId);
    return NextResponse.json({
      ok: true,
      duplicate: result.duplicate,
      resolution: result.resolution,
    });
  } catch (e) {
    console.error("[inbound/ses] ingest failed:", e instanceof Error ? e.message : e);
    // 500 makes SNS redeliver later — the replay index makes that safe, and a
    // transient DB failure heals by retry instead of dropping mail.
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}
