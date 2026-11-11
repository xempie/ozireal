import { notFound, redirect } from "next/navigation";
import { getListing } from "@/server/queries";

/**
 * A listing is the advertising for a property, and it is managed on the property's page
 * since 2026-11-11. Old links (emails, audit entries, the assistant) land there.
 */
export default async function ListingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const l = await getListing(id);
  if (!l) notFound();
  redirect(`/properties/${l.propertyId}#website`);
}
