import type { BuildingConfig, SiteConfig } from "@atom/contracts";

export function office6x3(overrides: Partial<BuildingConfig> = {}): BuildingConfig {
  return {
    id: "office-1",
    use: "Office",
    lengthM: 6.0,
    widthM: 3.0,
    ffl_mm: 765,
    chassis: "office",
    panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
    rooms: [],
    fitout: [
      { sku: "DOOR-920-SC", qty: 1 },
      { sku: "WINDOW-SLIDING-1175", qty: 2 },
    ],
    ...overrides,
  };
}

export function toilet48x3(overrides: Partial<BuildingConfig> = {}): BuildingConfig {
  return {
    id: "toilet-1",
    use: "Toilet & Amenities",
    lengthM: 4.8,
    widthM: 3.0,
    ffl_mm: 1080,
    chassis: "toilet",
    panels: { type: "EPS-FR", wallMm: 50, ceilingMm: 50, colour: "Surfmist" },
    rooms: [],
    fitout: [
      { sku: "BATH-ASSY-MF-STD", qty: 1 },
      { sku: "WINDOW-TOILET-600X300", qty: 2 },
      { sku: "DOOR-820-SC", qty: 2 },
    ],
    ...overrides,
  };
}

export function site(buildings: BuildingConfig[], overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    windRegion: "AB",
    buildings,
    siteKit: [],
    ...overrides,
  };
}
