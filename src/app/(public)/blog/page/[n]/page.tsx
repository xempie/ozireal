import { permanentRedirect } from "next/navigation";

/**
 * The journal used to paginate at /blog/page/<n>. Since 2026-10-31 the whole archive is
 * one filterable page, so any old page number goes to /blog.
 */
export default function Page() {
  permanentRedirect("/blog");
}
