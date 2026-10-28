import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlockView, ProjectGrid, groupProjects } from "@/components/public/blocks";
import { CtaBand } from "@/components/public/page-shell";
import { customPage } from "@/server/public/content";

/**
 * Pages created in the console's website editor.
 *
 * Every built-in route is a more specific match and wins, so this only ever sees paths
 * no code page owns. A path with no published (or, in preview, draft) page is a 404,
 * exactly as before this route existed.
 */

type Params = { params: Promise<{ slug: string[] }> };

const pathOf = (slug: string[]) => "/" + slug.map((s) => s.toLowerCase()).join("/");

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const path = pathOf((await params).slug);
  const doc = await customPage(path);
  if (!doc) return {};
  const hero = doc.blocks.find((b) => b.type === "hero");
  return {
    title: doc.meta?.title ?? (hero?.type === "hero" ? hero.title : undefined),
    description: doc.meta?.description,
    alternates: { canonical: path },
  };
}

export default async function Page({ params }: Params) {
  const path = pathOf((await params).slug);
  const doc = await customPage(path);
  if (!doc) notFound();

  const hasCta = doc.blocks.some((b) => b.type === "cta" || b.type === "form");
  return (
    <>
      {groupProjects(doc.blocks).map((item) =>
        item.kind === "projects" ? (
          <ProjectGrid key={item.items[0].image.id} items={item.items} />
        ) : (
          <BlockView key={item.b.id} b={item.b} />
        ),
      )}
      {!hasCta && (
        <CtaBand
          heading="Talk to"
          headingEm="the office"
          label="Contact us"
          href="/contact"
        />
      )}
    </>
  );
}
