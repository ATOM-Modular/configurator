/**
 * Site geometry — pure functions, no React, no three.js.
 *
 * Site coordinates: X east, Z north (scene Z maps to the site plan's "north"
 * axis), origin at the site's SW corner. Buildings are axis-aligned at 0/90/
 * 180/270°, so footprints are AABBs.
 *
 * Structural parameter types keep this module free of a store import cycle.
 */

export interface PlacedBuilding {
  id: string;
  lengthM: number;
  widthM: number;
  ffl_mm: number;
  placement: { xM: number; zM: number; rotationDeg: number };
}

export interface Aabb {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Footprint AABB — a 90/270° rotation swaps length and width. */
export function footprint(b: PlacedBuilding): Aabb {
  const rotated = b.placement.rotationDeg === 90 || b.placement.rotationDeg === 270;
  const dx = rotated ? b.widthM : b.lengthM;
  const dz = rotated ? b.lengthM : b.widthM;
  return {
    x0: b.placement.xM,
    x1: b.placement.xM + dx,
    z0: b.placement.zM,
    z1: b.placement.zM + dz,
  };
}

export function overlaps(a: Aabb, b: Aabb): boolean {
  return a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
}

export type WalkwayAxis = "x" | "z";

export interface WalkwayLink {
  gapM: number;
  /** SW-bottom start point of the first bay, site coords */
  origin: [number, number, number];
  axis: WalkwayAxis;
  /** the two facing edges overlap over this span — used to centre the run */
  overlapM: number;
}

/** Rapta walkway bay footprint (from the manifest part). */
export const WALKWAY_BAY_LENGTH_M = 1.8;
export const WALKWAY_WIDTH_M = 2.4;

/**
 * Geometry of a covered walkway spanning the clear gap between two buildings.
 * Returns null when the buildings don't face each other on an axis (diagonal
 * links aren't supported) or when they touch/overlap.
 */
export function walkwayGeometry(
  a: PlacedBuilding,
  b: PlacedBuilding,
): WalkwayLink | null {
  const fa = footprint(a);
  const fb = footprint(b);
  if (overlaps(fa, fb)) return null;

  // Facing along X (their Z ranges overlap)?
  const zOverlap = Math.min(fa.z1, fb.z1) - Math.max(fa.z0, fb.z0);
  if (zOverlap > 0) {
    const [left, right] = fa.x1 <= fb.x0 ? [fa, fb] : [fb, fa];
    const gapM = right.x0 - left.x1;
    if (gapM <= 0) return null;
    const zStart = Math.max(fa.z0, fb.z0) + Math.max(0, (zOverlap - WALKWAY_WIDTH_M) / 2);
    return { gapM, origin: [left.x1, 0, zStart], axis: "x", overlapM: zOverlap };
  }

  // Facing along Z (their X ranges overlap)?
  const xOverlap = Math.min(fa.x1, fb.x1) - Math.max(fa.x0, fb.x0);
  if (xOverlap > 0) {
    const [near, far] = fa.z1 <= fb.z0 ? [fa, fb] : [fb, fa];
    const gapM = far.z0 - near.z1;
    if (gapM <= 0) return null;
    const xStart = Math.max(fa.x0, fb.x0) + Math.max(0, (xOverlap - WALKWAY_WIDTH_M) / 2);
    return { gapM, origin: [xStart, 0, near.z1], axis: "z", overlapM: xOverlap };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Footing schedule
// ---------------------------------------------------------------------------

/** Matches the chassis-edge depth used by assembleBuilding. */
export const CHASSIS_ALLOWANCE_M = 0.25;
export const MODULE_WIDTH_M = 3.0;
export const SINGLE_MODULE_MAX_WIDTH_M = 3.4;
export const FOOTINGS_PER_MODULE = 6;

export interface FootingRow {
  buildingId: string;
  name: string;
  ffl_mm: number;
  /** exposed footing height = FFL − chassis allowance */
  footingHeightMm: number;
  modules: number;
  footingCount: number;
}

export function moduleCount(widthM: number): number {
  return widthM <= SINGLE_MODULE_MAX_WIDTH_M ? 1 : Math.ceil(widthM / MODULE_WIDTH_M);
}

export function footingSchedule(
  buildings: (PlacedBuilding & { name: string })[],
): FootingRow[] {
  return buildings.map((b) => {
    const modules = moduleCount(b.widthM);
    return {
      buildingId: b.id,
      name: b.name,
      ffl_mm: b.ffl_mm,
      footingHeightMm: Math.round(b.ffl_mm - CHASSIS_ALLOWANCE_M * 1000),
      modules,
      footingCount: modules * FOOTINGS_PER_MODULE,
    };
  });
}

export function totalFootings(rows: FootingRow[]): number {
  return rows.reduce((sum, r) => sum + r.footingCount, 0);
}

// ---------------------------------------------------------------------------
// Budget checks (SPEC: full Zinfra site ≤150k tris on screen)
// ---------------------------------------------------------------------------

export const SITE_TRI_BUDGET = 150_000;

/**
 * Conservative on-screen triangle estimate: sums each placed part's manifest
 * triBudget (the authored-GLB ceiling, well above placeholder geometry).
 */
export function estimateTriangles(
  placements: { partId: string }[],
  triBudgetOf: (partId: string) => number,
): number {
  return placements.reduce((sum, p) => sum + triBudgetOf(p.partId), 0);
}
