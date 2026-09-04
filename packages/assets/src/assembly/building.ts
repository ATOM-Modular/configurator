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
  ROOF_PITCH_DEG,
  SINGLE_MODULE_MAX_WIDTH_M as SPEC_SINGLE_MODULE_MAX_WIDTH_M,
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

/** Default roof oversail past the wall line, per side. [manifest trimSpecs] */
export const ROOF_OVERSAIL_M = 0.065;

export interface FrameRect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Footprint rect — the datum for wall & ground parts. */
export function wallRect(L: number, W: number): FrameRect {
  return { x0: 0, x1: L, z0: 0, z1: W };
}

/** Footprint + oversail — the datum for roof parts. */
export function roofRect(L: number, W: number, oversailM = ROOF_OVERSAIL_M): FrameRect {
  return { x0: -oversailM, x1: L + oversailM, z0: -oversailM, z1: W + oversailM };
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
  // Frame-checked placement: a part MUST be positioned against the rect it
  // declares in the manifest (wall / roof / ground). This catches a roof trim
  // being placed off the wall rect (or vice-versa) at assembly time.
  const placeIn = (
    frame: "wall" | "roof" | "ground",
    partId: string,
    position: [number, number, number],
    rotationYDeg: RotationYDeg = 0,
    scale?: [number, number, number],
  ) => {
    const declared = getPart(manifest, partId).anchorFrame;
    if (declared !== frame) {
      throw new AssemblyError(
        `part "${partId}" declares anchorFrame "${declared}" but assembly placed it on the ${frame} rect`,
      );
    }
    place(partId, position, rotationYDeg, scale);
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
    // Base channel + chassis edge tile the same run. The LAST tile is scaled
    // to the remainder so the run ends exactly at the wall line — no trailing
    // section poking past the corner (was Math.ceil full tiles → overhang).
    const stepBase = getPart(manifest, "flashing-basechannel").tileStepM ?? 1.2;
    const chassisH = getPart(manifest, "chassis-edge").dimensions.y;
    const nFull = Math.floor(frame.runM / stepBase + 1e-9);
    const rem = frame.runM - nFull * stepBase;
    const tiles = rem > 1e-3 ? nFull + 1 : nFull;
    for (let i = 0; i < tiles; i++) {
      const partial = i === nFull;
      const sc: [number, number, number] | undefined = partial
        ? [rem / stepBase, 1, 1]
        : undefined;
      const x: [number, number, number] = [
        frame.origin[0] + frame.dir[0] * i * stepBase,
        0,
        frame.origin[2] + frame.dir[2] * i * stepBase,
      ];
      placeIn("wall", "flashing-basechannel", x, frame.rot, sc);
      placeIn("wall", "chassis-edge", [x[0], -chassisH, x[2]], frame.rot, sc);
    }
  }

  // --- Corner flashings (wall frame) ---
  placeIn("wall", "flashing-corner", [0, 0, 0], 0);
  placeIn("wall", "flashing-corner", [L, 0, 0], 90);
  placeIn("wall", "flashing-corner", [L, 0, W], 180);
  placeIn("wall", "flashing-corner", [0, 0, W], 270);

  // --- Multi-module tee joins (vertical wall-line cover strip) ---
  const modules = buildingModuleCount(W);
  for (let j = 1; j < modules; j++) {
    const zJoin = j * MODULE_WIDTH_M;
    placeIn("wall", "flashing-tee-join", [0, 0, zJoin], 0);
    placeIn("wall", "flashing-tee-join", [L, 0, zJoin], 180);
  }

  // --- Roof (anchorFrame "roof", positioned on the ROOF rect = footprint +
  //     oversail): ATOM dual-fall. Ridge runs ACROSS the width at MID-LENGTH,
  //     2° falling to the two SHORT ends. Sheets run the length (down the
  //     fall) as a mirrored pair meeting at the ridge; tiled across the width.
  //     [Central Darling / RhinoSite / Air Liquide roof plans]
  const oversailM = (manifest.trimSpecs?.oversailMm as number | undefined)
    ? (manifest.trimSpecs!.oversailMm as number) / 1000
    : ROOF_OVERSAIL_M;
  const roof = roofRect(L, W, oversailM);
  const ridgeH = wallH + Math.tan((ROOF_PITCH_DEG * Math.PI) / 180) * (L / 2);

  const sheetStep = getPart(manifest, "roof-sheet-dualfall").tileStepM ?? 0.76;
  const sheetsAcross = Math.ceil(W / sheetStep - 1e-9);
  for (let s = 0; s < sheetsAcross; s++) {
    const z = roof.z0 + s * sheetStep;
    placeIn("roof", "roof-sheet-dualfall", [roof.x0, wallH, z]); // west half
    placeIn("roof", "roof-sheet-dualfall", [L / 2, ridgeH, z], 180); // east half (mirror)
  }

  // ridge cap across the width at mid-length
  placeIn("roof", "ridge-cap", [L / 2, ridgeH, roof.z0]);

  // raking fascia along the two long sides (follows the 2° rake)
  const fasciaStep = getPart(manifest, "fascia-capping-raked").tileStepM ?? 1.2;
  const fasciaRun = Math.ceil((roof.x1 - roof.x0) / fasciaStep - 1e-9);
  for (let i = 0; i < fasciaRun; i++) {
    const x = roof.x0 + i * fasciaStep;
    placeIn("roof", "fascia-capping-raked", [x, wallH, roof.z0], 0);
    placeIn("roof", "fascia-capping-raked", [x, wallH, roof.z1], 180);
  }

  // gutter across each SHORT end + barge capping above it
  placeIn("roof", "gutter-quad-end", [roof.x0, wallH, roof.z0], 0);
  placeIn("roof", "gutter-quad-end", [roof.x1, wallH, roof.z0], 180);
  placeIn("roof", "barge-capping-end", [roof.x0, ridgeH, roof.z0], 0);
  placeIn("roof", "barge-capping-end", [roof.x1, ridgeH, roof.z0], 180);

  // module-join cover flashing (longitudinal) — only when multi-module
  const coverStep = getPart(manifest, "cover-flashing-module-join").tileStepM ?? 1.2;
  for (let j = 1; j < modules; j++) {
    const zJoin = j * MODULE_WIDTH_M;
    for (let i = 0; i < Math.ceil(L / coverStep - 1e-9); i++) {
      placeIn("roof", "cover-flashing-module-join", [i * coverStep, ridgeH - 0.05, zJoin]);
    }
  }

  // --- Downpipes (anchorFrame "wall", on the WALL rect): 100×50 at the
  //     end-wall corners; 2 on multi-module. ---
  const wallR = wallRect(L, W);
  const downZ = modules > 1 ? [wallR.z0, wallR.z1] : [wallR.z0];
  const dp = getPart(manifest, "downpipe-100x50");
  for (const x of [wallR.x0, wallR.x1]) {
    for (const z of downZ) {
      placeIn("wall", "downpipe-100x50", [x, 0, z], 0, [1, wallH / dp.dimensions.y, 1]);
    }
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
        placeIn("ground", "footing-surefoot", [x, -fflM, z], 0, [1, scaleY, 1]);
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
