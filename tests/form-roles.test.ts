import { describe, expect, it } from "vitest";
import { FORMS } from "@/components/public/forms/definitions";
import { rolesForSubmission } from "@/server/intake/form-roles";

describe("rolesForSubmission", () => {
  it("gives each single-purpose form its own role", () => {
    expect(rolesForSubmission("Rental enquiry", "")).toEqual(["tenant"]);
    expect(rolesForSubmission("Rent out my property enquiry", "")).toEqual(["landlord"]);
    expect(rolesForSubmission("Sell my property enquiry", "")).toEqual(["vendor"]);
    expect(rolesForSubmission("Buyer agent enquiry", "")).toEqual(["buyer"]);
    expect(rolesForSubmission("Sell my business enquiry", "")).toEqual(["business_vendor"]);
    expect(rolesForSubmission("Dubai investment register", "")).toEqual(["investor"]);
  });

  it("reads the role from the answer on general-purpose forms", () => {
    const msg = "Send us a message (Website enquiry)\n\nWhat is it about?: Renting\nYour message: hi";
    expect(rolesForSubmission("Website enquiry", msg)).toEqual(["tenant"]);

    const multi = "x\n\nWhat do you need help with?: Selling, Buying\nTell us about it: y";
    expect(rolesForSubmission("General enquiry", multi).sort()).toEqual(["buyer", "vendor"]);

    const appraisal = "x\n\nWhat do you want to do?: Considering selling";
    expect(rolesForSubmission("Free property appraisal", appraisal)).toEqual(["vendor"]);
  });

  it("adds nothing for 'Something else', free text, or an unknown form", () => {
    expect(rolesForSubmission("Website enquiry", "What is it about?: Something else")).toEqual([]);
    // A role word typed into a free-text field must not count.
    expect(rolesForSubmission("Website enquiry", "Your message: Renting")).toEqual([]);
    expect(rolesForSubmission("Made up form", "What is it about?: Buying")).toEqual([]);
  });

  it("maps every option of every role-deciding field", () => {
    for (const def of FORMS) {
      if (!def.roleFrom) continue;
      const field = def.fields.find((f) => f.id === def.roleFrom!.field);
      expect(field, `${def.formName}: roleFrom field exists`).toBeDefined();
      const unmapped = (field!.options ?? []).filter(
        (o) => !(o in def.roleFrom!.map) && o !== "Something else",
      );
      expect(unmapped, `${def.formName}: options with no role`).toEqual([]);
    }
  });
});
