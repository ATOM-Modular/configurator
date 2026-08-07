/**
 * Demo site for the M2 preview — a slice of the Zinfra Craigieburn
 * acceptance layout: site office + M/F toilet joined by a Rapta walkway,
 * with site kit. ONE config drives BOTH the 3D assembly and the pricing
 * request (the manifest/SKU link in action).
 */
import type { BuildingConfig, SiteConfig } from "@atom/contracts";
import type { WallOpeningSpec } from "@atom/assets";

export interface DemoBuilding {
  config: BuildingConfig;
  openings: WallOpeningSpec[];
  /** site position of the building's SW corner, metres */
  site: { xM: number; zM: number };
}

export const office: DemoBuilding = {
  config: {
    id: "site-office",
    use: "Office",
    lengthM: 6,
    widthM: 3,
    ffl_mm: 765,
    chassis: "office",
    panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
    rooms: [],
    fitout: [
      { sku: "DOOR-920-SC", qty: 1 },
      { sku: "WINDOW-SLIDING-1175", qty: 2 },
    ],
  },
  openings: [
    { elevation: "south", partId: "door-920-single", startBay: 1 },
    { elevation: "north", partId: "window-sliding-1175", startBay: 1 },
    { elevation: "north", partId: "window-sliding-1175", startBay: 3 },
  ],
  site: { xM: 0, zM: 0 },
};

export const toilet: DemoBuilding = {
  config: {
    id: "mf-toilet",
    use: "Toilet & Amenities",
    lengthM: 4.8,
    widthM: 3,
    ffl_mm: 1080,
    chassis: "toilet",
    panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
    rooms: [],
    fitout: [
      { sku: "BATH-ASSY-MF-STD", qty: 1 },
      { sku: "DOOR-820-SC", qty: 2 },
      { sku: "WINDOW-TOILET-600X300", qty: 2 },
    ],
  },
  openings: [
    { elevation: "south", partId: "door-820-single", startBay: 0 },
    { elevation: "south", partId: "door-820-single", startBay: 3 },
    { elevation: "north", partId: "window-toilet-600x300", startBay: 1 },
    { elevation: "north", partId: "window-toilet-600x300", startBay: 2 },
  ],
  site: { xM: 10, zM: 0 },
};

export const demoBuildings = [office, toilet];

/** Walkway spans the 4m gap between office east face and toilet west face. */
export const demoWalkway = {
  gapM: toilet.site.xM - (office.site.xM + office.config.lengthM),
  origin: [office.site.xM + office.config.lengthM, 0, 0.6] as [number, number, number],
  rotationYDeg: 0 as const,
};

/** The pricing request derives from the SAME config state as the scene. */
export const demoSiteConfig: SiteConfig = {
  windRegion: "AB",
  buildings: demoBuildings.map((b) => b.config),
  siteKit: [
    { sku: "WALKWAY-BAY-STD", qty: 3 },
    { sku: "STEPS-DOUBLE", qty: 2 },
    { sku: "TANK-5000", qty: 1 },
    { sku: "WASTETANK-4000", qty: 1 },
    { sku: "MACERATOR-PUMP", qty: 2 },
  ],
};
