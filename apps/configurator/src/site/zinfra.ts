/**
 * "Zinfra Craigieburn" — the SPEC site-mode acceptance layout.
 *
 * Site Office 6×3 (FFL 765, elevated), M/F Toilet 4.8×3 (FFL 1080),
 * Lunchrooms 01 & 02 6×3 (FFL 535), 2 Rapta covered walkways (one elevated),
 * balustrades, 2 double-width steps, 5000L water tank, 1000L waterskid,
 * 4000L waste tank under the toilet block, 2 macerator pumps. Footing
 * heights derive from each building's FFL.
 */
import { makeBuilding, type BuildingState, type SiteKitItem, type WalkwayRun } from "../state/store";

export interface ZinfraPreset {
  buildings: BuildingState[];
  siteKit: Omit<SiteKitItem, "id">[];
  /** indices into buildings[] — resolved to ids by the loader */
  walkwayPairs: [number, number, boolean][];
}

export function zinfraPreset(): ZinfraPreset {
  const office = makeBuilding({
    name: "Site Office",
    use: "Office",
    lengthM: 6,
    widthM: 3,
    ffl_mm: 765,
    placement: { xM: 0, zM: 0, rotationDeg: 0 },
    openings: [
      { id: "z-o1", elevation: "south", partId: "door-920-single", startBay: 1 },
      { id: "z-o2", elevation: "north", partId: "window-sliding-1175", startBay: 1 },
      { id: "z-o3", elevation: "north", partId: "window-sliding-1175", startBay: 3 },
    ],
    roomMeta: [
      { name: "Office", gpoQty: 6, lightQty: 4, dataQty: 2, acOverrideKw: null },
    ],
  });

  const toilet = makeBuilding({
    name: "M/F Toilet",
    use: "Toilet & Amenities",
    lengthM: 4.8,
    widthM: 3,
    ffl_mm: 1080,
    placement: { xM: 12, zM: 0, rotationDeg: 0 },
    openings: [
      { id: "z-t1", elevation: "south", partId: "door-820-single", startBay: 0 },
      { id: "z-t2", elevation: "south", partId: "door-820-single", startBay: 3 },
      { id: "z-t3", elevation: "north", partId: "window-toilet-600x300", startBay: 1 },
    ],
    roomMeta: [{ name: "Amenities", gpoQty: 2, lightQty: 2, dataQty: 0, acOverrideKw: null }],
    wet: {
      pans: 2,
      basins: 2,
      showers: 0,
      urinals: 1,
      partitions: 2,
      mfSets: 1,
      accessibleSets: 0,
      kitchen: null,
    },
  });

  const lunch1 = makeBuilding({
    name: "Lunchroom 01",
    use: "Lunchroom",
    lengthM: 6,
    widthM: 3,
    ffl_mm: 535,
    placement: { xM: 0, zM: 9, rotationDeg: 0 },
    openings: [
      { id: "z-l1", elevation: "south", partId: "door-920-single", startBay: 0 },
      { id: "z-l2", elevation: "south", partId: "window-sliding-1175", startBay: 2 },
    ],
    roomMeta: [{ name: "Lunchroom", gpoQty: 6, lightQty: 4, dataQty: 0, acOverrideKw: null }],
    wet: {
      pans: 0,
      basins: 1,
      showers: 0,
      urinals: 0,
      partitions: 0,
      mfSets: 0,
      accessibleSets: 0,
      kitchen: "2100",
    },
  });

  const lunch2 = makeBuilding({
    name: "Lunchroom 02",
    use: "Lunchroom",
    lengthM: 6,
    widthM: 3,
    ffl_mm: 535,
    placement: { xM: 12, zM: 9, rotationDeg: 0 },
    openings: [
      { id: "z-m1", elevation: "south", partId: "door-920-single", startBay: 0 },
      { id: "z-m2", elevation: "south", partId: "window-sliding-1175", startBay: 2 },
    ],
    roomMeta: [{ name: "Lunchroom", gpoQty: 6, lightQty: 4, dataQty: 0, acOverrideKw: null }],
    wet: {
      pans: 0,
      basins: 1,
      showers: 0,
      urinals: 0,
      partitions: 0,
      mfSets: 0,
      accessibleSets: 0,
      kitchen: "2100",
    },
  });

  return {
    buildings: [office, toilet, lunch1, lunch2],
    siteKit: [
      // steps at the two highest-FFL entries
      { sku: "STEPS-DOUBLE", partId: "steps-double-width", label: "Steps (double)", xM: 1.5, zM: -1.7, rotationDeg: 0 },
      { sku: "STEPS-DOUBLE", partId: "steps-double-width", label: "Steps (double)", xM: 12.2, zM: -1.7, rotationDeg: 0 },
      { sku: "BALUSTRADE-3000", partId: "balustrade-3000", label: "Balustrade 3000", xM: 3.6, zM: -0.2, rotationDeg: 0 },
      { sku: "BALUSTRADE-3000", partId: "balustrade-3000", label: "Balustrade 3000", xM: 14.4, zM: -0.2, rotationDeg: 0 },
      { sku: "TANK-5000", partId: "tank-5000", label: "Water tank 5000L", xM: 19, zM: 1, rotationDeg: 0 },
      { sku: "WATERSKID-1000", partId: "waterskid-1000", label: "Water skid 1000L", xM: 19, zM: 4, rotationDeg: 0 },
      // waste tank sits under the toilet block
      { sku: "WASTETANK-4000", partId: "wastetank-4000", label: "Waste tank 4000L", xM: 12.6, zM: 0.6, rotationDeg: 0 },
      { sku: "MACERATOR-PUMP", partId: "macerator-pump", label: "Macerator pump", xM: 11.2, zM: 1.2, rotationDeg: 0 },
      { sku: "MACERATOR-PUMP", partId: "macerator-pump", label: "Macerator pump", xM: 11.2, zM: 2.0, rotationDeg: 0 },
    ],
    // office↔toilet (elevated), lunchroom 01↔02
    walkwayPairs: [
      [0, 1, true],
      [2, 3, false],
    ],
  };
}

export interface LoadedZinfra {
  buildings: BuildingState[];
  siteKit: Omit<SiteKitItem, "id">[];
  walkways: Omit<WalkwayRun, "id">[];
}

export function zinfraLoaded(): LoadedZinfra {
  const preset = zinfraPreset();
  return {
    buildings: preset.buildings,
    siteKit: preset.siteKit,
    walkways: preset.walkwayPairs.map(([a, b, elevated]) => ({
      fromBuildingId: preset.buildings[a]!.id,
      toBuildingId: preset.buildings[b]!.id,
      elevated,
    })),
  };
}
