import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

/**
 * Password hashing.
 *
 * The claims worth testing are about what the hash does NOT reveal and does NOT
 * accept — a hash that verifies the right password is easy; one that refuses
 * everything else, and that cannot be reversed from the stored string, is the point.
 */

describe("hashing", () => {
  it("verifies the correct password", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("correct horse battery staple", h)).toBe(true);
  });

  it("refuses a wrong password", async () => {
    const h = await hashPassword("correct horse battery staple");
    expect(await verifyPassword("Correct horse battery staple", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
  });

  it("never stores the plaintext", async () => {
    const h = await hashPassword("hunter2-hunter2-hunter2");
    expect(h).not.toContain("hunter2");
  });

  it("salts per hash, so identical passwords differ on disk", async () => {
    const a = await hashPassword("the same passphrase here");
    const b = await hashPassword("the same passphrase here");
    // Without a per-user salt, one cracked hash cracks every account that
    // happened to choose the same password.
    expect(a).not.toBe(b);
    expect(await verifyPassword("the same passphrase here", a)).toBe(true);
    expect(await verifyPassword("the same passphrase here", b)).toBe(true);
  });

  it("records its cost parameters, so they can be raised later", async () => {
    const h = await hashPassword("a sufficiently long passphrase");
    const [scheme, n, r, p] = h.split("$");
    expect(scheme).toBe("scrypt");
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThan(0);
    expect(Number(p)).toBeGreaterThan(0);
  });

  it("refuses a password too short to be worth hashing", async () => {
    await expect(hashPassword("short")).rejects.toThrow(/12 characters/);
  });

  it("returns false rather than throwing on a malformed stored value", async () => {
    // An auth path must fail identically however it fails.
    expect(await verifyPassword("anything", "")).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
    expect(await verifyPassword("anything", "bcrypt$1$2$3$4")).toBe(false);
  });

  it("treats unicode-equivalent passwords as the same", async () => {
    // NFKC: the same characters typed on a different keyboard must still match.
    const composed = "café passphrase 123";
    const decomposed = "café passphrase 123";
    const h = await hashPassword(composed);
    expect(await verifyPassword(decomposed, h)).toBe(true);
  });
});
