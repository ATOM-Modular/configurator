/**
 * Placeholder contract: every generated part must be a drop-in for its
 * future authored GLB — correct dimensions, origin at the SW-bottom corner,
 * flagged placeholder.
 */
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { createPlaceholderPart, loadManifest } from "@atom/assets";

const manifest = loadManifest();
const TOL = 1e-6;

describe("procedural placeholders — one per manifest part", () => {
  for (const part of manifest.parts) {
    it(`${part.id}: bbox matches manifest dimensions, origin at SW-bottom`, () => {
      const group = createPlaceholderPart(part);
      expect(group.userData.placeholder).toBe(true);
      expect(group.userData.partId).toBe(part.id);
      expect(group.userData.skus).toEqual(part.skus);

      const bbox = new Box3().setFromObject(group);
      const min = bbox.min;
      const max = bbox.max;
      const d = part.dimensions;

      // origin = SW-bottom attachment corner ⇒ geometry spans [0, dim] per axis
      expect(min.distanceTo(new Vector3(0, 0, 0))).toBeLessThan(TOL);
      expect(Math.abs(max.x - d.x)).toBeLessThan(TOL);
      expect(Math.abs(max.y - d.y)).toBeLessThan(TOL);
      expect(Math.abs(max.z - d.z)).toBeLessThan(TOL);
    });
  }

  it("covers every part in the kit", () => {
    expect(manifest.parts).toHaveLength(49);
  });
});
