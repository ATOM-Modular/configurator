/**
 * Assembly output types — pure data, no three.js.
 *
 * All positions are building-local metres: origin at the building's
 * SW-bottom corner at FLOOR level (y=0 is the finished floor; footings and
 * chassis sit at negative y down to −FFL). X east, Z north (site Y maps to
 * scene Z), +Y up per glTF convention.
 */

export type RotationYDeg = 0 | 90 | 180 | 270;

export interface PlacedPart {
  partId: string;
  /** metres, building-local (part origin = its SW-bottom attachment corner) */
  position: [number, number, number];
  rotationYDeg: RotationYDeg;
  /** per-axis scale for `scalable` parts (cut panels, footings) — omit for 1:1 */
  scale?: [number, number, number];
}

export type Elevation = "south" | "east" | "north" | "west";

export interface WallOpeningSpec {
  elevation: Elevation;
  /** opening part id from the manifest, e.g. "door-920-single" */
  partId: string;
  /** 0-based index into the elevation's 1200mm full-panel bay grid */
  startBay: number;
}

export interface AssemblyResult {
  placements: PlacedPart[];
  /** partId → total count, for tests and quick sanity checks */
  counts: Record<string, number>;
}

export class AssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssemblyError";
  }
}
