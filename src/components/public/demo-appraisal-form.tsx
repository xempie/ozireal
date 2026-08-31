"use client";

import * as React from "react";

/**
 * The appraisal form, from the template.
 *
 * ## It stores nothing, and it says so
 *
 * The template swapped the form for a thank-you on submit and posted nowhere. That is
 * fine as a mockup and dangerous the moment a stranger can reach it: someone types their
 * name, phone and home address, reads "an agent will call you", and no record exists.
 *
 * So the note above the fields discloses it *before* anyone types, rather than after.
 * When this is wired up it fetches a signed token and the exact consent wording from
 * `/api/forms/[key]`, posts through the Phase 1 web channel adapter, and stores that
 * wording with the enquiry as consent provenance (CLAUDE.md 4, 10 and 16) — which is
 * the reason it is a real endpoint and not a `fetch` bolted on here.
 */
export function DemoAppraisalForm() {
  const [sent, setSent] = React.useState(false);

  if (sent) {
    return (
      <p className="form-done">
        Thanks — an agent will call you within one business day to arrange a walkthrough.
      </p>
    );
  }

  return (
    <>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSent(true);
        }}
      >
        <input type="text" placeholder="Full name" aria-label="Full name" required />
        <input type="tel" placeholder="Phone" aria-label="Phone" required />
        <input
          className="full"
          type="text"
          placeholder="Property address"
          aria-label="Property address"
          required
        />
        <button className="btn" type="submit">
          Request my appraisal
        </button>
      </form>
      <p className="form-note">
        Preview only — this form is not connected yet and nothing you type is recorded or
        sent.
      </p>
      <p className="form-note">
        No obligation · No listing pitch · We will call within one business day
      </p>
    </>
  );
}
