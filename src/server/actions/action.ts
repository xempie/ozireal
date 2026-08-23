import { z } from "zod";
import { auth } from "@/auth";
import { withTenant, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * The one way to write to the database.
 *
 * §13 says every Server Action input is Zod-validated. A rule like that survives
 * exactly as long as everyone remembers it, so this wrapper makes it structural: an
 * action cannot be defined without a schema, because the schema is an argument.
 *
 * Each call also:
 *   - refuses without a session, so a write cannot happen unauthenticated;
 *   - runs inside a transaction with `app.tenant_id` set, so row-level security applies
 *     and a mistake in the SQL cannot reach another tenant's rows;
 *   - writes an audit_log row, so who-did-what survives the request.
 *
 * Actions return a result rather than throwing, because the UI has to render the
 * failure. An uncaught throw in a Server Action reaches the user as a generic error
 * page, which tells them nothing about which field was wrong.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * A refusal the handler wrote deliberately, in words meant for the person reading it.
 *
 * Everything else that throws is unexpected, and `humanise` replaces those with a
 * generic line rather than leaking a stack trace or a constraint name into the
 * interface. Without this class those two cases are indistinguishable, so a careful
 * message like "that proposal was already handled" comes out as "something went
 * wrong" — which is both less useful and less true.
 */
export class ActionError extends Error {
  readonly expected = true;
}

export type ActionContext = {
  tx: Tx;
  tenantId: string;
  userId: string;
  userName: string;
  /**
   * Run something after the transaction commits — and only if it commits.
   *
   * Exists for job enqueues (B3): a job enqueued from inside the transaction can
   * race a rollback and run against rows that never existed. Callbacks are
   * best-effort by design; a failure is logged, never surfaced, because by then
   * the user's write has already durably succeeded.
   */
  afterCommit: (fn: () => Promise<unknown>) => void;
  /**
   * Record what just happened. Distinct from the interaction log: that records what
   * happened with a CONTACT, this records what a PERSON did to the system.
   */
  audit: (entry: {
    kind:
      | "approve"
      | "reject"
      | "edit"
      | "merge"
      | "publish"
      | "commit"
      | "login"
      | "block";
    action: string;
    target: string;
    entityType?: string;
    entityId?: string;
    metadata?: unknown;
  }) => Promise<void>;
};

export function defineAction<S extends z.ZodTypeAny, T>(config: {
  /** Every action has a schema. That is the point of this wrapper. */
  input: S;
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>;
}) {
  return async function run(raw: unknown): Promise<ActionResult<T>> {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return { ok: false, error: "You are signed out. Sign in and try again." };
    }

    const parsed = config.input.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return {
        ok: false,
        error: "Some fields need attention.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      };
    }

    const afterCommit: Array<() => Promise<unknown>> = [];
    try {
      const data = await withTenant(session.user.tenantId, async (tx) => {
        const ctx: ActionContext = {
          tx,
          tenantId: session.user.tenantId,
          userId: session.user.id,
          userName: session.user.name ?? session.user.email ?? "Unknown",
          afterCommit: (fn) => afterCommit.push(fn),
          audit: async (entry) => {
            await tx.insert(auditLog).values({
              tenantId: session.user.tenantId,
              actorUserId: session.user.id,
              actorLabel: session.user.name ?? "Unknown",
              kind: entry.kind,
              action: entry.action,
              target: entry.target,
              entityType: entry.entityType,
              entityId: entry.entityId,
              metadata: entry.metadata ?? null,
            });
          },
        };
        return config.handler(parsed.data, ctx);
      });

      // The transaction is committed; the callbacks run outside it, best-effort.
      for (const fn of afterCommit) {
        await fn().catch((e) =>
          console.error("[action] afterCommit callback failed:", e?.message ?? e),
        );
      }

      return { ok: true, data };
    } catch (e) {
      // A refusal the handler chose to phrase reaches the user as written.
      if (e instanceof ActionError) return { ok: false, error: e.message };

      const message = e instanceof Error ? e.message : String(e);

      /**
       * Database guards speak SQL, not English. A constraint firing is the system
       * working, so translate the ones a user can actually hit rather than leaking
       * "violates check constraint" into the interface.
       */
      return { ok: false, error: humanise(message) };
    }
  };
}

function humanise(message: string): string {
  const map: [RegExp, string][] = [
    [
      /append-only/i,
      "That record cannot be edited. Interactions and consents are append-only — record a correction as a new entry.",
    ],
    [
      /listings_live_needs_price_display/,
      "A live listing needs price wording. Write what buyers should see before publishing.",
    ],
    [
      /matches_reason_not_blank/,
      "A match needs a one-line reason. A bare score is not enough to act on.",
    ],
    [
      /approval_(blocked|rejected)_has_reason/,
      "That decision needs a stated reason, so the audit trail is complete.",
    ],
    [
      /evidence and cannot be deleted/i,
      "A message that was sent or blocked is evidence and cannot be deleted.",
    ],
    [
      /one_live_per_property/,
      "That property already has a live campaign. Withdraw it before starting another.",
    ],
    [
      /contacts_.*_idx|duplicate key/i,
      "That looks like a duplicate. Check the merge review queue.",
    ],
    [/row-level security/i, "You do not have access to that record."],
  ];

  for (const [pattern, friendly] of map) {
    if (pattern.test(message)) return friendly;
  }
  // Unmapped failures are genuinely unexpected; say so rather than pretending.
  return "Something went wrong and the change was not saved.";
}

/**
 * Normalisation moved to src/lib/normalise.ts when B3 gave it a second consumer (the
 * worker process, which must not import this file — it pulls in @/auth and Next).
 * Re-exported so B2-era imports keep working.
 */
export { toE164, normaliseEmail } from "@/lib/normalise";
