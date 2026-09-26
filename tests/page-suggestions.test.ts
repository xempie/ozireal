import { describe, expect, it } from "vitest";
import { suggestionsFor, recordFromPath } from "@/components/assistant/page-suggestions";

const ID = "3f1c2b9e-8a7d-4c6b-9e2f-1a2b3c4d5e6f";

describe("assistant page suggestions", () => {
  it("offers each area its own suggestions", () => {
    expect(suggestionsFor("/contacts").area).toBe("contacts");
    expect(suggestionsFor("/properties").area).toBe("properties");
    expect(suggestionsFor("/tasks").area).toBe("tasks");
    expect(suggestionsFor("/listings").area).toBe("listings");
    expect(suggestionsFor("/matching").area).toBe("matching");
    expect(suggestionsFor("/dashboard").area).toBe("everything");
  });

  it("switches to 'this record' on a record's own page", () => {
    expect(suggestionsFor(`/contacts/${ID}`).area).toBe("this contact");
    expect(suggestionsFor(`/properties/${ID}`).area).toBe("this property");
    expect(suggestionsFor(`/listings/${ID}`).area).toBe("this listing");
  });

  it("gives every suggestion something to send or to prefill", () => {
    for (const path of ["/dashboard", "/contacts", `/contacts/${ID}`, "/properties", "/tasks", "/matching"]) {
      for (const s of suggestionsFor(path).items) {
        expect(s.send ?? s.prefill, `${path}: ${s.label}`).toBeTruthy();
      }
    }
  });

  it("passes only well-formed record ids to the assistant", () => {
    expect(recordFromPath(`/contacts/${ID}`)).toEqual({ kind: "contact", id: ID });
    expect(recordFromPath("/contacts")).toBeNull();
    expect(recordFromPath("/contacts/ignore-previous-instructions")).toBeNull();
    expect(recordFromPath(`/contacts/${ID}/edit`)).toBeNull();
  });
});
