"use client";

import * as React from "react";

/**
 * Opens the assistant from anywhere on a page, optionally with a request already typed
 * (prefill, for the agent to finish) or sent. The widget listens for this event, so a
 * page never needs a reference to it.
 */
export const ASK_EVENT = "ozi:ask";
export type AskDetail = { prefill?: string; send?: string };

export function openAssistant(detail: AskDetail = {}) {
  window.dispatchEvent(new CustomEvent<AskDetail>(ASK_EVENT, { detail }));
}

export function AskButton({
  prefill,
  send,
  className,
  style,
  children,
}: AskDetail & {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        // Tiles are links; the quick action must not also navigate.
        e.preventDefault();
        e.stopPropagation();
        openAssistant({ prefill, send });
      }}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
