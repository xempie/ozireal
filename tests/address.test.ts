import { describe, expect, it } from "vitest";
import { streetKey } from "@/lib/address";

describe("streetKey", () => {
  it("treats a street-type abbreviation as the full word", () => {
    expect(streetKey("Omer St")).toBe(streetKey("Omer Street"));
    expect(streetKey("Waterfall Tce")).toBe(streetKey("Waterfall Terrace"));
    expect(streetKey("Devon Dr.")).toBe(streetKey("devon drive"));
    expect(streetKey("  Prospect   Rd ")).toBe("prospect road");
  });

  it("only expands the last word, so names are left alone", () => {
    // "St" at the start is Saint, not Street.
    expect(streetKey("St Bernards Rd")).toBe("st bernards road");
    expect(streetKey("Omer St")).not.toBe(streetKey("Omer Road"));
  });

  it("does not expand a one-word street", () => {
    expect(streetKey("Esplanade")).toBe("esplanade");
  });
});
