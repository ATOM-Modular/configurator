/**
 * Whole-building assembly (SPEC assembly logic):
 *   - four tiled wall elevations with opening swaps
 *   - 4 corner flashings; base channel + chassis edge tiled per elevation
 *   - width > 3.4m: repeated module envelope, tee-join flashings at joins,
 *     single continuous roof
 *   - footings: 6 blocks per module footprint (2×3 pattern), height scaled
 *     to FFL − chassis allowance
 */
import type { Manifest } from "../manifest.js";
import {
  BEARER_INSET_M,
  BUILDING_FLOOR_BUILDUP_M,
  FOOTING_END_SETBACK_TOTAL_M,
  footingCountForBlock,
  footingPositionsAlongLength,
  MODULE_WIDTH_M as SPEC_MODULE_WIDTH_M,
  PANEL_THICKNESS_M,
  SINGLE_MODULE_MAX_WIDTH_M as SPEC_SINGLE_MODULE_MAX_WIDTH_M,
  WALL_HEIGHT_EAVE_M,
  WALL_HEIGHT_RIDGE_M,
} from "../spec-constants.js";
import { getPart, tileWallRun } from "./wall.js";
import {
  AssemblyError,
  type AssemblyResult,
  type Elevation,
  type PlacedPart,
  type RotationYDeg,
  type WallOpeningSpec,
} from "./types.js";

export const MODULE_WIDTH_M = SPEC_MODULE_WIDTH_M;
export const SINGLE_MODULE_MAX_WIDTH_M = SPEC_SINGLE_MODULE_MAX_WIDTH_M;

export { footingCountForBlock, footingPositionsAlongLength };

export interface BuildingAssemblyInput {
  lengthM: number;
  widthM: number;
  ffl_mm: number;
  openings?: WallOpeningSpec[];
}

interface ElevationFrame {
  origin: [number, number, number];
  dir: [number, number, number];
  rot: RotationYDeg;
  runM: number;
}

/**
 * CCW loop from the SW corner; X east, Z north.
 * rot is a three.js Y-rotation (positive = CCW seen from +Y), chosen so a
 * part's local +X follows `dir` and its thickness (+Z) points INTO the
 * building: rotY(270°) maps +X→+Z, rotY(90°) maps +X→−Z.
 *
 * The long (south/north) walls run the FULL external length; the short
 * (east/west) walls fit BETWEEN them, so their run is the external width
 * less one panel thickness at each end. This is what makes a 3000 end wall
 * tile as 2×1200 + a 500 cut panel, exactly as the shop drawings show.
 * [RhinoSite 6x3 panel set: end-wall panels #10 and #11 are 500 CUTTED]
 */
function elevationFrames(L: number, W: number): Record<Elevation, ElevationFrame> {
  const t = PANEL_THICKNESS_M;
  const endRun = Math.max(0, W - 2 * t);
  return {
    south: { origin: [0, 0, 0], dir: [1, 0, 0], rot: 0, runM: L },
    east: { origin: [L - t, 0, t], dir: [0, 0, 1], rot: 270, runM: endRun },
    north: { origin: [L, 0, W - t], dir: [-1, 0, 0], rot: 180, runM: L },
    west: { origin: [0, 0, W - t], dir: [0, 0, -1], rot: 90, runM: endRun },
  };
}

export function buildingModuleCount(widthM: number): number {
  if (widthM <= SINGLE_MODULE_MAX_WIDTH_M) return 1;
  return Math.ceil(widthM / MODULE_WIDTH_M);
}

