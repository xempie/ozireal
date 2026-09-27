import { describe, expect, it } from "vitest";
import { editDistance } from "@/server/suburbs/suggest";

describe("editDistance (suburb suggestions)", () => {
  it("counts the typos people actually make", () => {
    expect(editDistance("newtown", "newton")).toBe(1);
    expect(editDistance("maggil", "magill")).toBe(2);
    expect(editDistance("norwod", "norwood")).toBe(1);
    expect(editDistance("magill", "magill")).toBe(0);
  });

  it("keeps unrelated names far apart", () => {
    expect(editDistance("norwood", "salisbury")).toBeGreaterThan(3);
  });
});
