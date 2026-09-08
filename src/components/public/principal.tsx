import Image from "next/image";
import Link from "next/link";
import { AGENCY, PORTRAIT } from "./agency";

/**
 * The principal, with his photograph.
 *
 * The site ran for several rounds naming three agents who do not exist and never once
 * showing the person who actually holds the licence. This is the fix: one real face,
 * on every page where the answer to "who am I dealing with" is the point.
 *
 * `priority` is deliberately not set. The portrait is below the fold on every page that
 * uses it, and preloading it would compete with the hero for the same connection.
 */
export function PrincipalCard({
  children,
  cta,
}: {
  children?: React.ReactNode;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="principal">
      <div className="principal-photo">
        <Image
          src={PORTRAIT.src}
          alt={PORTRAIT.alt}
          width={PORTRAIT.width}
          height={PORTRAIT.height}
          sizes="(max-width: 900px) 70vw, 340px"
        />
      </div>
      <div className="principal-body">
        <p className="eyebrow">{AGENCY.principalTitle}</p>
        <h3>{AGENCY.principal}</h3>
        <p className="principal-role">
          Real Estate Agent &middot; {AGENCY.licence}
        </p>
        {children}
        <p className="principal-contact">
          <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
          <br />
          <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
        </p>
        {cta && (
          <Link className="btn" href={cta.href}>
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}
