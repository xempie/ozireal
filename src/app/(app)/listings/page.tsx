import { redirect } from "next/navigation";

/**
 * Listings merged into Properties (owner's request, 2026-11-11). The old listings board
 * is the Properties page's Board view; this keeps bookmarks and old links working.
 */
export default function ListingsPage() {
  redirect("/properties?view=board");
}
