/**
 * Alignment snapping for the 2D editor. Given a point and candidate snap
 * lines (X positions and Z positions gathered from the shell edges, walls and
 * other objects), snap each axis to the nearest line within a threshold and
 * report which guide fired so the editor can draw it.
 */
export interface SnapResult {
  x: number;
  z: number;
  guideX: number | null;
  guideZ: number | null;
}

function nearest(v: number, lines: number[], thr: number): number | null {
  let best: number | null = null;
  let bestD = thr;
  for (const l of lines) {
    const d = Math.abs(l - v);
    if (d <= bestD) {
      bestD = d;
      best = l;
    }
  }
  return best;
}

export function snapToGuides(
  x: number,
  z: number,
  xLines: number[],
  zLines: number[],
  thr: number,
): SnapResult {
  const gx = nearest(x, xLines, thr);
  const gz = nearest(z, zLines, thr);
  return { x: gx ?? x, z: gz ?? z, guideX: gx, guideZ: gz };
}
