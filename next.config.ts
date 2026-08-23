import type { NextConfig } from "next";

/**
 * Server-rendered from a Node process.
 *
 * The prototype exported to static files, which was right when it had no data: a dollar
 * a month and no server to patch. A backend cannot live there - a static export has no
 * process, so no Server Action, no database connection, no webhook. §2 rules out the
 * alternative ("Server Actions and Route Handlers are the API. Do not build a parallel
 * API surface"), so the site moves to Node on EC2 as §11 always described.
 */
const nextConfig: NextConfig = {
  /**
   * `output: "standalone"` would bundle a minimal server and keep the EC2 box from
   * needing the whole node_modules tree. It is enabled by an env flag rather than
   * unconditionally, because it builds via symlinks and Windows refuses those without
   * developer mode - so a local build would fail for a reason that has nothing to do
   * with the code. B6 sets STANDALONE=1 on the Linux build host.
   */
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  images: { unoptimized: true },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
