import type { DerivedRoom } from "../../state/store";

/** External wall panel thickness (m) from the real config value. */
export const wallThicknessM = (panelMm: number) => panelMm / 1000;

/**
 * Drawn/room partition thickness (m). TODO(mfg-dim): the GA plan calls cubicle
 * partitions at 18mm and structural partitions at ~50mm; the configurator does
 * not yet model a per-partition spec, so we render an abstracted 50mm. Replace
 * with the real partition schedule value when it lands.
 */
export const PARTITION_THICKNESS_M = 0.05;

export interface DimSeg {
  x0: number;
  x1: number;
  mid: number;
  /** millimetres, integer */
  mm: number;
  /** true ⇒ this segment is a wall/partition thickness call-out */
  thickness: boolean;
}

/**
 * Chained dimension string across the length: external faces at 0 and L, each
 * room partition called out individually (its thickness as its own segment),
 * matching the GA plan's stacked "900 / 18 / 900 …" style.
 */
export function lengthDimChain(
  lengthM: number,
  partitionsX: number[],
  partitionT: number,
): DimSeg[] {
  const faces: { x: number; thickness: boolean }[] = [{ x: 0, thickness: false }];
  for (const px of [...partitionsX].sort((a, b) => a - b)) {
    faces.push({ x: px - partitionT / 2, thickness: true });
    faces.push({ x: px + partitionT / 2, thickness: false });
  }
  faces.push({ x: lengthM, thickness: false });

  const segs: DimSeg[] = [];
  for (let i = 0; i < faces.length - 1; i++) {
    const x0 = faces[i]!.x;
    const x1 = faces[i + 1]!.x;
    if (x1 - x0 < 1e-4) continue;
    segs.push({
      x0,
      x1,
      mid: (x0 + x1) / 2,
      mm: Math.round((x1 - x0) * 1000),
      thickness: faces[i + 1]!.thickness, // the segment ending at a partition face is the thickness one
    });
  }
  return segs;
}

const WET_RE = /(toilet|shower|wc|bath|ablution|amenit|accessible|laundry|wet|urinal)/i;

/** Wet (waterproofed) rooms get the cross-hatch, keyed to the room name/use. */
export function isWetRoom(room: DerivedRoom, buildingUse: string): boolean {
  if (WET_RE.test(room.name)) return true;
  // a default-named room in an amenities building is wet unless clearly dry
  if (/toilet|amenit/i.test(buildingUse)) return !/clean|store|office|plant/i.test(room.name);
  return false;
}

/** Uppercase room label (GA convention). */
export const roomLabel = (name: string) => name.toUpperCase();
