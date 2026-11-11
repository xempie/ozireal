import { PageHero, Prose } from "./page-shell";

/**
 * The shared body of the privacy, terms and complaints pages: a short hero, then plain
 * numbered sections in one readable column. Kept on our own domain on purpose; a policy
 * hosted on somebody else's site is not the agency's policy.
 */
export type LegalSection = {
  heading: string;
  body: string[];
  /** Links shown under the text (e.g. Google's opt-out, which its Analytics terms require). */
  links?: { label: string; href: string }[];
};

export function LegalPage({
  eyebrow,
  title,
  titleEm,
  lede,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  titleEm?: string;
  lede: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={title}
        titleEm={titleEm}
        lede={lede}
        image="photo-1600596542815-ffad4c1539a9"
        imageAlt="White rendered home under a blue sky"
        facts={[`Last updated ${updated}`]}
      />
      <section className="sec">
        <div className="wrap">
          <div className="legal">
            {sections.map((s, i) => (
              <div key={s.heading}>
                <Prose heading={`${i + 1}. ${s.heading}`} body={s.body} />
                {s.links?.length ? (
                  <ul className="legal-links">
                    {s.links.map((l) => (
                      <li key={l.href}>
                        <a href={l.href} target="_blank" rel="noopener noreferrer">
                          {l.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
