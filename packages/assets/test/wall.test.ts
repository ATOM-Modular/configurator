import { describe, expect, it } from "vitest";
import { loadManifest, tileWallRun, WALL_CUT_ID, WALL_PANEL_ID, AssemblyError } from "@atom/assets";

const manifest = loadManifest();
const panels = (r: ReturnType<typeof tileWallRun>) =>
  r.placements.filter((p) => p.partId === WALL_PANEL_ID).length;
const cuts = (r: ReturnType<typeof tileWallRun>) =>
  r.placements.filter((p) => p.partId === WALL_CUT_ID).length;

describe("wall tiling — part counts", () => {
  // NOTE: SPEC's M2 example says "6m wall = 5× 1200 panels + 1× cut panel",
  // but 5 × 1.2m = 6.0m exactly — a zero-width cut. We implement clean
  // modulo semantics (no sliver panels); flagged to Duane for confirmation.
  it("6.0m run = 5 full panels, no cut", () => {
    const r = tileWallRun(6.0, [], manifest);
    expect(r.fullPanels).toBe(5);
    expect(panels(r)).toBe(5);
    expect(cuts(r)).toBe(0);
    expect(r.cutPanelWidthM).toBeNull();
  });

  it("5.0m run = 4 full panels + one 0.2m cut", () => {
    const r = tileWallRun(5.0, [], manifest);
    expect(panels(r)).toBe(4);
    expect(cuts(r)).toBe(1);
    expect(r.cutPanelWidthM).toBeCloseTo(0.2, 9);
    const cut = r.placements.find((p) => p.partId === WALL_CUT_ID)!;
    expect(cut.xM).toBeCloseTo(4.8, 9);
    expect(cut.scaleX).toBeCloseTo(0.2 / 1.2, 9);
  });

  it("4.8m run divides exactly despite float division (no phantom cut)", () => {
    const r = tileWallRun(4.8, [], manifest);
    expect(panels(r)).toBe(4);
    expect(cuts(r)).toBe(0);
  });

  it("3.0m run = 2 full panels + 0.6m cut", () => {
    const r = tileWallRun(3.0, [], manifest);
    expect(panels(r)).toBe(2);
    expect(r.cutPanelWidthM).toBeCloseTo(0.6, 9);
  });
});

describe("wall tiling — opening swaps (no CSG)", () => {
  it("a 920 door swaps out exactly one bay of a 6m run", () => {
    const r = tileWallRun(6.0, [{ partId: "door-920-single", startBay: 2 }], manifest);
    expect(panels(r)).toBe(4);
    const door = r.placements.find((p) => p.partId === "door-920-single")!;
    expect(door.xM).toBeCloseTo(2.4, 9);
    expect(r.placements).toHaveLength(5); // 4 panels + door
  });

  it("a double door swaps out two bays", () => {
    const r = tileWallRun(6.0, [{ partId: "door-1600-double", startBay: 0 }], manifest);
    expect(panels(r)).toBe(3);
    expect(r.placements).toHaveLength(4); // 3 panels + 1 double door
  });

  it("openings snap to full bays — the cut region is not placeable", () => {
    // 5m run has 4 full bays (0–3); bay 4 would sit in the 0.2m cut
    expect(() =>
      tileWallRun(5.0, [{ partId: "door-920-single", startBay: 4 }], manifest),
    ).toThrow(AssemblyError);
  });

  it("overlapping openings throw", () => {
    expect(() =>
      tileWallRun(6.0, [
        { partId: "door-1600-double", startBay: 1 },
        { partId: "window-sliding-1175", startBay: 2 },
      ], manifest),
    ).toThrow(/overlap/);
  });
});
