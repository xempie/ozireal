import { desc, eq } from "drizzle-orm";
import { query } from "@/db";
import { buildingChecks, properties, suburbs } from "@/db/schema";
import type { CheckResult } from "@/server/building-check/run";

/** Building checks (0023), newest first, with the property they belong to if any. */

const columns = {
  id: buildingChecks.id,
  propertyId: buildingChecks.propertyId,
  label: buildingChecks.label,
  context: buildingChecks.context,
  notes: buildingChecks.notes,
  photos: buildingChecks.photos,
  status: buildingChecks.status,
  result: buildingChecks.result,
  error: buildingChecks.error,
  createdAt: buildingChecks.createdAt,
  completedAt: buildingChecks.completedAt,
  street: properties.street,
  streetNumber: properties.streetNumber,
  suburb: suburbs.name,
};

type Raw = Awaited<ReturnType<typeof base>>[number];
const base = (where?: ReturnType<typeof eq>) =>
  query((tx) => {
    const q = tx
      .select(columns)
      .from(buildingChecks)
      .leftJoin(properties, eq(properties.id, buildingChecks.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .orderBy(desc(buildingChecks.createdAt));
    return where ? q.where(where) : q.limit(200);
  });

function shape(r: Raw) {
  const result = (r.result ?? null) as CheckResult | null;
  const count = (s: "red" | "amber" | "green") => result?.findings.filter((f) => f.severity === s).length ?? 0;
  const priced = result?.findings.filter((f) => f.severity !== "green") ?? [];
  return {
    ...r,
    result,
    title:
      r.label ||
      [[r.streetNumber, r.street].filter(Boolean).join(" "), r.suburb].filter(Boolean).join(", ") ||
      "Unnamed property",
    red: count("red"),
    amber: count("amber"),
    green: count("green"),
    costLow: priced.reduce((n, f) => n + (f.costLow ?? 0), 0),
    costHigh: priced.reduce((n, f) => n + (f.costHigh ?? f.costLow ?? 0), 0),
  };
}

export type BuildingCheckRow = ReturnType<typeof shape>;

export async function listBuildingChecks() {
  return (await base()).map(shape);
}

export async function getBuildingCheck(id: string) {
  const [r] = await base(eq(buildingChecks.id, id));
  return r ? shape(r) : null;
}

export async function buildingChecksForProperty(propertyId: string) {
  return (await base(eq(buildingChecks.propertyId, propertyId))).map(shape);
}
