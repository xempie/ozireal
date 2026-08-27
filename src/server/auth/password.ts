import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * promisify picks the 3-argument overload, which drops the cost parameters
 * silently — the hash would still verify, at default cost, which is the worst
 * kind of wrong. Typed explicitly so the options are not optional.
 */
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Password hashing for the production sign-in.
 *
 * scrypt rather than a plain digest, because the threat is a stolen hash being
 * cracked offline: SHA-256 lets an attacker try billions of candidates a second,
 * scrypt is deliberately slow AND memory-hard so the same hardware manages
 * thousands. The cost parameters are stored in the hash string, so raising them
 * later re-hashes on next sign-in instead of invalidating everyone.
 *
 * Format: scrypt$N$r$p$salt$hash — every field base64, nothing implicit.
 */

// N=2^16 costs roughly 100ms and ~64MB per verification here. Slow enough to
// matter to an attacker, fast enough that one person signing in never notices.
const N = 65536;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length < 12) {
    throw new Error("A password needs at least 12 characters.");
  }
  const salt = randomBytes(16);
  const derived = await scrypt(plain.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: 256 * 1024 * 1024,
  });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify. Returns false for anything malformed rather than throwing, because
 * the caller is an auth path and every failure there should look identical.
 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const derived = await scrypt(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 256 * 1024 * 1024,
    });

    // Constant time: a fast reject on the first differing byte tells an attacker
    // how much of a candidate was right.
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Lockout policy.
 *
 * Ten attempts then fifteen minutes. Deliberately not three-and-forever: this is
 * a single-office CRM with no help desk, and a permanent lock on a fat-fingered
 * password is an outage the agency cannot fix themselves at 8am. Fifteen minutes
 * makes online guessing useless while staying self-healing.
 */
export const MAX_ATTEMPTS = 10;
export const LOCKOUT_MINUTES = 15;

export function lockoutUntil(): Date {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
}
