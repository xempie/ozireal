"use client";

import { useEffect, useState } from "react";

/**
 * The Contact Us page's two forms behind tabs: "Send a message" and "Book a free meeting".
 * Both forms are server-rendered as children; this only shows one. Arriving with #meeting
 * (the old /book-online redirects there) opens the meeting tab.
 */
export function ContactTabs({ message, meeting }: { message: React.ReactNode; meeting: React.ReactNode }) {
  const [tab, setTab] = useState<"message" | "meeting">("message");

  useEffect(() => {
    const sync = () => {
      if (window.location.hash === "#meeting") setTab("meeting");
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  return (
    <div id="meeting" className="ct-forms">
      <div className="ct-tabs" role="tablist" aria-label="Choose how to get in touch">
        <button
          type="button"
          role="tab"
          id="ct-t1"
          aria-controls="ct-p1"
          aria-selected={tab === "message"}
          onClick={() => setTab("message")}
        >
          Send a message
        </button>
        <button
          type="button"
          role="tab"
          id="ct-t2"
          aria-controls="ct-p2"
          aria-selected={tab === "meeting"}
          onClick={() => setTab("meeting")}
        >
          Book a free meeting
        </button>
      </div>
      <div className="ss-form" role="tabpanel" id="ct-p1" aria-labelledby="ct-t1" hidden={tab !== "message"}>
        {message}
      </div>
      <div className="ss-form" role="tabpanel" id="ct-p2" aria-labelledby="ct-t2" hidden={tab !== "meeting"}>
        {meeting}
        <p className="ct-note">
          This is a request: Esi will confirm a time with you. Nothing is held in the diary until
          then.
        </p>
      </div>
    </div>
  );
}
