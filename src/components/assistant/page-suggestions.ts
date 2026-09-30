/**
 * What the assistant offers on each page.
 *
 * `send` goes straight to the assistant. `prefill` puts the start of a request in the
 * box and leaves the cursor there, for things that need a name or a detail the page
 * cannot supply ("Find the contact …").
 *
 * On a record's own page, "this contact" / "this property" / "this listing" works because
 * assistantTurn is told which record is open (see pageContext in actions/assistant.ts).
 */

export type Suggestion = { label: string; send?: string; prefill?: string };

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const s = (label: string): Suggestion => ({ label, send: label });
const p = (label: string, prefill: string): Suggestion => ({ label, prefill });

export function suggestionsFor(pathname: string): { area: string; items: Suggestion[] } {
  if (new RegExp(`^/contacts/${UUID}$`, "i").test(pathname)) {
    return {
      area: "this contact",
      items: [
        s("Summarise this contact"),
        s("Find properties that match this contact"),
        s("Add a follow-up task for this contact tomorrow"),
        p("Log a call with this contact…", "Log a call with this contact: "),
        s("Draft an SMS to this contact"),
      ],
    };
  }
  if (pathname.startsWith("/contacts")) {
    return {
      area: "contacts",
      items: [
        p("Add a new contact…", "Add a new contact: "),
        p("Find a contact…", "Find the contact "),
        s("Who has a follow-up due?"),
        s("Show my hottest buyers"),
        s("List my agent contacts"),
      ],
    };
  }

  if (new RegExp(`^/properties/${UUID}$`, "i").test(pathname)) {
    return {
      area: "this property",
      items: [
        s("Summarise this property"),
        p("Create a sale listing for this property…", "Create a sale listing for this property, price wording: "),
        p("Create a rental listing for this property…", "Create a rental listing for this property at $"),
        p("Add a task about this property…", "Add a task about this property: "),
        p("Update this property…", "Update this property: "),
      ],
    };
  }
  if (pathname.startsWith("/properties")) {
    return {
      area: "properties",
      items: [
        p("Add a new property…", "Add a new property: "),
        s("Show my off-market properties"),
        s("Which properties are listed right now?"),
        p("Find a property by address…", "Find the property at "),
        s("Which properties have no owner linked?"),
      ],
    };
  }

  if (new RegExp(`^/listings/${UUID}$`, "i").test(pathname)) {
    return {
      area: "this listing",
      items: [
        s("Find matching contacts for this listing"),
        s("How is this listing performing?"),
        s("Write a headline and copy for this listing"),
        p("Add a task for this listing…", "Add a task for this listing: "),
      ],
    };
  }
  if (pathname.startsWith("/listings")) {
    return {
      area: "listings",
      items: [
        s("Show my live listings"),
        s("Which listings have no photos or price?"),
        s("Which drafts are waiting to go live?"),
        p("Create a listing for…", "Create a listing for the property at "),
      ],
    };
  }

  if (pathname.startsWith("/matching")) {
    return {
      area: "matching",
      items: [
        s("Run matching for my newest property"),
        p("Find properties for a buyer…", "Find properties that match "),
        p("Find buyers for a property…", "Find buyers for the property at "),
        s("Show the strongest matches"),
      ],
    };
  }

  if (pathname.startsWith("/tasks")) {
    return {
      area: "tasks",
      items: [
        p("Add a new task…", "Add a task: "),
        s("What is overdue?"),
        s("What is due this week?"),
        p("Mark a task as done…", "Mark as done the task "),
        p("Find tasks for a contact…", "Show the tasks for "),
      ],
    };
  }

  if (pathname.startsWith("/approvals") || pathname.startsWith("/confirm")) {
    return {
      area: "approvals",
      items: [
        s("What is waiting for my approval?"),
        p("Draft an SMS to…", "Draft an SMS to "),
      ],
    };
  }

  // The dashboard, and any page without its own set: one from each of the four areas.
  return {
    area: "everything",
    items: [
      s("What needs my attention today?"),
      p("Add a new contact…", "Add a new contact: "),
      p("Add a new property…", "Add a new property: "),
      s("Run matching for my newest property"),
      s("What tasks are overdue?"),
      p("Add a task…", "Add a task: "),
    ],
  };
}

/**
 * The record a page is about, for the assistant's context. Returns null off a record
 * page. Only well-formed ids pass, so nothing a URL can carry reaches the prompt.
 */
export function recordFromPath(pathname: string): { kind: "contact" | "property" | "listing"; id: string } | null {
  const m = new RegExp(`^/(contacts|properties|listings)/(${UUID})$`, "i").exec(pathname);
  if (!m) return null;
  const kind = m[1] === "contacts" ? "contact" : m[1] === "properties" ? "property" : "listing";
  return { kind, id: m[2].toLowerCase() };
}
