/**
 * Identity normalisation.
 *
 * Dedupe is only as good as the normalisation behind it (§4): every record write and
 * every resolver lookup MUST go through these two functions, or the same person
 * typed two ways becomes two people. Pure on purpose — the BullMQ worker imports this
 * without dragging Next.js along.
 */

/**
 * Australian-centric phone → E.164, or null when the input cannot be read as a
 * complete number.
 *
 * Null is a considered answer, not a failure: a key we would have to GUESS at (an
 * 8-digit local number with no area code could be any state) must match nothing,
 * because a fabricated key silently cross-links two strangers' records. 'call me
 * after 5' has no digits to offer; it resolves like the field was empty.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  // '+' is only meaningful at the front ('0412+work' is annotation, not a code).
  digits = digits[0] === "+" ? "+" + digits.slice(1).replace(/\+/g, "") : digits.replace(/\+/g, "");

  if (digits.startsWith("+")) {
    // The very common written form '+61 (0) 412 345 678' keeps the trunk zero in
    // parentheses. Dropping non-digits first turns it into +610412... — strip the
    // zero, or every such enquiry becomes a silent duplicate.
    if (digits.startsWith("+610")) digits = "+61" + digits.slice(4);
    const rest = digits.slice(1);
    // E.164: digits only, up to 15. Under 8 is not a routable number anywhere.
    if (!/^\d{8,15}$/.test(rest)) return null;
    if (rest.startsWith("61") && rest.length !== 11) return null;
    return digits;
  }

  // National form: trunk zero + 9 digits (04xx mobiles, 08 etc. landlines).
  if (digits.startsWith("0")) {
    return digits.length === 10 ? `+61${digits.slice(1)}` : null;
  }

  // Country code typed without '+' (portal feeds, copy-paste).
  if (digits.startsWith("61")) {
    return digits.length === 11 ? `+${digits}` : null;
  }

  // Anything else — an 8-digit local number, a short code — needs a guess we refuse
  // to make. (The pre-B3 version prefixed +61 here and fabricated keys.)
  return null;
}

/** True when an E.164 number is an Australian mobile — a personal key. A landline
 *  is a household key, and the resolver trusts it less. */
export function isAuMobile(e164: string | null): boolean {
  return !!e164 && /^\+614\d{8}$/.test(e164);
}

/**
 * Email → the form deduplication compares on, or null.
 *
 * Lower-cased; plus-addressing stripped everywhere (jane+re@x is jane@x); a trailing
 * domain dot is the DNS root label and denotes the same mailbox; dots in the local
 * part are collapsed ONLY for Gmail's domains, where Google documents they are
 * ignored. Everywhere else RFC 5321 makes the local part opaque — j.smith and jsmith
 * at an ISP can be two real strangers, and guessing otherwise cross-links them.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) return null;
  let local = trimmed.slice(0, at).split("+")[0];
  const domain = trimmed.slice(at + 1).replace(/\.+$/, "");
  if (!local || !domain || !domain.includes(".")) return null;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
  }
  return `${local}@${domain}`;
}

/**
 * Name comparison for CORROBORATION, never for matching. A name can strengthen or
 * undermine a key match; it can never create one (§4: same name only is demographic
 * coincidence).
 */
export function normaliseName(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export type NameComparison = "agrees" | "partial" | "conflicts" | "unknown";

export function compareNames(
  aFirst: string | null | undefined,
  aLast: string | null | undefined,
  bFirst: string | null | undefined,
  bLast: string | null | undefined,
): NameComparison {
  const af = normaliseName(aFirst);
  const al = normaliseName(aLast);
  const bf = normaliseName(bFirst);
  const bl = normaliseName(bLast);

  // Nothing to compare is not agreement and not conflict.
  if ((!af && !al) || (!bf && !bl)) return "unknown";

  const lastSame = !!al && al === bl;
  // 'Sam' corroborates 'Samantha': equality or a ≥3-char prefix either way. True
  // diminutives ('Dave'/'David') deliberately do NOT match — that needs a nickname
  // table, and until one earns its place the safe answer is "partial", which is
  // still enough for a personal key and sends a household key to review.
  const firstSame =
    !!af &&
    !!bf &&
    (af === bf ||
      (af.length >= 3 && bf.startsWith(af)) ||
      (bf.length >= 3 && af.startsWith(bf)));

  if (lastSame && (firstSame || !af || !bf)) return "agrees";
  if (!lastSame && al && bl && !firstSame && af && bf) return "conflicts";
  return "partial";
}
