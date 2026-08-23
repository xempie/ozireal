/**
 * Run every query against the real database and report what comes back.
 *
 * This runs BEFORE converting any screen. If a query returns nothing, that is a bug in
 * the query or the RLS policy - and finding it here is far cheaper than finding it in
 * 25 converted pages.
 */
import "dotenv/config";
import * as Q from "../src/server/queries";

// A script has no session, so opt in to the system tenant. Refused in production.
process.env.OZI_SYSTEM_TENANT = "1";

type Check = [name: string, run: () => Promise<unknown>];

const checks: Check[] = [
  ["getAgency", Q.getAgency],
  ["getCounts", Q.getCounts],
  ["getContacts", Q.getContacts],
  ["getFollowupsDue", Q.getFollowupsDue],
  ["getRecentEnquiries", Q.getRecentEnquiries],
  ["getMergeReviews", Q.getMergeReviews],
  ["getConfirmItems", Q.getConfirmItems],
  ["getProperties", Q.getProperties],
  ["getListings", Q.getListings],
  ["getInspections", Q.getInspections],
  ["getListingsNeedingAttention", Q.getListingsNeedingAttention],
  ["getAllMatches", Q.getAllMatches],
  ["getApprovals", Q.getApprovals],
  ["getCampaigns", Q.getCampaigns],
  ["getTasks", Q.getTasks],
  ["getCalendarEvents", Q.getCalendarEvents],
  ["getVoiceNotes", Q.getVoiceNotes],
  ["getProposals", Q.getProposals],
  ["getBlogPosts", Q.getBlogPosts],
  ["getSocialPosts", Q.getSocialPosts],
  ["getSeoIssues", Q.getSeoIssues],
  ["getRedirects", Q.getRedirects],
  ["getSuburbPages", Q.getSuburbPages],
  ["getAiCostSummary", Q.getAiCostSummary],
  ["getAuditLog", Q.getAuditLog],
  ["getAdapters", Q.getAdapters],
  ["getSavedViews", Q.getSavedViews],
  ["getSettings", Q.getSettings],
  ["getContactsByIntent", Q.getContactsByIntent],
  ["getContactsBySource", Q.getContactsBySource],
  ["getEnquiriesBySuburb", Q.getEnquiriesBySuburb],
  ["getPipelineFunnel", Q.getPipelineFunnel],
  ["getCampaignPerformance", Q.getCampaignPerformance],
  ["getApprovalThroughput", Q.getApprovalThroughput],
  ["getAiSpendByModel", Q.getAiSpendByModel],
  ["getListingPerformance", Q.getListingPerformance],
  ["getContentTotals", Q.getContentTotals],
  ["hasHistory", Q.hasHistory],
];

/** Queries legitimately allowed to come back empty, with the reason. */
const mayBeEmpty: Record<string, string> = {
  getEnquiryTrend: "needs weeks of history the seed does not carry",
  getJobQueue: "BullMQ is not wired up until B3",
};

function describe(v: unknown): { size: number; note: string } {
  if (Array.isArray(v)) return { size: v.length, note: `${v.length} rows` };
  if (v && typeof v === "object") {
    const keys = Object.keys(v as object);
    return { size: keys.length, note: `${keys.length} fields` };
  }
  return { size: v === undefined || v === null ? 0 : 1, note: String(v) };
}

async function main() {
  let ok = 0;
  let empty = 0;
  let failed = 0;

  for (const [name, run] of checks) {
    try {
      const value = await run();
      const { size, note } = describe(value);
      if (size === 0 && !(name in mayBeEmpty)) {
        console.log(`  EMPTY  ${name.padEnd(28)} returned nothing`);
        empty++;
      } else {
        console.log(`  ok     ${name.padEnd(28)} ${note}`);
        ok++;
      }
    } catch (e) {
      console.log(`  FAIL   ${name.padEnd(28)} ${(e as Error).message.split("\n")[0]}`);
      failed++;
    }
  }

  console.log(`\n${ok} ok, ${empty} unexpectedly empty, ${failed} failed`);
  process.exit(empty + failed > 0 ? 1 : 0);
}

main();
