import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Prompts are versioned FILES under /prompts, never inline strings (B4.3, §9).
 *
 * The version is in the filename, so changing instructions means a NEW file and a
 * one-line change at the call site — the diff shows exactly what changed and when,
 * and the ledger's prompt hash ties every generation to the version that produced
 * it. Editing v1 in place would silently re-mean every historical hash.
 *
 * Files support {{placeholder}} substitution and nothing fancier. If a prompt needs
 * logic, the logic belongs in the handler building the placeholder values.
 */

const cache = new Map<string, string>();

export function loadPrompt(versionedName: string): { text: string; version: string } {
  let text = cache.get(versionedName);
  if (!text) {
    text = readFileSync(join(process.cwd(), "prompts", `${versionedName}.md`), "utf8");
    cache.set(versionedName, text);
  }
  return { text, version: versionedName };
}

export function fillPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = values[key];
    if (v === undefined) {
      throw new Error(`Prompt placeholder {{${key}}} has no value.`);
    }
    return v;
  });
}
