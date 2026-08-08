/**
 * Wall tiling (SPEC assembly logic):
 *   - tile `panel-wall-1200` along each elevation
 *   - the modulo remainder uses `panel-wall-cut` (an X-scaled panel)
 *   - openings snap to the 1200mm panel grid; placing one swaps out the
 *     covered bays for the opening unit (no CSG)
 */
import type { Manifest, ManifestPart } from "../manifest.js";
import { AssemblyError } from "./types.js";

export const WALL_PANEL_ID = "panel-wall-1200";
export const WALL_CUT_ID = "panel-wall-cut";

/** Remainders below this are absorbed rather than rendered as a sliver. */
const MIN_CUT_M = 0.02;

export interface WallRunOpening {
  partId: string;
  startBay: number;
}

export interface WallRunPlacement {
  partId: string;
  /** offset along the run, metres */
  xM: number;
  /** X scale for the cut panel (1 otherwise, omitted) */
  scaleX?: number;
  /** bay index on the 1200mm grid (full panels and openings; absent on cuts) */
  bay?: number;
}

export interface WallRunResult {
  placements: WallRunPlacement[];
  fullPanels: number;
  /** null when the run divides evenly into 1200mm bays */
  cutPanelWidthM: number | null;
}

export function getPart(manifest: Manifest, id: string): ManifestPart {
  const part = manifest.parts.find((p) => p.id === id);
  if (!part) throw new AssemblyError(`part "${id}" not in manifest`);
  return part;
}

/**
 * Tile one wall run of `runM` metres. Openings are given as bay indices on
 * the full-panel grid; each consumes `replacesBays` bays from the manifest.
 */
export function tileWallRun(
  runM: number,
  openings: WallRunOpening[],
  manifest: Manifest,
): WallRunResult {
  if (!(runM > 0)) throw new AssemblyError(`wall run must be positive, got ${runM}`);

  const step = getPart(manifest, WALL_PANEL_ID).tileStepM;
  if (!step) throw new AssemblyError(`${WALL_PANEL_ID} has no tileStepM`);

  // Guard float noise: 4.8 / 1.2 must be exactly 4 bays.
  const rawBays = runM / step;
  const fullPanels = Math.abs(rawBays - Math.round(rawBays)) < 1e-9
    ? Math.round(rawBays)
    : Math.floor(rawBays);
  let remainder = runM - fullPanels * step;
  if (remainder < MIN_CUT_M) remainder = 0;

  // Which bays does each opening cover?
  const covered = new Map<number, WallRunOpening>(); // bay index → owning opening (only at startBay)
  const occupied = new Set<number>();
  for (const opening of openings) {
    const part = getPart(manifest, opening.partId);
    const bays = part.replacesBays;
    if (!bays) {
      throw new AssemblyError(
        `opening "${opening.partId}" has no replacesBays in the manifest`,
      );
    }
    if (opening.startBay < 0 || opening.startBay + bays > fullPanels) {
      throw new AssemblyError(
        `opening "${opening.partId}" at bay ${opening.startBay} (${bays} bay(s)) does not fit a ${fullPanels}-bay run — openings snap to full 1200mm bays only`,
      );
    }
    for (let b = opening.startBay; b < opening.startBay + bays; b++) {
      if (occupied.has(b)) {
        throw new AssemblyError(
          `openings overlap at bay ${b} on a ${fullPanels}-bay run`,
        );
      }
      occupied.add(b);
    }
    covered.set(opening.startBay, opening);
  }

  const placements: WallRunPlacement[] = [];
  for (let bay = 0; bay < fullPanels; bay++) {
    const opening = covered.get(bay);
    if (opening) {
      placements.push({ partId: opening.partId, xM: bay * step, bay });
    } else if (!occupied.has(bay)) {
      placements.push({ partId: WALL_PANEL_ID, xM: bay * step, bay });
    }
    // bays occupied by (but not starting) an opening emit nothing
  }
  if (remainder > 0) {
    placements.push({
      partId: WALL_CUT_ID,
      xM: fullPanels * step,
      scaleX: remainder / step,
    });
  }

  return {
    placements,
    fullPanels,
    cutPanelWidthM: remainder > 0 ? remainder : null,
  };
}
