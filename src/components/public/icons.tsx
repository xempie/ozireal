/**
 * The icon set, keyed by name.
 *
 * Inline SVG rather than a font or a library: a dozen small paths cost nothing, need no
 * extra request, inherit `currentColor` so they follow whatever state the card is in, and
 * cannot arrive late and shift the layout.
 *
 * All of them are stroke, 1.5, round joins, on a 24 grid, matching the bed/bath/car icons
 * already on the listing cards. Consistency here matters more than cleverness: the set has
 * to look like one hand drew it, which mostly means resisting detail.
 *
 * They are decorative. Every one sits beside a heading that already says the same thing,
 * so they are `aria-hidden` and announcing them would be noise.
 */

export type IconKey =
  | "report"
  | "clock"
  | "shield"
  | "chart"
  | "search"
  | "key"
  | "home"
  | "money"
  | "check"
  | "people"
  | "map"
  | "lock";

const P = ({ d }: { d: string }) => <path d={d} />;

const PATHS: Record<IconKey, React.ReactNode> = {
  /** A written report: the thing most of these services actually hand over. */
  report: (
    <>
      <P d="M6 3h9l3 3v15H6z" />
      <P d="M15 3v3h3" />
      <P d="M9 12h6M9 16h4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <P d="M12 7.5V12l3 2" />
    </>
  ),
  shield: (
    <>
      <P d="M12 3.5 19 6v6c0 4-3 7-7 8.5C8 19 5 16 5 12V6z" />
      <P d="m9 12 2 2 4-4" />
    </>
  ),
  chart: (
    <>
      <P d="M3.5 20h17" />
      <P d="M7 20v-5M11.5 20v-8M16 20v-4M20 20V7" />
      <P d="m4.5 11 5-4 4 3 6-5.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <P d="m15.8 15.8 4.2 4.2" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="7.5" r="3.5" />
      <P d="M10 10 20 20" />
      <P d="m17 17 2.5-2.5M14.5 14.5 17 12" />
    </>
  ),
  home: (
    <>
      <P d="M3 11.5 12 4l9 7.5" />
      <P d="M5.5 10.5V20h13v-9.5" />
      <P d="M10 20v-5.5h4V20" />
    </>
  ),
  money: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <P d="M12 7v10" />
      <P d="M14.5 9.5c0-1.1-1.1-1.8-2.5-1.8s-2.5.7-2.5 1.8 1.1 1.6 2.5 1.9 2.5.8 2.5 1.9-1.1 1.8-2.5 1.8-2.5-.7-2.5-1.8" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <P d="m8.5 12 2.5 2.5 4.5-5" />
    </>
  ),
  people: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <P d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <P d="M16 6.2a3 3 0 0 1 0 5.6" />
      <P d="M17 14.8c2 .6 3.5 2.4 3.5 4.7" />
    </>
  ),
  map: (
    <>
      <P d="m3 6.5 6-2.5 6 2.5 6-2.5v13l-6 2.5-6-2.5-6 2.5z" />
      <P d="M9 4v13M15 7v13" />
    </>
  ),
  lock: (
    <>
      <P d="M5.5 10.5h13V20h-13z" />
      <P d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
      <P d="M12 14v2.5" />
    </>
  ),
};

export function Icon({ name, className }: { name: IconKey; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  );
}
