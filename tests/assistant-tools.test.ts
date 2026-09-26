import { describe, expect, it } from "vitest";
import { TOOLS, TOOL_DEFINITIONS } from "@/server/assistant/tools";

/**
 * The assistant's tool list is where rules 1 and 5 become mechanical, so its shape is
 * pinned here: nothing that sends, publishes, deletes or merges exists at all, and every
 * tool that changes data is a `write`, which the turn loop never executes itself.
 */
describe("assistant tools", () => {
  it("has no tool that sends, publishes, deletes or merges", () => {
    for (const name of Object.keys(TOOLS)) {
      expect(name).not.toMatch(/send|publish|delete|remove|merge|unsubscribe|approve/);
    }
  });

  it("touches consent only through record_consent, which always asks first", () => {
    const consentTools = Object.keys(TOOLS).filter((n) => /consent/.test(n));
    expect(consentTools).toEqual(["record_consent"]);
    expect(TOOLS.record_consent.kind).toBe("write");
  });

  it("marks every tool that changes data as a write", () => {
    const changing = /^(create|update|log|record|complete|run|draft)_/;
    for (const [name, spec] of Object.entries(TOOLS)) {
      expect(spec.kind, name).toBe(changing.test(name) ? "write" : "read");
    }
  });

  it("gives the model an object schema for every tool and flags the writes", () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.input_schema.type, def.name).toBe("object");
      expect(def.input_schema).not.toHaveProperty("$schema");
      const kind = TOOLS[def.name as keyof typeof TOOLS].kind;
      expect(def.description.startsWith("[Asks the user to confirm first]"), def.name).toBe(kind === "write");
    }
  });

  it("refuses a write with a missing required field before it can become a card", () => {
    const r = TOOLS.create_task.schema.safeParse({ title: "x" });
    expect(r.success).toBe(false);
  });
});
