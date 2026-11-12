import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getMatchBoard } from "@/server/queries/match-board";
import { MatchBoard } from "@/components/matching/board";

/**
 * Matching, as a decision board (owner's request, 2026-11-12): "who should I email
 * today, about what?" Opportunity cards first; one property in focus with its people
 * grouped; personal drafts reviewed and approved as a batch. The full two-way list of
 * matches is still at /matching/all.
 */
export default async function MatchingPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const [{ focus }, board] = await Promise.all([searchParams, getMatchBoard()]);
  const focused = focus ? (board.properties.find((p) => p.id === focus) ?? null) : null;
  return (
    <>
      <PageHeader
        title="Matching"
        subtitle="Which property to introduce, to whom, today. Pick one, tick the people, and send each a personal email after you approve it."
        actions={
          <Link href="/matching/all" className="inline-flex items-center rounded-md surface-2 border text-[13px] px-3 min-h-9 hover:surface-3">
            All matches
          </Link>
        }
      />
      <MatchBoard properties={board.properties} cold={board.cold} focusedId={focused?.id ?? null} />
    </>
  );
}
