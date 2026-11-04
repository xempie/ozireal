import { describe, expect, it } from "vitest";
import { detectAddressKind, kindFromHeading, kindFromValue } from "@/lib/address-kind";

describe("address kind", () => {
  it("reads street addresses as where someone lives", () => {
    for (const a of [
      "12 Smith St, Norwood SA 5067",
      "Unit 3/40 King William Rd, Wayville, SA 5034",
      "3/40 King William Road Wayville",
      "12A Jetty Road, Glenelg",
      "Lot 7 Main North Rd, Elizabeth",
      "PO Box 123, Prospect SA 5082",
    ]) expect(kindFromValue(a), a).toBe("lives");
  });

  it("reads lists of suburbs and postcodes as where someone is looking", () => {
    for (const a of ["Norwood, Kensington 5068", "5067 / Prospect", "Glenelg", "Northern suburbs", "Prospect or Walkerville"])
      expect(kindFromValue(a), a).toBe("looking");
  });

  it("lets the heading decide when it says", () => {
    expect(kindFromHeading("Looking in")).toBe("looking");
    expect(kindFromHeading("Preferred suburbs")).toBe("looking");
    expect(kindFromHeading("Home Address")).toBe("lives");
    expect(kindFromHeading("Address")).toBeNull();
    expect(detectAddressKind("Area of interest", "12 Smith St, Norwood")).toBe("looking");
    expect(detectAddressKind("Address", "Norwood, Prospect")).toBe("looking");
  });
});
