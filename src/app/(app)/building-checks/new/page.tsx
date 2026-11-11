import { PageHeader } from "@/components/ui";
import { propertyOptions } from "@/server/queries/pickers";
import { NewBuildingCheck } from "@/components/building-check/new-check";

export default async function NewBuildingCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string }>;
}) {
  const [{ property }, properties] = await Promise.all([searchParams, propertyOptions()]);
  return (
    <>
      <PageHeader
        title="New building check"
        subtitle="Take or add photos, say who it's for, and get a Red / Amber / Green read in about a minute."
      />
      <NewBuildingCheck
        properties={properties}
        presetProperty={properties.some((p) => p.value === property) ? property : undefined}
      />
    </>
  );
}
