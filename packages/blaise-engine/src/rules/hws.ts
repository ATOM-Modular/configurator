import type { BuildingConfig } from "@atom/contracts";

/**
 * HWS auto-included on any wet/kitchen build (SPEC engine rules).
 * Electric by default; gas only when showers push demand.
 */
const GAS_SHOWER_THRESHOLD = 3; // PLACEHOLDER — confirm demand rule with Blaise

export function isWetBuild(b: BuildingConfig): boolean {
  return b.fitout.some(
    (f) => f.sku.startsWith("BATH-") || f.sku.startsWith("KITCHEN-"),
  );
}

export function showerCount(b: BuildingConfig): number {
  return b.fitout
    .filter((f) => f.sku === "BATH-SHOWER")
    .reduce((sum, f) => sum + f.qty, 0);
}

/** Returns the HWS SKU to auto-add, or null when the build has no wet areas. */
export function hwsSku(b: BuildingConfig): string | null {
  if (!isWetBuild(b)) return null;
  // If the user already specced an HWS explicitly, don't double up.
  if (b.fitout.some((f) => f.sku.startsWith("HWS-"))) return null;
  return showerCount(b) >= GAS_SHOWER_THRESHOLD ? "HWS-GAS" : "HWS-ELECTRIC";
}
