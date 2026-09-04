/**
 * "Central Darling Shire 12x9" — test-design of a real ATOM product.
 *
 * Source: Central Darling Shire 12x9 (PLAN) 06.08.26 FOR MANUFACTURE.
 *
 * The drawing's chassis schedule reads "Standard Block QTY 2, SIZE 12x3m":
 * the 9000 overall width is 3000 (block) + 3000 (Rapta walkway shelter) +
 * 3000 (block). So a "12x9" is TWO 12×3 buildings either side of a covered
 * walkway — modelled here in site mode, not as one 9m-wide building.
 *
 * Every quantity below is taken from the drawing schedules; anything the
 * configurator cannot yet express is listed in UNMODELLED at the bottom.
 */
import {
  makeBuilding,
  type BuildingState,
  type SiteKitItem,
  type WalkwayRun,
} from "../state/store";

/** North block: Male Toilet & Shower + Laundry. */
function northBlock(): BuildingState {
  return makeBuilding({
    name: "Male Toilet & Shower / Laundry",
    use: "Toilet & Amenities",
    lengthM: 12,
    widthM: 3,
    ffl_mm: 450,
    colour: "Surfmist",
    placement: { xM: 0, zM: 6, rotationDeg: 0 },
    // [Floor Plan] doors on the walkway side; 600×300 windows on the outer wall
    openings: [
      { id: "cd-n-d1", elevation: "south", partId: "door-820-single", startBay: 1 },
      { id: "cd-n-d2", elevation: "south", partId: "door-820-single", startBay: 6 },
      { id: "cd-n-w1", elevation: "north", partId: "window-toilet-600x300", startBay: 0 },
      { id: "cd-n-w2", elevation: "north", partId: "window-toilet-600x300", startBay: 1 },
      { id: "cd-n-w3", elevation: "north", partId: "window-toilet-600x300", startBay: 2 },
      { id: "cd-n-w4", elevation: "north", partId: "window-toilet-600x300", startBay: 3 },
      { id: "cd-n-w5", elevation: "north", partId: "window-toilet-600x300", startBay: 5 },
      { id: "cd-n-w6", elevation: "north", partId: "window-toilet-600x300", startBay: 6 },
      { id: "cd-n-w7", elevation: "north", partId: "window-toilet-600x300", startBay: 7 },
    ],
    roomMeta: [
      { name: "Male Toilet & Shower", gpoQty: 4, lightQty: 8, dataQty: 0, acOverrideKw: null },
      { name: "Laundry", gpoQty: 2, lightQty: 1, dataQty: 0, acOverrideKw: null },
    ],
    partitionsX: [9],
    // [Plumbing Fixture schedule, north-block share]
    wet: {
      pans: 4,
      basins: 4,
      showers: 4,
      urinals: 0,
      partitions: 4,
      mfSets: 0,
      accessibleSets: 0,
      kitchen: null,
    },
    dda: false,
    extras: [
      { sku: "EXHAUST-FAN", qty: 6 },
      { sku: "LAUNDRY-TUB", qty: 1 }, // "Standard Tub And Cabinet"
      { sku: "HWS-ELECTRIC-160L", qty: 1 }, // 2 across the pair
      { sku: "MIRROR-300", qty: 4 },
      { sku: "TOWEL-DISPENSER", qty: 2 },
      { sku: "TOILET-ROLL-HOLDER", qty: 4 },
      { sku: "TAP-POINT", qty: 3 },
      { sku: "WATERPROOFING-M2", qty: 36 }, // full block floor area
    ],
  });
}

