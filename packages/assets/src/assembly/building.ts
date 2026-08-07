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
import { getPart, tileWallRun } from "./wall.js";
import {
  AssemblyError,
  type AssemblyResult,
  type Elevation,
  type PlacedPart,
  type RotationYDeg,
  type WallOpeningSpec,
} from "./types.js";

export const MODULE_WIDTH_M = 3.0;
export const SINGLE_MODULE_MAX_WIDTH_M = 3.4;

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

/** CCW loop from the SW corner; X east, Z north. */
function elevationFrames(L: number, W: number): Record<Elevation, ElevationFrame> {
  return {
    south: { origin: [0, 0, 0], dir: [1, 0, 0], rot: 0, runM: L },
    east: { origin: [L, 0, 0], dir: [0, 0, 1], rot: 90, runM: W },
    north: { origin: [L, 0, W], dir: [-1, 0, 0], rot: 180, runM: L },
    west: { origin: [0, 0, W], dir: [0, 0, -1], rot: 270, runM: W },
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
      place(
        p.partId,
        [
          frame.origin[0] + frame.dir[0] * p.xM,
          0,
          frame.origin[2] + frame.dir[2] * p.xM,
        ],
        frame.rot,
        p.scaleX !== undefined ? [p.scaleX, 1, 1] : undefined,
      );
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

  // --- Roof: sheets tile along the length, one row per module, single
  //     continuous plane over multi-module builds ---
  const roofPart = getPart(manifest, "roof-sheet-skillion");
  const roofStep = roofPart.tileStepM ?? roofPart.dimensions.x;
  const sheetsPerRow = Math.ceil(L / roofStep - 1e-9);
  for (let m = 0; m < modules; m++) {
    for (let s = 0; s < sheetsPerRow; s++) {
      place("roof-sheet-skillion", [s * roofStep, wallH, m * MODULE_WIDTH_M]);
    }
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

  // --- Footings: 6 per module (2 across width × 3 along length), scaled to
  //     FFL − chassis allowance ---
  const chassisAllowanceM = getPart(manifest, "chassis-edge").dimensions.y;
  const footing = getPart(manifest, "footing-surefoot");
  const fflM = ffl_mm / 1000;
  const rawHeight = fflM - chassisAllowanceM;
  const minH = footing.scalable?.minM ?? footing.dimensions.y;
  const maxH = footing.scalable?.maxM ?? footing.dimensions.y;
  const heightM = Math.min(maxH, Math.max(minH, rawHeight));
  if (rawHeight > maxH) {
    throw new AssemblyError(
      `FFL ${ffl_mm}mm needs ${rawHeight.toFixed(3)}m footings — exceeds ${maxH}m max for ${footing.id}`,
    );
  }
  const scaleY = heightM / footing.dimensions.y;
  const inset = 0.15;
  const xs = [inset, L / 2 - footing.dimensions.x / 2, L - footing.dimensions.x - inset];
  for (let m = 0; m < modules; m++) {
    const zs = [
      m * MODULE_WIDTH_M + inset,
      Math.min(m * MODULE_WIDTH_M + MODULE_WIDTH_M, W) - footing.dimensions.z - inset,
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
