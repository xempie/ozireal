import { createVerify, X509Certificate } from "node:crypto";

/**
 * SNS message verification (B3.5).
 *
 * The inbound-email route is a public URL that accepts "here is a message, go
 * ingest it" — unverified, it is an open door for forged mail. Amazon signs every
 * SNS delivery; this checks that signature the way the SNS docs specify:
 * reconstruct the canonical string for the message type, fetch Amazon's signing
 * certificate (only ever from an https amazonaws.com URL — the cert URL arrives in
 * the payload, so THAT is the part an attacker controls), and verify.
 *
 * SignatureVersion 1 is SHA1withRSA, 2 is SHA256withRSA. Certificates are cached;
 * Amazon rotates them rarely and fetching per message would add a network hop to
 * every email received.
 */

export type SnsEnvelope = {
  Type: "Notification" | "SubscriptionConfirmation" | "UnsubscribeConfirmation";
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
};

const SIGNED_FIELDS: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: [
    "Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type",
  ],
  UnsubscribeConfirmation: [
    "Message", "MessageId", "SubscribeURL", "Timestamp", "Token", "TopicArn", "Type",
  ],
};

const certCache = new Map<string, string>();

function certUrlIsAmazon(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(u.hostname) &&
      u.pathname.endsWith(".pem")
    );
  } catch {
    return false;
  }
}

async function signingKey(certUrl: string): Promise<string> {
  const cached = certCache.get(certUrl);
  if (cached) return cached;
  const res = await fetch(certUrl);
  if (!res.ok) throw new Error(`Certificate fetch failed: ${res.status}`);
  const pem = await res.text();
  const publicKey = new X509Certificate(pem).publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  certCache.set(certUrl, publicKey);
  return publicKey;
}

export async function verifySnsSignature(envelope: SnsEnvelope): Promise<boolean> {
  if (!certUrlIsAmazon(envelope.SigningCertURL)) return false;

  const fields = SIGNED_FIELDS[envelope.Type];
  if (!fields) return false;

  // Canonical form: alternating name/value lines, only fields present, sorted order
  // as listed in the SNS documentation.
  let canonical = "";
  for (const f of fields) {
    const value = envelope[f as keyof SnsEnvelope];
    if (value === undefined) continue;
    canonical += `${f}\n${value}\n`;
  }

  const algorithm = envelope.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
  try {
    const key = await signingKey(envelope.SigningCertURL);
    const verifier = createVerify(algorithm);
    verifier.update(canonical, "utf8");
    return verifier.verify(key, envelope.Signature, "base64");
  } catch {
    return false;
  }
}

/** Exposed for tests: seed the cache so no network fetch happens. */
export const _certCache = certCache;
