import {
  CEILING_THICKNESSES_MM,
  CHASSIS_SIZES,
  COLOURBOND_COLOURS,
  WALL_THICKNESSES_MM,
  type BuildingUse,
} from "@atom/contracts";
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

/**
 * Standard sizes are Blaise's chassis sizes (Lists → "Chassis Size"), sorted
 * office-friendly first. A "Custom size" card still allows anything, flagged
 * as needing a Blaise price.
 */
export const SIZE_PRESETS: SizePreset[] = [...CHASSIS_SIZES]
  .filter((c) => c.lengthM >= c.widthM) // drop the odd portrait chassis for the card grid
  .sort((a, b) => a.lengthM * a.widthM - b.lengthM * b.widthM)
  .map((c) => ({ key: c.key, lengthM: c.lengthM, widthM: c.widthM }));

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

/**
 * The 22 Colourbond colours Blaise offers (names from @atom/contracts). Hex
 * values are approximations for the 3D render — PLACEHOLDER pending a swatch
 * check with Duane. Any Blaise colour without a mapped hex falls back to a
 * mid grey so the swatch grid always shows all 22.
 */
const COLOURBOND_HEX: Record<string, string> = {
  "Manor Red": "#66312A",
  Jasper: "#6D5E4E",
  "Evening Haze": "#C5BFA4",
  Monument: "#323233",
  "Classic Cream": "#E3D9BE",
  Ironstone: "#45494D",
  Surfmist: "#E4E2D5",
  "Shale Grey": "#BDBFBA",
  "Cottage Green": "#304036",
  "Pale Eucalypt": "#7C8471",
  Dune: "#B5AC9A",
  "Woodland Grey": "#4D4E4C",
  Windspray: "#969799",
  "Deep Ocean": "#364152",
  Paperbark: "#CABFA4",
  "Night Sky": "#171614",
  Basalt: "#6D6C6E",
  Cove: "#C7B79E",
  Gully: "#6E6A5F",
  Mangrove: "#5A5B4E",
  Terrain: "#6A5D4D",
  Wallaby: "#8E8C81",
};

export const COLORBOND_COLOURS: { name: string; hex: string }[] =
  COLOURBOND_COLOURS.map((name) => ({ name, hex: COLOURBOND_HEX[name] ?? "#9a958a" }));

/**
 * Roof, cappings, gutter and downpipe are specified independently of the
 * walls and are Monument on every drawing seen so far — the cream-wall /
 * near-black-trim contrast is the strongest visual signature of an ATOM
 * building, so it must be its own choice, not a tint of the wall colour.
 * [Central Darling + RhinoSite ROOFING schedules: Roofing / Ridge Cap /
 *  Gutter & Downpipe / Flashing all "Monument"]
 */
export const DEFAULT_ROOF_COLOUR = "Monument";

export const PANEL_TYPES = ["EPS-FR", "EPS", "PIR"] as const;
/** Wall vs ceiling thicknesses are separate in Blaise (ceiling adds 125mm). */
export const PANEL_THICKNESSES_MM = WALL_THICKNESSES_MM;
export const CEILING_PANEL_THICKNESSES_MM = CEILING_THICKNESSES_MM;