/** South block: Cleaner's Room + Female Toilet & Shower + Accessible. */
function southBlock(): BuildingState {
  return makeBuilding({
    name: "Female Toilet & Shower / Accessible",
    use: "Toilet & Amenities",
    lengthM: 12,
    widthM: 3,
    ffl_mm: 450,
    colour: "Surfmist",
    placement: { xM: 0, zM: 0, rotationDeg: 0 },
    openings: [
      { id: "cd-s-d1", elevation: "north", partId: "door-820-single", startBay: 0 },
      { id: "cd-s-d2", elevation: "north", partId: "door-820-single", startBay: 4 },
      // accessible entry — 1020 leaf with closer
      { id: "cd-s-d3", elevation: "north", partId: "door-920-single", startBay: 8 },
      { id: "cd-s-w1", elevation: "south", partId: "window-toilet-600x300", startBay: 1 },
      { id: "cd-s-w2", elevation: "south", partId: "window-toilet-600x300", startBay: 2 },
      { id: "cd-s-w3", elevation: "south", partId: "window-toilet-600x300", startBay: 3 },
      { id: "cd-s-w4", elevation: "south", partId: "window-toilet-600x300", startBay: 4 },
      { id: "cd-s-w5", elevation: "south", partId: "window-toilet-600x300", startBay: 6 },
      { id: "cd-s-w6", elevation: "south", partId: "window-toilet-600x300", startBay: 8 },
    ],
    roomMeta: [
      { name: "Cleaner's Room", gpoQty: 1, lightQty: 1, dataQty: 0, acOverrideKw: null },
      { name: "Female Toilet & Shower", gpoQty: 2, lightQty: 6, dataQty: 0, acOverrideKw: null },
      { name: "Accessible", gpoQty: 1, lightQty: 1, dataQty: 0, acOverrideKw: null },
    ],
    partitionsX: [2.4, 9.6],
    wet: {
      pans: 2,
      basins: 3,
      showers: 4,
      urinals: 0,
      partitions: 4,
      mfSets: 0,
      accessibleSets: 0,
      kitchen: null,
    },
    dda: true,
    extras: [
      { sku: "BATH-ACC-TOILET", qty: 1 },
      { sku: "BATH-ACC-BASIN", qty: 1 },
      { sku: "BATH-ACC-SHOWER", qty: 1 },
      { sku: "BATH-ACC-SHOWER-SEAT", qty: 1 },
      { sku: "BATH-ACC-GRABRAIL", qty: 1 },
      { sku: "EXHAUST-FAN", qty: 5 },
      { sku: "HWS-ELECTRIC-160L", qty: 1 },
      { sku: "MIRROR-300", qty: 3 },
      { sku: "TOWEL-DISPENSER", qty: 2 },
      { sku: "TOILET-ROLL-HOLDER", qty: 3 },
      { sku: "FLOOR-WASTE-100", qty: 1 },
      { sku: "TAP-POINT", qty: 3 },
      { sku: "WATERPROOFING-M2", qty: 36 },
    ],
  });
}

export interface LoadedSite {
  buildings: BuildingState[];
  siteKit: Omit<SiteKitItem, "id">[];
  walkways: Omit<WalkwayRun, "id">[];
}

export function centralDarlingLoaded(): LoadedSite {
  const north = northBlock();
  const south = southBlock();

  return {
    buildings: [south, north],
    // [Movable Item List: Ramp ×1, Rapta Balustrade ×6, Single Step ×1,
    //  Walkway Shelter Post ×2]
    siteKit: [
      { sku: "RAPTA-STEP-2200", partId: "steps-single-width", label: "Rapta single step 2200", xM: 10.5, zM: 3.6, rotationDeg: 0 },
      { sku: "RAMP-1500X2400", partId: "steps-single-width", label: "Ramp 1500×2400", xM: 12.6, zM: 1.2, rotationDeg: 0 },
      { sku: "WALKWAY-POST", partId: "balustrade-post", label: "Walkway shelter post", xM: 0.3, zM: 4.5, rotationDeg: 0 },
      { sku: "WALKWAY-POST", partId: "balustrade-post", label: "Walkway shelter post", xM: 11.4, zM: 4.5, rotationDeg: 0 },
      ...Array.from({ length: 6 }, (_, i) => ({
        sku: "BALUSTRADE-1250",
        partId: "balustrade-1250",
        label: "Rapta balustrade",
        xM: 1.5 + i * 1.4,
        zM: 3.3,
        rotationDeg: 0 as const,
      })),
    ],
    // the 3m gap between the blocks IS the Rapta walkway shelter
    walkways: [
      { fromBuildingId: south.id, toBuildingId: north.id, elevated: false },
    ],
  };
}

/**
 * Scheduled on the drawing but NOT yet expressible in the configurator.
 * Surfaced in the UI so a test-design is honest about its own gaps rather
 * than silently under-pricing.
 */
export const CENTRAL_DARLING_UNMODELLED = [
  "Roofing colour Monument (configurator colours the walls only)",
  "Interior partition panels priced as walls, not as a separate 50mm interior panel line",
  "Door leaf sizes 1020/920 map onto the catalog's 920/820 SKUs",
  "Waterproofing entered as a flat floor-area quantity, not per wet zone",
  "Motion-sensor / switch / switchboard items not itemised",
] as const;
