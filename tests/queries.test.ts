import { describe, it, expect } from "vitest";
import * as Q from "@/server/queries";

/**
 * The read paths every screen depends on.
 *
 * The point is not that a function runs - it is that it returns SOMETHING, with the
 * fields the screens actually render. An empty result here would mean a blank page in
 * the console, and a query that silently returns nothing is the failure mode this
 * whole phase was most at risk of.
 */

describe("the console can read its own data", () => {
  it("knows which agency it is", async () => {
    const a = await Q.getAgency();
    expect(a.name).toBeTruthy();
    expect(a.jurisdiction).toBe("South Australia");
  });

  it("counts the queues the sidebar badges show", async () => {
    const c = await Q.getCounts();
    expect(c.contacts).toBeGreaterThan(0);
    expect(c.approvals).toBeGreaterThan(0);
    expect(c.confirms).toBeGreaterThan(0);
  });

  it("returns contacts with the fields the list renders", async () => {
    const rows = await Q.getContacts();
    expect(rows.length).toBeGreaterThan(0);
    const c = rows[0];
    expect(c).toHaveProperty("firstName");
    expect(c).toHaveProperty("lastFollowupOutcome");
    expect(Array.isArray(c.roles)).toBe(true);
    expect(Array.isArray(c.consents)).toBe(true);
  });

  it("returns a contact's brief, preferences and full consent trail", async () => {
    const list = await Q.getContacts();
    const withIntent = list.find((c) => c.intentType);
    expect(withIntent, "no contact carries an intent").toBeTruthy();

    const c = await Q.getContact(withIntent!.id);
    expect(c).toBeTruthy();
    expect(c!.intent?.brief).toBeTruthy();
    // The detail screen shows every consent row, not just the current state, because
    // that trail is the defence if a send is challenged.
    expect(c!.consents.length).toBeGreaterThan(0);
    expect(c!.consents[0]).toHaveProperty("wordingShown");
  });

  it("returns listings with their address already joined", async () => {
    const rows = await Q.getListings();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].address).toMatch(/,/);
  });

  it("gives every match a non-empty reason (6)", async () => {
    const rows = await Q.getAllMatches();
    expect(rows.length).toBeGreaterThan(0);
    for (const m of rows) {
      expect(m.reason.trim().length, `match ${m.listingId} had no reason`).toBeGreaterThan(0);
    }
  });

  it("reports consent as it stands NOW, not as recorded on the draft (rule 2)", async () => {
    const rows = await Q.getApprovals();
    const blocked = rows.find((a) => a.status === "blocked");
    expect(blocked, "the seed carries a consent-blocked draft").toBeTruthy();
    // Drafted while consent was valid; revoked since. If these matched, the screen's
    // "changed since drafting" badge would be decorative.
    expect(blocked!.consentAtDraft).toBe("granted");
    expect(blocked!.consentNow).toBe("revoked");
    expect(blocked!.blockReason).toBeTruthy();
  });

  it("derives campaign counters from real recipient rows", async () => {
    const rows = await Q.getCampaigns();
    const sent = rows.find((c) => c.recipients > 0);
    expect(sent).toBeTruthy();
    expect(sent!.approved + sent!.blocked).toBeLessThanOrEqual(sent!.recipients);
  });

  it("returns a property's own status, independent of any listing (4)", async () => {
    const rows = await Q.getProperties();
    expect(rows.length).toBeGreaterThan(0);
    for (const p of rows) expect(p.status).toBeTruthy();
  });

  it("computes analytics from rows rather than constants", async () => {
    const [intent, source, funnel] = await Promise.all([
      Q.getContactsByIntent(),
      Q.getContactsBySource(),
      Q.getPipelineFunnel(),
    ]);
    expect(intent.length).toBeGreaterThan(0);
    expect(source.length).toBeGreaterThan(0);
    expect(funnel.length).toBeGreaterThan(0);
    // A funnel must narrow; if a later stage exceeded an earlier one the query is
    // counting different populations at each step.
    for (let i = 1; i < funnel.length; i++) {
      expect(funnel[i].value).toBeLessThanOrEqual(funnel[i - 1].value);
    }
  });
});

describe("honesty about what the data cannot yet answer", () => {
  it("reports that there is not enough history for a weekly trend", async () => {
    // The seed carries current state, not months of it. Screens use this to show an
    // empty state instead of a chart implying a trend nobody observed.
    expect(await Q.hasHistory()).toBe(false);
  });

  it("returns an empty enquiry trend rather than a fabricated one", async () => {
    expect(await Q.getEnquiryTrend()).toEqual([]);
  });

  it("returns an empty job queue until BullMQ exists (B3)", async () => {
    expect(await Q.getJobQueue()).toEqual([]);
  });
});
