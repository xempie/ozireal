/**
 * Which paths require a session.
 *
 * A pure function with no framework imports, deliberately: it is the single decision
 * separating the public website from the console, and it needs to be testable without
 * dragging Auth.js and the Edge runtime into the test process.
 *
 * ## Why a private list rather than a public one
 *
 * The middleware used to invert this — everything except `/login` and `/` was private —
 * which was right while the app was only a console and became wrong the moment a public
 * website shared the deployment.
 *
 * Replacing it with a list of PUBLIC paths would have been the smaller edit and the worse
 * one: a console route added next year would be public until somebody remembered to add
 * it, and nothing would fail when they did not. Listing the PRIVATE prefixes instead
 * means the failure mode is a public page that needs a login — visible immediately —
 * rather than a private page served to anonymous visitors, which is visible to nobody.
 *
 * `tests/public-boundary.test.ts` reads `src/app/(app)` off disk and asserts every route
 * folder in it appears below.
 */
export const PRIVATE_PREFIXES = [
  "/dashboard",
  "/reports",
  "/contacts",
  "/tasks",
  "/calendar",
  "/voice",
  "/properties",
  "/listings",
  "/matching",
  "/campaigns",
  "/approvals",
  "/confirm",
  "/compliance",
  "/proposals",
  "/content",
  "/seo",
  "/website",
  "/costs",
  "/audit",
  "/settings",
  /** Contact details leave the building through here. It is not a public route. */
  "/api/export",
] as const;

/**
 * Exact match or a path segment beneath it — so `/settings` and `/settings/credentials`
 * are private while `/settingsomething` is not. A bare `startsWith` would gate the
 * third one too, which is the kind of near-miss that only shows up as a mysterious
 * redirect months later.
 */
export function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}
