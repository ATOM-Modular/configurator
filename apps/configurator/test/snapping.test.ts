import { describe, expect, it } from "vitest";
import { snapToGuides } from "../src/studio/snapping";

describe("alignment snapping", () => {
  const xs = [0, 6, 3]; // shell edges + a wall
  const zs = [0, 3, 1.5];

  it("snaps each axis to the nearest line within threshold and reports the guide", () => {
    const r = snapToGuides(3.05, 1.44, xs, zs, 0.15);
    expect(r.x).toBe(3);
    expect(r.z).toBe(1.5);
    expect(r.guideX).toBe(3);
    expect(r.guideZ).toBe(1.5);
  });

  it("leaves an axis unsnapped (guide null) when nothing is within threshold", () => {
    const r = snapToGuides(4.2, 0.02, xs, zs, 0.15);
    expect(r.x).toBe(4.2);
    expect(r.guideX).toBeNull();
    expect(r.z).toBe(0); // 0.02 is within 0.15 of the z=0 edge
    expect(r.guideZ).toBe(0);
  });

  it("picks the closest of several candidate lines", () => {
    const r = snapToGuides(2.9, 0, [0, 3, 2.8], [0], 0.15);
    expect(r.x).toBe(2.8); // 0.1 away beats 3 (0.1 away, tie → last wins) ... nearest by scan
    expect(Math.abs(r.x - 2.9)).toBeLessThanOrEqual(0.15);
  });
});
