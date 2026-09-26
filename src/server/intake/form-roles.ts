import { FORMS, type ContactRole } from "@/components/public/forms/definitions";

/**
 * Which role(s) a website enquiry puts on the contact.
 *
 * Decided here, from the form's own definition looked up by name, and never taken from
 * the request: the envelope is public, and a role chosen by the browser would let anyone
 * file themselves as whatever they liked. The formName is the only input trusted, and
 * an unknown one yields no role rather than a guess.
 *
 * For the general-purpose forms the role is an answer, which reaches us inside the
 * composed message as a "Label: option, option" line (enquiry-form.tsx composeMessage).
 * Only options present in the definition's map count, so free text cannot add a role.
 */
export function rolesForSubmission(formName: string, message: string): ContactRole[] {
  const def = FORMS.find((f) => f.formName === formName);
  if (!def) return [];

  const roles = new Set<ContactRole>(def.roles);

  if (def.roleFrom) {
    const field = def.fields.find((f) => f.id === def.roleFrom!.field);
    const prefix = field ? `${field.label}: ` : null;
    const line = prefix ? message.split("\n").find((l) => l.startsWith(prefix)) : undefined;
    if (line && prefix) {
      for (const answer of line.slice(prefix.length).split(",")) {
        const role = def.roleFrom.map[answer.trim()];
        if (role) roles.add(role);
      }
    }
  }

  return [...roles];
}
