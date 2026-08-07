import type { PriceLine } from "@atom/contracts";

/** A price line with its internal cost attached — engine-internal only. */
export interface CostedLine extends PriceLine {
  cost: number;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
