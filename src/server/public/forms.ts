import { sql } from "drizzle-orm";
import { publicQuery } from "./tenant";

/**
 * The tenant's public form key.
 *
 * ## Why exposing this is not a widening of rule 8
 *
 * `form_key` is the address of `/api/forms/[key]`, and that endpoint is unauthenticated
 * by design: the whole world may POST to it. The key exists so that the *tenant id* is
 * never the address, which is why the route looks tenants up by it rather than by id.
 * A browser has to know it to submit an enquiry at all, so it appears in the page source
 * of every form on the live internet no matter how it gets there.
 *
 * What it is not: a credential. Knowing it lets somebody submit an enquiry, which is what
 * the form is for. The defences that matter live on the route (signed token pinned to the
 * consent wording, single-use nonce, honeypot, rate limit, size caps), not on the secrecy
 * of this value.
 *
 * It is still fetched through `publicQuery`, so RLS applies and the projection names its
 * one column, because the rule is that public pages read through a named projection or
 * not at all.
 */

let cached: string | null = null;

export async function publicFormKey(): Promise<string> {
  if (cached) return cached;

  const rows = await publicQuery((tx) =>
    tx.execute<{ form_key: string }>(sql`select form_key from tenants limit 1`),
  );
  const key = rows[0]?.form_key;
  if (!key) {
    /**
     * Loud rather than a form that renders and fails on submit. A missing form key is a
     * misconfiguration, and the failure it would otherwise cause is the worst kind: the
     * visitor fills the form, presses send, and the enquiry goes nowhere.
     */
    throw new Error("No tenant form_key, so the public forms cannot address the intake endpoint.");
  }
  cached = key;
  return key;
}
