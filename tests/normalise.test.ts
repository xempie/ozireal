import { describe, it, expect } from "vitest";
import {
  toE164,
  normaliseEmail,
  isAuMobile,
  compareNames,
} from "@/lib/normalise";

/**
 * Normalisation is where identity resolution is won or lost (§4): every one of
 * these lines is a way the same person could have become two records, or two
 * strangers one. The cases come from docs/research/b3-identity-cases.json — a
 * generated table that was then adversarially reviewed; the review's misses are
 * folded in here too.
 */

describe("toE164", () => {
  const same = [
    ["0412 345 678", "+61412345678", "national with spaces"],
    ["+61412345678", "+61412345678", "already E.164"],
    ["61412345678", "+61412345678", "country code without plus"],
    ["(04) 1234-5678", "+61412345678", "parenthesised and hyphenated"],
    ["0412 345 678 (work)", "+61412345678", "human annotation"],
    ["+61 (0) 412 345 678", "+61412345678", "trunk zero kept in parentheses"],
    ["08 8123 4567", "+61881234567", "landline national"],
    ["+61 8 8123 4567", "+61881234567", "landline international"],
    ["+44 7911 123456", "+447911123456", "foreign number kept intact"],
  ] as const;

  for (const [input, expected, label] of same) {
    it(`${label}: '${input}' → ${expected}`, () => {
      expect(toE164(input)).toBe(expected);
    });
  }

  const refused = [
    ["call me", "no digits at all"],
    ["call me after 5", "one stray digit"],
    ["8123 4567", "local number with no area code — completing it means guessing"],
    ["0412 345", "too short to be a national number"],
    ["04123456789", "too long to be one"],
    ["612345678", "61-prefixed but wrong length"],
    ["+61", "country code alone"],
    ["", "empty"],
    [null, "null"],
  ] as const;

  for (const [input, label] of refused) {
    it(`refuses ${label}: '${input}' → null`, () => {
      expect(toE164(input as string | null)).toBeNull();
    });
  }

  it("never fabricates a key (the pre-B3 bug: '8123 4567' became '+6181234567')", () => {
    // A fabricated key is worse than none — it silently cross-links strangers.
    expect(toE164("8123 4567")).not.toBe("+6181234567");
  });
});

describe("isAuMobile", () => {
  it("classifies 04-mobiles as personal keys", () => {
    expect(isAuMobile("+61412345678")).toBe(true);
  });
  it("classifies landlines as household keys", () => {
    expect(isAuMobile("+61881234567")).toBe(false);
  });
  it("does not classify foreign numbers", () => {
    expect(isAuMobile("+447911123456")).toBe(false);
  });
});

describe("normaliseEmail", () => {
  const same = [
    ["jane+realestate@example.com", "jane@example.com", "plus-addressing stripped"],
    ["JANE@Example.COM", "jane@example.com", "case folded"],
    ["jane@example.com. ", "jane@example.com", "trailing space and DNS root dot"],
    ["john.smith@gmail.com", "johnsmith@gmail.com", "gmail dots collapse"],
    ["john.smith@googlemail.com", "johnsmith@googlemail.com", "googlemail dots collapse"],
  ] as const;

  for (const [input, expected, label] of same) {
    it(`${label}: '${input}' → ${expected}`, () => {
      expect(normaliseEmail(input)).toBe(expected);
    });
  }

  it("does NOT collapse dots outside Gmail — two dotted locals at an ISP can be two people", () => {
    expect(normaliseEmail("john.smith@bigpond.com")).toBe("john.smith@bigpond.com");
  });

  const junk = [
    ["not-an-email", "no @ at all"],
    ["@example.com", "no local part"],
    ["jane@", "no domain"],
    ["jane@localhost", "domain without a dot"],
    ["   ", "whitespace"],
    [null, "null"],
  ] as const;

  for (const [input, label] of junk) {
    it(`refuses ${label}: '${input}' → null`, () => {
      expect(normaliseEmail(input as string | null)).toBeNull();
    });
  }
});

describe("compareNames — corroboration only, never a key", () => {
  it("identical names agree", () => {
    expect(compareNames("Jane", "Citizen", "Jane", "Citizen")).toBe("agrees");
  });
  it("a prefix corroborates: Sam / Samantha", () => {
    expect(compareNames("Sam", "Whitfield", "Samantha", "Whitfield")).toBe("agrees");
  });
  it("whitespace and case differences do not conflict", () => {
    expect(compareNames("  jane ", "CITIZEN", "Jane", "Citizen")).toBe("agrees");
  });
  it("NFC and NFD spellings of the same name agree", () => {
    // 'Zoë' composed vs decomposed — byte-different, visually identical.
    expect(compareNames("Zoë", "Renée", "Zoë", "Renée")).toBe("agrees");
  });
  it("both names differing is a conflict — the family-mailbox pattern", () => {
    expect(compareNames("Bruce", "Chen", "Annette", "D'Souza")).toBe("conflicts");
  });
  it("same surname with a different first name is partial, not a conflict", () => {
    expect(compareNames("Meera", "Patel", "Raj", "Patel")).toBe("partial");
  });
  it("a true diminutive is partial (no nickname table, on purpose)", () => {
    expect(compareNames("Dave", "Smith", "David", "Smith")).toBe("partial");
  });
  it("a missing name on either side is unknown — neither corroborates nor conflicts", () => {
    expect(compareNames(null, null, "Jane", "Citizen")).toBe("unknown");
    expect(compareNames("Jane", "Citizen", "", "")).toBe("unknown");
  });
});
