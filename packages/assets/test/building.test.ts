import { describe, expect, it } from "vitest";
import { assembleBuilding, loadManifest, AssemblyError } from "@atom/assets";

const manifest = loadManifest();

describe("building assembly — 6×3 office (Zinfra site office, FFL 765)", () => {
  const r = assembleBuilding({ lengthM: 6, widthM: 3, ffl_mm: 765 }, manifest);

  it("tiles walls: 14 full panels + 2 cut panels, matching the shop drawing", () => {
    // [RhinoSite 6x3 panel set: 16 panels — #1–5 and #12–16 full on the long
    //  walls, #6–9 full on the ends, #10 and #11 "CUTTED" to 500]
    // Long walls run the full 6.0m = 5 × 1200 exactly.
    // End walls fit BETWEEN them: 3.0 − 2×0.05 = 2.9m = 2 × 1200 + 500 cut.
    expect(r.counts["panel-wall-1200"]).toBe(14);
    expect(r.counts["panel-wall-cut"]).toBe(2);
    expect(r.placements.filter((p) => p.partId === "panel-wall-1200")).toHaveLength(14);
  });

  it("cuts the end-wall closer panel to 500mm as drawn", () => {
    const cut = r.placements.find((p) => p.partId === "panel-wall-cut")!;
    // scale is a fraction of the 1200 bay → 500/1200
    expect(cut.scale![0] * 1.2).toBeCloseTo(0.5, 9);
  });

  it("places 4 corner flashings and no tee joins (single module)", () => {
    expect(r.counts["flashing-corner"]).toBe(4);
    expect(r.counts["flashing-tee-join"]).toBeUndefined();
  });

  it("places 6 footings scaled to FFL − floor build-up", () => {
    // [Zinfra footing plan, 6x3: 804/2200/2200/804 → 3 positions × 2 bearer lines]
    expect(r.counts["footing-surefoot"]).toBe(6);
    const footing = r.placements.find((p) => p.partId === "footing-surefoot")!;
    // 765 − 243 build-up = 522mm block on a 300mm base part
    // (drawing states 521 — 1mm is drawing rounding)
    expect(footing.scale![1]).toBeCloseTo(0.522 / 0.3, 6);
    expect(footing.position[1]).toBeCloseTo(-0.765, 9);
  });

  it("roofs the module: ceil(6/0.76) = 8 sheets, one gutter run, one downpipe", () => {
    expect(r.counts["roof-sheet-skillion"]).toBe(8);
    expect(r.counts["barge-gutter-section"]).toBe(5); // ceil(6/1.2)
    expect(r.counts["downpipe"]).toBe(1);
  });
});

describe("building assembly — multi-module (6×6, two modules)", () => {
  const r = assembleBuilding({ lengthM: 6, widthM: 6, ffl_mm: 535 }, manifest);

  it("inserts tee-join covers at the module join (both end walls)", () => {
    expect(r.counts["flashing-tee-join"]).toBe(2);
  });

  it("doubles module-repeated parts: 12 footings, 2 roof rows, 2 downpipes", () => {
    expect(r.counts["footing-surefoot"]).toBe(12);
    expect(r.counts["roof-sheet-skillion"]).toBe(16); // 8 per module row
    expect(r.counts["downpipe"]).toBe(2);
  });
});

describe("building assembly — openings and limits", () => {
  it("wall openings reduce panel counts on the right elevation", () => {
    const withDoor = assembleBuilding(
      {
        lengthM: 6,
        widthM: 3,
        ffl_mm: 765,
        openings: [
          { elevation: "south", partId: "door-920-single", startBay: 2 },
          { elevation: "north", partId: "window-sliding-1175", startBay: 0 },
        ],
      },
      manifest,
    );
    expect(withDoor.counts["panel-wall-1200"]).toBe(12); // 14 − 2 swapped bays
    expect(withDoor.counts["door-920-single"]).toBe(1);
    expect(withDoor.counts["window-sliding-1175"]).toBe(1);
  });

  it("an FFL beyond the footing's scalable max is a hard error", () => {
    expect(() =>
      assembleBuilding({ lengthM: 6, widthM: 3, ffl_mm: 2000 }, manifest),
    ).toThrow(AssemblyError);
  });
});
