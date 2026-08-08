/**
 * Blaise vocabulary — the canonical parameter values from Blaise v10.2.
 *
 * This is SHARED, boundary-safe data (parameter names / sizes / options —
 * NOT rates), so both the public configurator and the server-side engine can
 * key off the same vocabulary. Rates stay in @atom/catalog. Full reference:
 * packages/catalog/blaise/blaise-parameters.json + blaise-model.md.
 */
import type { WindRegion } from "./index.js";

/**
 * Wall height Blaise uses for wall-area costing (distinct from the 2.754m
 * eave). A dimension, safe to share.
 *
 * NOTE: the cost-plus GP margin is deliberately NOT here — it's sensitive
 * pricing data and lives in @atom/catalog (server-only), so the public
 * bundle never carries the margin.
 */
export const BLAISE_WALL_COST_HEIGHT_M = 2.7;

// --- Structure -------------------------------------------------------------

export const WALL_THICKNESSES_MM = [50, 75, 100] as const;
export const CEILING_THICKNESSES_MM = [50, 75, 100, 125] as const;

/** The 22 Colourbond colours Blaise offers. */
export const COLOURBOND_COLOURS = [
  "Manor Red",
  "Jasper",
  "Evening Haze",
  "Monument",
  "Classic Cream",
  "Ironstone",
  "Surfmist",
  "Shale Grey",
  "Cottage Green",
  "Pale Eucalypt",
  "Dune",
  "Woodland Grey",
  "Windspray",
  "Deep Ocean",
  "Paperbark",
  "Night Sky",
  "Basalt",
  "Cove",
  "Gully",
  "Mangrove",
  "Terrain",
  "Wallaby",
] as const;
export type ColourbondColour = (typeof COLOURBOND_COLOURS)[number];

export const CHASSIS_GALVANIZING = ["Spray Gal", "Hot Dipped"] as const;
export const FLOOR_INSULATION_TYPES = ["Panel", "Spray"] as const;

/** Blaise's standard chassis sizes ("L x W", metres). */
export interface ChassisSize {
  key: string;
  lengthM: number;
  widthM: number;
}
export const CHASSIS_SIZES: ChassisSize[] = [
  "12x3",
  "12x3.4",
  "15x3.4",
  "2.4x1.2",
  "3x3",
  "3.4x2.4",
  "4.8x3",
  "6x3",
  "9x3",
  "9.6x3.4",
].map((key) => {
  const [l, w] = key.split("x").map(Number);
  return { key, lengthM: l!, widthM: w! };
});

/**
 * Region-driven panel-upgrade minimums (Sales Calculator O15/O16).
 * Region C → external & ceiling ≥ 100mm; D → external ≥ 200, ceiling ≥ 250.
 */
export function panelUpgradeMinimums(region: WindRegion): {
  externalMinMm: number;
  ceilingMinMm: number;
} {
  if (region === "D") return { externalMinMm: 200, ceilingMinMm: 250 };
  if (region === "C") return { externalMinMm: 100, ceilingMinMm: 100 };
  return { externalMinMm: 50, ceilingMinMm: 50 };
}

// --- Openings --------------------------------------------------------------

export const DOOR_TYPES = [
  "Swing 820x2040mm",
  "Swing 920x2040mm",
  "Swing 1020x2040mm",
  "Glass Sliding 1800x2040mm",
  "Glass Sliding 2100x2040mm",
  "PVC Barn Sliding 2150x1000mm",
] as const;
export const DOOR_SEAL = ["Nil", "Raven Weather Seal"] as const;
export const DOOR_WINDOW = ["Nil", "600x400mm Window"] as const;
export const DOOR_SECURITY = ["Nil", "Lock Box"] as const;
export const DOOR_CLOSER = ["Nil", "Hydraulic Door Closer"] as const;

export const WINDOW_SIZES = [
  "1200x1200 Sliding Sash",
  "1200x800 Sliding Sash",
  "600x300 Toilet Window",
  "Custom",
] as const;
export const WINDOW_GLAZING = ["Single Glazed", "Double Glazed"] as const;
export const WINDOW_FUNCTION = ["Sliding", "Fixed"] as const;
export const WINDOW_COVERINGS = ["Nil", "Blinds"] as const;

// --- Services / electrical --------------------------------------------------

export const POWER_SUPPLY_CAPACITY = ["3 Phase", "15 Amp"] as const;
export const CONNECTION_TYPE = ["Hard Wired", "Caravan Plug"] as const;
export const POWER_OUTLETS = [
  "Double GPO",
  "External Weather Proof Double GPO",
] as const;
export const DATA_TV_OUTLETS = ["TV Connection Point", "Double Data Point"] as const;
export const SMOKE_DETECTORS = ["Battery Operated", "Wired", "Nil"] as const;
export const ACCESS_STEP = ["Nil", "Single Step", "Double Step"] as const;

// --- Wet areas -------------------------------------------------------------

export const BATHROOM_MIRRORS = ["300mm x 300mm", "600mm x 300mm", "600mm x 450mm"] as const;
export const URINAL_SIZES = ["Nil", "600mm", "1200mm", "1800mm", "2100mm"] as const;
export const SHOWER_SIZES = ["Nil", "900x900mm", "1200x900mm"] as const;
export const HOT_WATER_SIZES = [
  { label: "Nil", litres: 0 },
  { label: "25l", litres: 25 },
  { label: "50l", litres: 50 },
  { label: "100l", litres: 100 },
  { label: "160l", litres: 160 },
  { label: "17l Continuous Flow", litres: 17 },
] as const;
export const HWS_SERVICE_TYPES = ["Nil", "Gas", "Electric"] as const;
export const KITCHENETTE_TYPES = [
  "Nil",
  "600x1500x900mm - White",
  "L' shape 600x1500x1500x900mm - White",
  "600x2100x900mm - White",
  "Custom",
] as const;
export const BATHROOM_ASSEMBLIES = [
  "Bathroom - Supply & Install",
  "Bathroom (with Shower) - Supply & Install",
  "Ambulant Bathroom - Supply & Install",
  "Accessible Bathroom - Supply & Install",
  "Accessible Bathroom/ Shower - Supply & Install",
] as const;

/** Blaise's 35 priced component categories (ESTIMATOR rows 77–111). */
export const BLAISE_COMPONENT_CATEGORIES = [
  "External Walls",
  "Internal Walls",
  "Ceiling",
  "Roof",
  "Gutter + Downpipe",
  "Chassis",
  "Flooring",
  "Windows 1",
  "Windows 2",
  "Windows 3",
  "Windows 4",
  "Doors 1",
  "Doors 2",
  "Doors 3",
  "Doors 4",
  "Airconditioning 1",
  "Airconditioning 2",
  "Airconditioning 3",
  "Lighting 1",
  "Lighting 2",
  "Lighting 3",
  "Lighting 4",
  "Electrical Fit-outs 1",
  "Electrical Fit-outs 2",
  "Electrical Fit-outs 3",
  "Electrical Fit-outs 4",
  "Electrical Fit-outs 5",
  "Power",
  "Bathroom 1",
  "Kitchen 1",
  "Hot Water System",
  "Laundry",
  "Others",
  "Fire Rated Wall",
  "Additional",
] as const;
