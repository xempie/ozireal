"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { defineAction, ActionError } from "./action";
import { suburbs } from "@/db/schema";
import { AU_STATES, stateFromPostcode } from "@/lib/postcode";

/**
 * Add a suburb that is not on the list yet, anywhere in Australia (owner's request,
 * 2026-11-13: stock can be interstate). The list was seeded with South Australia only;
 * a property needs a suburb record so matching can compare suburbs by record.
 */
export const addSuburb = defineAction({
  input: z.object({
    name: z.string().trim().min(2, "Type the suburb name").max(80),
    postcode: z.string().trim().regex(/^\d{4}$/, "Four-digit postcode"),
    state: z.enum(AU_STATES).optional(),
  }),
  async handler(input, ctx) {
    const state = input.state ?? stateFromPostcode(input.postcode);
    if (!state) throw new ActionError("That postcode is not an Australian one. Choose the state.");
    const name = input.name.replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const [row] = await ctx.tx
      .insert(suburbs)
      .values({ name, state, postcode: input.postcode })
      .onConflictDoUpdate({ target: [suburbs.name, suburbs.state, suburbs.postcode], set: { name } })
      .returning({ id: suburbs.id });
    revalidatePath("/properties");
    return { value: row.id, label: `${name}${state === "SA" ? "" : ` ${state}`} ${input.postcode}` };
  },
});
