import { describe, expect, it } from "vitest";
import {
  parseImportJson,
  importProperty,
  formatAddress,
} from "@/server/import/property-import-schema";

const devon = {
  unit: "1",
  streetNumber: "17",
  street: "Devon Drive",
  suburb: "Salisbury",
  postcode: "5108",
  state: "SA",
  propertyType: "Apartment",
  beds: 2,
  baths: 1,
  parking: 1,
  sourceRef: 3,
  owner: { name: "Hassan Varasi (1/17 DEVON)", phone: "0438 371 208" },
  tenants: [
    { name: "Najibullah Karimi", phone: "0418 117 748" },
    { name: "Ezatullah Eh..." },
  ],
  // Management-system data the importer must ignore, not refuse.
  rent: "$840.00 Fortnightly",
  arrears: 840,
};

describe("property import schema", () => {
  it("accepts an object with a properties array, or a bare array", () => {
    const a = parseImportJson(JSON.stringify({ properties: [devon] }));
    const b = parseImportJson(JSON.stringify([devon]));
    expect(a.ok && b.ok).toBe(true);
  });

  it("normalises what exports say into what the schema holds", () => {
    const r = parseImportJson(JSON.stringify([devon]));
    if (!r.ok) throw new Error(r.error);
    const p = r.properties[0];
    expect(p.propertyType).toBe("unit"); // apartment -> unit
    expect(p.sourceRef).toBe("3"); // numbers become strings
    expect(p.owner?.name).toBe("Hassan Varasi"); // system label dropped
    expect(p.tenants.map((t) => t.name)).toEqual(["Najibullah Karimi", "Ezatullah Eh"]);
    expect(p.tenants[1].phone).toBeNull(); // never borrowed from the other tenant
    expect(p).not.toHaveProperty("rent");
    expect(p).not.toHaveProperty("arrears");
  });

  it("refuses a type it does not recognise rather than guessing", () => {
    const r = parseImportJson(JSON.stringify([{ ...devon, propertyType: "castle" }]));
    expect(r.ok).toBe(false);
  });

  it("refuses invalid JSON and an empty list with a sentence", () => {
    const bad = parseImportJson("{not json");
    expect(bad.ok).toBe(false);
    const empty = parseImportJson("[]");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/no properties/i);
  });

  it("formats unit addresses the way the rest of the app does", () => {
    const p = importProperty.parse(devon);
    expect(formatAddress(p)).toBe("1/17 Devon Drive");
    expect(formatAddress({ ...p, unit: null })).toBe("17 Devon Drive");
  });
});
