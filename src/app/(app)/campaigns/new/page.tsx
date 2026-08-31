import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, ProtoNote } from "@/components/ui";
import {
  listingOptions,
  suburbOptions,
  roleOptions,
  intentTypeOptions,
  sentimentOptions,
  propertyTypeOptions,
  timelineOptions,
  financeStatusOptions,
  sentCampaignOptions,
  savedSegmentOptions,
} from "@/server/queries/pickers";
import { SegmentBuilder } from "@/components/forms/segment-builder";

export const dynamic = "force-dynamic";

/**
 * Choosing who a campaign goes to.
 *
 * Deliberately a separate screen from /campaigns rather than a dialog: picking an
 * audience is a decision made by reading a number and adjusting, not a form filled in
 * once, and a modal cannot hold the running count where the eye needs it.
 *
 * Stage A ends here — the audience. Drafting a personalised message per recipient and
 * sending it is the next module, and the screen says so rather than showing a button
 * that goes nowhere.
 */
export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string }>;
}) {
  const { segment } = await searchParams;
  const [
    listings,
    suburbs,
    timelines,
    financeStatuses,
    campaigns,
    saved,
  ] = await Promise.all([
    listingOptions(),
    suburbOptions(),
    // These two read the values actually present rather than a hardcoded list, so a
    // filter can never offer a value no record holds.
    timelineOptions(),
    financeStatusOptions(),
    sentCampaignOptions(),
    savedSegmentOptions(),
  ]);

  return (
    <>
      <PageHeader
        title="Who should hear about this?"
        subtitle="Build the audience from what each contact has actually told you. Nobody unreachable can end up in it."
        actions={
          <Link
            href="/campaigns"
            className="inline-flex items-center gap-1.5 rounded-md surface-2 border text-[13px] font-medium px-3 min-h-9 hover:surface-3"
          >
            <ArrowLeft size={13} />
            Campaigns
          </Link>
        }
      />

      <SegmentBuilder
        initialSegmentId={segment}
        options={{
          listings,
          suburbs,
          roles: roleOptions(),
          intents: intentTypeOptions(),
          sentiments: sentimentOptions(),
          propertyTypes: propertyTypeOptions(),
          timelines,
          financeStatuses,
          campaigns,
          saved,
        }}
      />

      <div className="mt-6">
        <ProtoNote>
          The audience is the whole of this screen for now. Writing a personalised
          message for each of these people, reviewing them together and sending is the
          next piece — it lands as one draft per recipient in the approval queue, so
          nothing acquires a way out of the building that the queue does not already
          have.
        </ProtoNote>
      </div>
    </>
  );
}
