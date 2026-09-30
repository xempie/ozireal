import { sql } from "drizzle-orm";
import { publicQuery } from "./tenant";

/**
 * Website display settings, as the public site may read them.
 *
 * A named projection like every file here (rule 8): each key is read by name and
 * given its default, so nothing else in tenants.site_settings (or the tenants row)
 * can reach a public page by accident.
 */
export type PublicSiteSettings = {
  homeListingFilters: boolean;
};

export async function publicSiteSettings(): Promise<PublicSiteSettings> {
  const rows = await publicQuery((tx) =>
    tx.execute<{ home_listing_filters: boolean | null }>(
      sql`select (site_settings->>'homeListingFilters')::boolean as home_listing_filters
          from tenants order by created_at limit 1`,
    ),
  );
  return {
    homeListingFilters: rows[0]?.home_listing_filters ?? true,
  };
}
