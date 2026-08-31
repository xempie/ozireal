import type { Metadata } from "next";
import { ConsoleShell, type ShellData } from "@/components/shell/nav";
import { SignOutButton } from "@/components/shell/sign-out";
import { getAgency, getCounts, getContacts, getListings } from "@/server/queries";

/**
 * Never prerender the console.
 *
 * Without this, Next happily builds these routes at compile time and bakes whatever
 * the database held on the build machine into static HTML - so the dashboard would
 * show yesterday's queue counts until the next deploy. A CRM is dynamic by definition.
 */
export const dynamic = "force-dynamic";

/**
 * Console metadata lives here rather than at the root, which the public website also
 * uses. At the root it told every public page it was an internal prototype.
 */
export const metadata: Metadata = {
  title: { default: "Ozi Realty — Console", template: "%s · Ozi Realty Console" },
  description: "Internal CRM and operations console.",
  // Nothing in here is for a search engine, and several routes carry contact details.
  robots: { index: false, follow: false },
};

/**
 * The shell's data is read once here, in a server component, and handed to the client
 * shell as props. The alternative - each widget fetching for itself - would mean four
 * round trips per navigation and a client component that cannot reach the database
 * anyway.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [agency, counts, contacts, listings] = await Promise.all([
    getAgency(),
    getCounts(),
    getContacts(),
    getListings(),
  ]);

  const data: ShellData = {
    agencyName: agency.name,
    userName: agency.user.name,
    userRole: agency.user.role,
    licence: agency.licence,
    counts,
    searchItems: [
      ...contacts.map((c) => ({
        label: `${c.firstName} ${c.lastName}`,
        sub: `Contact · ${c.suburb ?? ""}`,
        href: `/contacts/${c.id}`,
      })),
      ...listings.map((l) => ({
        label: l.address,
        sub: `Listing · ${l.status}`,
        href: `/listings/${l.id}`,
      })),
    ],
  };

  return (
    <ConsoleShell data={data} signOut={<SignOutButton />}>
      {children}
    </ConsoleShell>
  );
}
