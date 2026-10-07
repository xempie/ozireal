/** A same-site path only, so a redirect cannot bounce someone to another site. */
export const safePath = (p: string | null | undefined) =>
  p && p.startsWith("/") && !p.startsWith("//") && !p.includes("\\") ? p : "/";
