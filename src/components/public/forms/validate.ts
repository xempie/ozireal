import { toE164 } from "@/lib/normalise";
import type { FormField } from "./definitions";

/**
 * Input validation for every public form, run in the browser before submit. The route
 * re-checks email and phone with the same rules (web-form.ts), so a script that skips
 * the browser gets the same answer.
 *
 * Phone acceptance is exactly what `toE164` can turn into a dedupe key: Australian
 * mobiles and landlines with the area code, or an international number with its
 * country code. A number we could not normalise would never match the person again.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

export const isValidEmail = (v: string) => v.length <= 254 && EMAIL_RE.test(v.trim());
export const isValidPhone = (v: string) => toE164(v) !== null;

export const EMAIL_MESSAGE = "Enter a valid email address, like name@example.com.";
export const PHONE_MESSAGE =
  "Enter a valid phone number, like 0412 345 678, or include the country code (+44 …).";

const NAME_RE = /^[\p{L}][\p{L}\p{M}'’ .-]*$/u;

/** Limits for free text. Generous enough for an address or a paragraph, no more. */
const MAX = { name: 60, text: 200, textarea: 2000 } as const;

export function validateField(f: FormField, value: string | string[] | undefined): string | null {
  const list = Array.isArray(value) ? value : null;
  const text = list ? "" : (value ?? "").toString().trim();
  const empty = list ? list.length === 0 : text === "";

  if (empty) return f.required ? `${f.label} is required.` : null;

  switch (f.kind) {
    case "email":
      return isValidEmail(text) ? null : EMAIL_MESSAGE;

    case "tel":
      return isValidPhone(text) ? null : PHONE_MESSAGE;

    case "radio":
    case "select":
      return f.options?.includes(text) ? null : `Choose one of the options for ${f.label}.`;

    case "checkbox":
      return list && list.every((o) => f.options?.includes(o))
        ? null
        : `Choose from the options for ${f.label}.`;

    case "date": {
      const d = new Date(text + "T00:00:00");
      if (Number.isNaN(d.getTime())) return "Enter a valid date.";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d < today ? "Choose today or a future date." : null;
    }

    case "textarea":
      if (text.length < 2) return `${f.label} is too short.`;
      return text.length > MAX.textarea
        ? `Keep ${f.label} under ${MAX.textarea} characters.`
        : null;

    case "text": {
      if (f.id === "firstName" || f.id === "lastName") {
        if (text.length > MAX.name) return `Keep ${f.label} under ${MAX.name} characters.`;
        return NAME_RE.test(text) ? null : `${f.label} can only contain letters, spaces, hyphens and apostrophes.`;
      }
      if (f.id === "postcode") {
        return /^\d{4}$/.test(text) ? null : "Enter a 4-digit postcode.";
      }
      if (text.length < 2) return `${f.label} is too short.`;
      return text.length > MAX.text ? `Keep ${f.label} under ${MAX.text} characters.` : null;
    }
  }
  return null;
}

/** Every field's first problem, keyed by field id. Empty when the form is valid. */
export function validateForm(
  fields: FormField[],
  values: Record<string, string | string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const f of fields) {
    const err = validateField(f, values[f.id]);
    if (err) out[f.id] = [err];
  }
  return out;
}
