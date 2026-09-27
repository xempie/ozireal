"use client";

import * as React from "react";

/**
 * What an error boundary shows, and the one error it fixes by itself.
 *
 * After a deploy, a tab opened earlier still runs the OLD page: it asks for script
 * chunks the new build no longer has, or calls Server Actions by ids the new build
 * does not know ("Failed to find Server Action ... older or newer deployment"). Next
 * then shows a bare "Application error: a client-side exception". Only a reload fixes
 * it, so for that error this reloads once, automatically. The sessionStorage guard
 * stops a genuinely broken page from reloading in a loop.
 */

const STALE = /ChunkLoadError|Loading (CSS )?chunk|Server Action|older or newer deployment|dynamically imported module/i;
const GUARD = "ozi-stale-reload-at";

export function isStaleDeployError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ChunkLoadError" || STALE.test(error.message);
}

export function RecoverScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
}) {
  const stale = isStaleDeployError(error);

  React.useEffect(() => {
    if (!stale) {
      console.error(error);
      return;
    }
    try {
      const last = Number(window.sessionStorage.getItem(GUARD) ?? 0);
      if (Date.now() - last > 30_000) {
        window.sessionStorage.setItem(GUARD, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // Storage blocked: fall through to the button rather than risk a reload loop.
    }
  }, [error, stale]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ maxWidth: 380, textAlign: "center" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 8px" }}>
          {stale ? "The app has just been updated" : "Something went wrong"}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.75, margin: "0 0 20px" }}>
          {stale
            ? "This page was opened before the update. Reloading brings in the new version. Nothing you saved is lost."
            : "This page hit an unexpected error. Reloading usually fixes it. If it keeps happening, note what you were doing and let us know."}
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: "#2a78d6",
              color: "#fff",
              border: 0,
              borderRadius: 6,
              padding: "10px 18px",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {!stale && reset && (
            <button
              type="button"
              onClick={() => reset()}
              style={{
                background: "transparent",
                border: "1px solid rgba(127,127,127,.4)",
                borderRadius: 6,
                padding: "10px 18px",
                fontSize: 14,
                cursor: "pointer",
                color: "inherit",
              }}
            >
              Try again
            </button>
          )}
        </div>
        {error.digest && (
          <p style={{ fontSize: 11, opacity: 0.5, marginTop: 18 }}>Reference {error.digest}</p>
        )}
      </div>
    </div>
  );
}
