/**
 * Walkway assembly (SPEC): tile `rapta-walkway-bay` between two building
 * edges; auto-count posts. Elevated runs are the same part on taller posts
 * (post scaling is applied by the scene from the FFL, like footings).
 */
import type { Manifest } from "../manifest.js";
import { getPart } from "./wall.js";
import { AssemblyError, type AssemblyResult, type PlacedPart } from "./types.js";

export interface WalkwayRunInput {
  /** clear gap between the two building edges, metres */
  gapM: number;
  /** walkway start point in site coords (SW-bottom of the first bay) */
  origin?: [number, number, number];
  /** 0 = run along +X, 90 = along +Z */
  rotationYDeg?: 0 | 90;
}

export interface WalkwayRunResult extends AssemblyResult {
  bays: number;
  posts: number;
}

export function assembleWalkway(
  input: WalkwayRunInput,
  manifest: Manifest,
): WalkwayRunResult {
  const { gapM } = input;
  if (!(gapM > 0)) throw new AssemblyError(`walkway gap must be positive, got ${gapM}`);

  const bayPart = getPart(manifest, "rapta-walkway-bay");
  const step = bayPart.tileStepM ?? bayPart.dimensions.x;
  const bays = Math.max(1, Math.ceil(gapM / step - 1e-9));
  // Each bay ships an integral post pair; a run shares posts at bay joins:
  // (bays + 1) frames × 2 posts.
  const posts = (bays + 1) * 2;

  const origin = input.origin ?? [0, 0, 0];
  const rot = input.rotationYDeg ?? 0;
  const dir: [number, number, number] = rot === 0 ? [1, 0, 0] : [0, 0, 1];

  const placements: PlacedPart[] = [];
  for (let i = 0; i < bays; i++) {
    placements.push({
      partId: "rapta-walkway-bay",
      position: [
        origin[0] + dir[0] * i * step,
        origin[1],
        origin[2] + dir[2] * i * step,
      ],
      rotationYDeg: rot,
    });
  }

  const counts: Record<string, number> = { "rapta-walkway-bay": bays };
  return { placements, counts, bays, posts };
}