export function assembleBuilding(
  input: BuildingAssemblyInput,
  manifest: Manifest,
): AssemblyResult {
  const { lengthM: L, widthM: W, ffl_mm } = input;
  if (!(L > 0) || !(W > 0)) {
    throw new AssemblyError(`building dimensions must be positive (${L}×${W})`);
  }

  const placements: PlacedPart[] = [];
  const place = (
    partId: string,
    position: [number, number, number],
    rotationYDeg: RotationYDeg = 0,
    scale?: [number, number, number],
  ) => {
    placements.push(scale ? { partId, position, rotationYDeg, scale } : { partId, position, rotationYDeg });
  };

  const frames = elevationFrames(L, W);
  const wallPart = getPart(manifest, "panel-wall-1200");
  const wallH = wallPart.dimensions.y;

  // --- Walls (tiled per elevation, openings swapped in) ---
  for (const [name, frame] of Object.entries(frames) as [Elevation, ElevationFrame][]) {
    const openings = (input.openings ?? []).filter((o) => o.elevation === name);
    const run = tileWallRun(frame.runM, openings, manifest);
    for (const p of run.placements) {
      placements.push({
        partId: p.partId,
        position: [
          frame.origin[0] + frame.dir[0] * p.xM,
          0,
          frame.origin[2] + frame.dir[2] * p.xM,
        ],
        rotationYDeg: frame.rot,
        ...(p.scaleX !== undefined ? { scale: [p.scaleX, 1, 1] as [number, number, number] } : {}),
        meta: { elevation: name, ...(p.bay !== undefined ? { bay: p.bay } : {}) },
      });
    }
    // Base channel + chassis edge tile the same run (full sections; the
    // placeholder renderer tolerates the trailing overlap).
    const stepBase = getPart(manifest, "flashing-basechannel").tileStepM ?? 1.2;
    for (let i = 0; i < Math.ceil(frame.runM / stepBase - 1e-9); i++) {
      const x: [number, number, number] = [
        frame.origin[0] + frame.dir[0] * i * stepBase,
        0,
        frame.origin[2] + frame.dir[2] * i * stepBase,
      ];
      place("flashing-basechannel", x, frame.rot);
      place("chassis-edge", [x[0], -getPart(manifest, "chassis-edge").dimensions.y, x[2]], frame.rot);
    }
  }

  // --- Corner flashings ---
  place("flashing-corner", [0, 0, 0], 0);
  place("flashing-corner", [L, 0, 0], 90);
  place("flashing-corner", [L, 0, W], 180);
  place("flashing-corner", [0, 0, W], 270);

  // --- Multi-module tee joins (vertical cover strip at each end wall) ---
  const modules = buildingModuleCount(W);
  for (let j = 1; j < modules; j++) {
    const zJoin = j * MODULE_WIDTH_M;
    place("flashing-tee-join", [0, 0, zJoin], 0);
    place("flashing-tee-join", [L, 0, zJoin], 180);
  }

  // --- Roof: shallow 2° gable with the ridge running ACROSS the width at
  //     mid-length, so both long walls carry the rake profile (panels step
  //     2470 eave → 2570 ridge → 2470). Sheets tile along the length and
  //     rise to the ridge; one row per module, one continuous plane.
  //     [RhinoSite 6x3 panel heights; Central Darling roof plan "2° 2°"]
  const roofPart = getPart(manifest, "roof-sheet-skillion");
  const roofStep = roofPart.tileStepM ?? roofPart.dimensions.x;
  const sheetsPerRow = Math.ceil(L / roofStep - 1e-9);
  const ridgeRise = WALL_HEIGHT_RIDGE_M - WALL_HEIGHT_EAVE_M;
  /** Height of the roof plane at distance x along the length. */
  const roofY = (x: number) => {
    const t = Math.min(1, Math.abs(x - L / 2) / (L / 2)); // 0 at ridge, 1 at eave
    return wallH + ridgeRise * (1 - t);
  };
  for (let m = 0; m < modules; m++) {
    for (let s = 0; s < sheetsPerRow; s++) {
      const x = s * roofStep;
      place("roof-sheet-skillion", [x, roofY(x), m * MODULE_WIDTH_M]);
    }
  }

  // Ridge capping along the ridge line; fascia capping along both long walls.
  const ridgeStep = getPart(manifest, "capping-ridge").tileStepM ?? 1.2;
  for (let i = 0; i < Math.ceil(W / ridgeStep - 1e-9); i++) {
    place("capping-ridge", [L / 2, wallH + ridgeRise, i * ridgeStep]);
  }
  const fasciaStep = getPart(manifest, "capping-fascia").tileStepM ?? 1.2;
  for (let i = 0; i < Math.ceil(L / fasciaStep - 1e-9); i++) {
    const x = i * fasciaStep;
    place("capping-fascia", [x, roofY(x), 0], 0);
    place("capping-fascia", [x + fasciaStep, roofY(x), W], 180);
  }

  // --- Gutter along the north (low) edge + one downpipe per module ---
  const gutterStep = getPart(manifest, "barge-gutter-section").tileStepM ?? 1.2;
  for (let i = 0; i < Math.ceil(L / gutterStep - 1e-9); i++) {
    place("barge-gutter-section", [i * gutterStep, wallH, W], 0);
  }
  const dpPart = getPart(manifest, "downpipe");
  for (let m = 0; m < modules; m++) {
    place(
      "downpipe",
      [L - dpPart.dimensions.x, 0, W],
      0,
      [1, wallH / dpPart.dimensions.y, 1],
    );
  }

  // --- Footings ---
  // Two bearer lines inset 615mm from each edge; along the length, positions
  // are spaced at most 2600mm between ~800mm end setbacks. That yields the
  // drawing counts: 4.8m→6, 6m→6, 12m→10 blocks per 3m-wide block.
  // Block height = FFL − floor build-up (243mm).
  // [ZIN footing schedule; CD12x9 footing plan]
  const footing = getPart(manifest, "footing-surefoot");
  const fflM = ffl_mm / 1000;
  const rawHeight = fflM - BUILDING_FLOOR_BUILDUP_M;
  const minH = footing.scalable?.minM ?? footing.dimensions.y;
  const maxH = footing.scalable?.maxM ?? footing.dimensions.y;
  const heightM = Math.min(maxH, Math.max(minH, rawHeight));
  if (rawHeight > maxH) {
    throw new AssemblyError(
      `FFL ${ffl_mm}mm needs ${rawHeight.toFixed(3)}m footings — exceeds ${maxH}m max for ${footing.id}`,
    );
  }
  const scaleY = heightM / footing.dimensions.y;
  const positions = footingPositionsAlongLength(L);
  const setback = FOOTING_END_SETBACK_TOTAL_M / 2;
  const span = L - 2 * setback;
  const xs = Array.from(
    { length: positions },
    (_, i) => setback + (span * i) / (positions - 1) - footing.dimensions.x / 2,
  );
  for (let m = 0; m < modules; m++) {
    const blockZ0 = m * MODULE_WIDTH_M;
    const blockDepth = Math.min(MODULE_WIDTH_M, W - blockZ0);
    const zs = [
      blockZ0 + BEARER_INSET_M - footing.dimensions.z / 2,
      blockZ0 + blockDepth - BEARER_INSET_M - footing.dimensions.z / 2,
    ];
    for (const x of xs) {
      for (const z of zs) {
        place("footing-surefoot", [x, -fflM, z], 0, [1, scaleY, 1]);
      }
    }
  }

  return { placements, counts: countByPart(placements) };
}

export function countByPart(placements: PlacedPart[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of placements) counts[p.partId] = (counts[p.partId] ?? 0) + 1;
  return counts;
}
