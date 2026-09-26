import { z } from "zod";
import type { contactRole } from "@/db/schema";

export type ContactRole = (typeof contactRole.enumValues)[number];

/**
 * The channel adapter contract (CLAUDE.md §5).
 *
 * The brief is explicit: new input channels must be addable without touching core.
 * Everything an adapter knows about its wire format ends at `ingest` — beyond that
 * point there is one pipeline, and it does not know which channel it is serving.
 * If a new channel needs the pipeline edited, the abstraction has failed and the fix
 * belongs here, not there.
 */

export const CHANNELS = [
  "web_form",
  "email",
  "sms",
  "phone",
  "social",
  "portal",
  "manual",
] as const;
export type Channel = (typeof CHANNELS)[number];

/**
 * Who the message is from, as the channel saw it.
 *
 * Either the channel already knows the contact (manual entry happens on a contact's
 * screen), or it supplies raw identity fields for resolution. The two are mutually
 * exclusive on purpose: an adapter that could send both would invite the pipeline to
 * "check" one against the other, and identity decisions belong in one place.
 */
export type InboundIdentity =
  | { kind: "resolved"; contactId: string }
  | {
      kind: "claimed";
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
    };

/** Consent captured at the moment of submission. Reconstructable never (§10). */
export const consentCapture = z.object({
  channel: z.enum(["email", "sms", "phone"]),
  status: z.enum(["granted", "revoked"]),
  sourceForm: z.string().min(1),
  /** The exact text the person saw when they ticked the box. Not a template id —
   *  templates get edited, and the defence is what was ON SCREEN at the time. */
  wordingShown: z.string().min(1),
  ipAddress: z.string().nullable(),
});
export type ConsentCapture = z.infer<typeof consentCapture>;

/**
 * What every adapter normalises to. The pipeline consumes this and nothing else.
 */
export interface NormalisedInteraction {
  channel: Channel;
  direction: "in" | "out";
  /** When it happened on the wire, which is not when we processed it. */
  occurredAt: Date;
  subject: string | null;
  body: string;
  identity: InboundIdentity;
  /**
   * The transport's own id for this message — MIME Message-ID, an SNS message id, a
   * form nonce. The replay-dedupe index keys on it, so the same delivery arriving
   * twice becomes one interaction. Null only for channels with no transport identity
   * (a phone call), which therefore cannot be deduplicated and should not pretend.
   */
  messageId: string | null;
  threadRef: string | null;
  /** Where the raw original lives, if it was preserved (S3 key for email MIME). */
  rawS3Key: string | null;
  listingRef: string | null;
  consents: ConsentCapture[];
  /**
   * What this message says the person IS — a rental enquiry makes them a tenant. Added
   * to the resolved contact, new or existing, since one person accumulates roles (§4).
   * Omitted by channels that cannot tell; a new contact from one of those falls back
   * to buyer. An empty array means "this channel looked and found no role".
   */
  roles?: ContactRole[];
  /**
   * The signed-in user who typed it, when a human did (manual entry). Headless
   * channels leave it null. Set by the caller that owns the session, never by an
   * adapter — an adapter has no business knowing who is logged in.
   */
  recordedByUserId?: string | null;
}

export interface SendResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface OutboundPayload {
  subject?: string;
  body: string;
}

export interface ChannelAdapter {
  id: Channel;
  /**
   * Wire format → NormalisedInteraction. Throwing here means the payload was not
   * parseable AT ALL; a parseable message with junk fields still normalises (junk
   * identity resolves to a new contact — losing the enquiry is the one failure the
   * intake is not allowed to have).
   */
  ingest(raw: unknown): Promise<NormalisedInteraction>;
  canReply: boolean;
  send?(contactId: string, payload: OutboundPayload): Promise<SendResult>;
}

/* ----------------------------------------------------------------- registry */

const registry = new Map<Channel, ChannelAdapter>();

/** Adding a channel means adding one class and calling this. Nothing else. */
export function registerAdapter(adapter: ChannelAdapter): void {
  if (registry.has(adapter.id)) {
    throw new Error(`Adapter '${adapter.id}' is already registered.`);
  }
  registry.set(adapter.id, adapter);
}

export function getAdapter(id: Channel): ChannelAdapter {
  const adapter = registry.get(id);
  if (!adapter) {
    throw new Error(
      `No adapter registered for channel '${id}'. Registered: ${[...registry.keys()].join(", ") || "none"}.`,
    );
  }
  return adapter;
}

export function registeredChannels(): Channel[] {
  return [...registry.keys()];
}
