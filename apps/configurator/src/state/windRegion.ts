import type { WindRegion } from "@atom/contracts";

export const AU_STATES = ["VIC", "NSW", "QLD", "SA", "WA", "TAS", "NT", "ACT"] as const;
export type AuState = (typeof AU_STATES)[number];

/**
 * Default wind region from state/postcode (SPEC step 1: "A&B unless flagged").
 *
 * PLACEHOLDER heuristic — the real AS/NZS 1170.2 region map needs a proper
 * postcode table [CHECK with Duane]. Coarse cyclonic flags only:
 *   NT               → C
 *   QLD ≥ 4740 coast → C  (Mackay north)
 *   WA 6710–6799     → C/D (Pilbara/Kimberley)
 */
export function defaultWindRegion(state: AuState, postcode: string): WindRegion {
  const pc = Number.parseInt(postcode, 10);
  if (state === "NT") return "C";
  if (state === "QLD" && pc >= 4740 && pc <= 4899) return "C";
  if (state === "WA" && pc >= 6710 && pc <= 6799) {
    return pc >= 6750 ? "D" : "C";
  }
  return "AB";
}
