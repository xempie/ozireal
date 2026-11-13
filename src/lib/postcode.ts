/** Australian states, and a postcode's state (Australia Post ranges). Safe in the browser. */
export const AU_STATES = ["SA", "NSW", "VIC", "QLD", "WA", "TAS", "NT", "ACT"] as const;
export type AuState = (typeof AU_STATES)[number];

export function stateFromPostcode(pc: string): AuState | null {
  if (!/^\d{4}$/.test(pc.trim())) return null;
  const n = Number(pc);
  if ((n >= 200 && n <= 299) || (n >= 2600 && n <= 2618) || (n >= 2900 && n <= 2920)) return "ACT";
  if (n >= 800 && n <= 999) return "NT";
  if (n >= 1000 && n <= 2999) return "NSW";
  if (n >= 3000 && n <= 3999) return "VIC";
  if (n >= 4000 && n <= 4999) return "QLD";
  if (n >= 5000 && n <= 5999) return "SA";
  if (n >= 6000 && n <= 6999) return "WA";
  if (n >= 7000 && n <= 7999) return "TAS";
  return null;
}
