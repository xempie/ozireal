import type { NextConfig } from "next";

/**
 * The prototype has no server actions, no API routes and no database, so it exports
 * to plain files. That means it can sit on S3 behind CloudFront with no server to
 * patch and no attack surface — and it costs about a dollar a month.
 *
 * Phase 1 removes `output: "export"`: Server Actions and the tenant-scoped Drizzle
 * client both need a running Node process.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
