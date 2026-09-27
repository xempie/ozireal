import { sql } from "drizzle-orm";
import type { Tx } from "@/db";
import { suburbs } from "@/db/schema";

/**
 * "Did you mean Newton (5074)?" for a suburb name the list does not know.
 *
 * With the full SA list loaded (migration 0016) a correctly spelt name always resolves,
 * so what is left is typos: "Newtown", "Maggil", "Norwod". Edit distance over the
 * suburbs sharing the first letter is plenty for ~1,900 names and needs no database
 * extension. Returned as text for a refusal message; it never picks for the person.
 */

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

export async function suggestSuburbs(
  tx: Tx,
  typed: string,
  limit = 3,
): Promise<{ name: string; postcode: string }[]> {
  const t = typed.trim().toLowerCase();
  if (t.length < 3) return [];
  const rows = await tx
    .select({ name: suburbs.name, postcode: suburbs.postcode })
    .from(suburbs)
    .where(sql`lower(left(${suburbs.name}, 1)) = ${t[0]}`);
  // A typo budget that grows with length: 1 for short names, up to 3 for long ones.
  const budget = Math.min(3, Math.max(1, Math.floor(t.length / 4)));
  return rows
    .map((r) => ({ ...r, d: editDistance(t, r.name.toLowerCase()) }))
    .filter((r) => r.d <= budget)
    .sort((a, b) => a.d - b.d || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, postcode }) => ({ name, postcode }));
}

/** " (did you mean Newton 5074 or Newtown 5xxx?)", or "" when nothing is close. */
export async function didYouMean(tx: Tx, typed: string): Promise<string> {
  const s = await suggestSuburbs(tx, typed);
  if (!s.length) return "";
  return ` (did you mean ${s.map((x) => `${x.name} ${x.postcode}`).join(" or ")}?)`;
}
