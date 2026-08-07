import { describe, expect, it } from "vitest";
import { assembleWalkway, loadManifest } from "@atom/assets";

const manifest = loadManifest();

describe("walkway assembly", () => {
  it("tiles bays to cover the gap and auto-counts posts", () => {
    const r = assembleWalkway({ gapM: 3.5 }, manifest);
    expect(r.bays).toBe(2); // ceil(3.5 / 1.8)
    expect(r.posts).toBe(6); // (2 + 1) frames × 2
    expect(r.counts["rapta-walkway-bay"]).toBe(2);
  });

  it("an exact single bay uses one bay and four posts", () => {
    const r = assembleWalkway({ gapM: 1.8 }, manifest);
    expect(r.bays).toBe(1);
    expect(r.posts).toBe(4);
  });

  it("bays tile along the requested axis", () => {
    const r = assembleWalkway({ gapM: 3.6, origin: [10, 0, 5], rotationYDeg: 90 }, manifest);
    expect(r.placements[0]!.position).toEqual([10, 0, 5]);
    expect(r.placements[1]!.position).toEqual([10, 0, 6.8]);
  });
});
