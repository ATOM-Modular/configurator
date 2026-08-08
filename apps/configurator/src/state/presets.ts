import type { BuildingUse } from "@atom/contracts";
import { buildingModuleCount } from "@atom/assets";

export const BUILDING_USES: BuildingUse[] = [
  "Office",
  "Lunchroom",
  "Toilet & Amenities",
  "Accommodation",
  "Lab",
  "Classroom",
];

export interface SizePreset {
  key: string;
  lengthM: number;
  widthM: number;
}

/** Sizes step in transport-module increments (3m-wide modules). */
export const SIZE_PRESETS: SizePreset[] = [
  { key: "3.6x3", lengthM: 3.6, widthM: 3 },
  { key: "4.8x3", lengthM: 4.8, widthM: 3 },
  { key: "6x3", lengthM: 6, widthM: 3 },
  { key: "7.2x3", lengthM: 7.2, widthM: 3 },
  { key: "9x3", lengthM: 9, widthM: 3 },
  { key: "12x3", lengthM: 12, widthM: 3 },
  { key: "6x6", lengthM: 6, widthM: 6 },
  { key: "9x6", lengthM: 9, widthM: 6 },
];

export function presetName(p: SizePreset, use: BuildingUse | string): string {
  const family = use === "Toilet & Amenities" ? "Amenities" : use;
  return `${p.lengthM.toFixed(1)} × ${p.widthM.toFixed(1)}m ${family}`;
}

/** PLACEHOLDER occupancy heuristics (m² per person) [CHECK with Duane]. */
const M2_PER_PERSON: Partial<Record<BuildingUse, number>> = {
  Office: 6,
  Lunchroom: 2.5,
  Classroom: 2.5,
  Accommodation: 12,
  Lab: 8,
};

export function suggestedOccupancy(areaM2: number, use: BuildingUse | string): number | null {
  const rate = M2_PER_PERSON[use as BuildingUse];
  if (!rate) return null;
  return Math.max(1, Math.floor(areaM2 / rate));
}

export function moduleCountFor(widthM: number): number {
  return buildingModuleCount(widthM);
}

/** Colorbond palette — hex values are PLACEHOLDER pending swatch check. */
export const COLORBOND_COLOURS: { name: string; hex: string }[] = [
  { name: "Surfmist", hex: "#E4E2D5" },
  { name: "Shale Grey", hex: "#BDBFBA" },
  { name: "Basalt", hex: "#6D6C6E" },
  { name: "Woodland Grey", hex: "#4D4E4C" },
  { name: "Monument", hex: "#323233" },
];

export const PANEL_TYPES = ["EPS-FR", "EPS", "PIR"] as const;
export const PANEL_THICKNESSES_MM = [50, 75, 100] as const;
