import type { Chassis } from "@atom/contracts";
import { moduleCount } from "./modules.js";

/**
 * Chassis rate tier (SPEC engine rules):
 *   single-module office / single-module toilet / complex (>3.4m wide)
 */
export function chassisSku(chassis: Chassis, widthM: number): string {
  if (moduleCount(widthM) > 1) return "CHASSIS-COMPLEX";
  return chassis === "toilet" ? "CHASSIS-TOILET-SINGLE" : "CHASSIS-OFFICE-SINGLE";
}
