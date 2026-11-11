"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Google Analytics 4 on the public site only (owner's decision, 2026-11-11). The CRM
 * never loads it, so client records and staff sessions are never tracked.
 *
 * Advertising features (Google signals, ad personalisation) are switched off in the tag
 * itself, so the Privacy policy's promise holds whatever is toggled in the GA admin.
 *
 * Disclosed in the Privacy policy. A documented exception to "data stays in
 * ap-southeast-2" (CLAUDE.md §3.6), approved by the owner: only anonymous usage data
 * goes to Google, never a name, email or phone number. Events carry the form, page
 * and project, nothing a person typed.
 *
 * Lead events, so reports show what brings enquiries rather than only visits:
 *   generate_lead  a website form was sent (fired by the enquiry form; see `track`)
 *   call_click     any phone link, including the phone bar's "Call Esi"
 *   talk_to_esi    a New Homes project card's button, with the project
 *   cta_click      the phone bar's second button
 */

export const GA_ID = "G-VDPN443ZW1";

type Gtag = (...args: unknown[]) => void;

/** Send a GA4 event; a no-op when the tag is blocked or not loaded yet. */
export function track(event: string, params: Record<string, string | undefined> = {}) {
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  if (typeof g === "function") g("event", event, params);
}

export function Analytics() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) {
        track("call_click", { link_location: a.closest(".m-dock") ? "phone_bar" : location.pathname });
      } else if (a.classList.contains("proj-btn")) {
        const card = a.closest<HTMLElement>("[data-proj]");
        track("talk_to_esi", { project: card?.dataset.name, project_kind: card?.dataset.kind });
      } else if (a.classList.contains("m-dock-cta")) {
        track("cta_click", { cta: a.textContent?.trim(), link_location: location.pathname });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', { allow_google_signals: false, allow_ad_personalization_signals: false });`}
      </Script>
    </>
  );
}
