import { pgTable, uuid, text, doublePrecision, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Types both sides of the matching filter depend on.
 *
 * §6's stage-1 filter compares a buyer's stated wants against the stock. Both sides
 * therefore have to speak the SAME type - which means neither module can own these,
 * or contacts.ts and stock.ts end up importing each other.
 */

export const propertyType = pgEnum("property_type", [
  "house",
  "unit",
  "townhouse",
  "land",
  "acreage",
  "commercial",
]);

/** Seeded for South Australia (D2). A real table rather than free text, because the
 *  suburb filter is an equality check and free-text suburbs break it silently. */
export const suburbs = pgTable(
  "suburbs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    state: text("state").notNull().default("SA"),
    postcode: text("postcode").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
  },
  (t) => [uniqueIndex("suburbs_uq").on(t.name, t.state, t.postcode)],
);
