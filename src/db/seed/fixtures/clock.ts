/**
 * A fixed reference date for the seed fixtures.
 *
 * These helpers used to live in src/lib/utils, where the app imported them too - which
 * meant every relative timestamp on screen was measured against a hardcoded day. The
 * app now uses real wall-clock time; only the fixtures still want a stable "now", so
 * that they seed the same relative spread every run.
 */
export const SEED_NOW = new Date("2026-08-20T09:00:00+09:30");

export function daysAgo(n: number) {
  const d = new Date(SEED_NOW);
  d.setDate(d.getDate() - n);
  return d;
}

export function hoursAgo(n: number) {
  const d = new Date(SEED_NOW);
  d.setHours(d.getHours() - n);
  return d;
}
