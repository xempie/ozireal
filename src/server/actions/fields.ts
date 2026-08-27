import { z } from "zod";

/**
 * Field shapes shared by the create forms.
 *
 * These exist because of one specific hazard. An empty <input type="number">
 * submits the string "", and z.coerce.number() turns "" into 0 — so a blank
 * bedroom count is stored as the CLAIM "no bedrooms" rather than "not recorded",
 * and a blank price estimate becomes "$0 – $0" on a document that goes to a
 * vendor. Zero and unknown are different facts, and the database has a null for
 * exactly that reason.
 *
 * It also breaks guards written against undefined: a "give me both figures or
 * neither" check never fires when the missing half arrives as 0.
 */

/** An optional whole number, where blank means absent rather than zero. */
export function optionalInt(
  min: number,
  max: number,
  message = "Whole numbers only",
) {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int(message).min(min).max(max).optional(),
  );
}

/** A select or picker that may legitimately be left on "none". */
export const optionalUuid = z.union([z.string().uuid(), z.literal("")]).optional();
