import { describe, expect, it } from "vitest";
import {
  footingSchedule,
  footprint,
  moduleCount,
  overlaps,
  totalFootings,
  walkwayGeometry,
  type PlacedBuilding,
} from "../src/site/geometry";

const b = (
  id: string,
  xM: number,
  zM: number,
  lengthM = 6,
  widthM = 3,
  rotationDeg = 0,
  ffl_mm = 450,
): PlacedBuilding => ({
  id,
  lengthM,
  widthM,
  ffl_mm,
  placement: { xM, zM, rotationDeg },
});

describe("footprints", () => {
  it("is length × width at 0°", () => {
    expect(footprint(b("a", 2, 1))).toEqual({ x0: 2, x1: 8, z0: 1, z1: 4 });
  });

  it("swaps axes at 90° and 270°", () => {
    expect(footprint(b("a", 0, 0, 6, 3, 90))).toEqual({ x0: 0, x1: 3, z0: 0, z1: 6 });
    expect(footprint(b("a", 0, 0, 6, 3, 270))).toEqual({ x0: 0, x1: 3, z0: 0, z1: 6 });
  });

  it("detects overlap", () => {
    expect(overlaps(footprint(b("a", 0, 0)), footprint(b("b", 3, 1)))).toBe(true);
    expect(overlaps(footprint(b("a", 0, 0)), footprint(b("b", 10, 0)))).toBe(false);
  });
});

describe("walkway geometry", () => {
  it("spans the clear gap along X when Z ranges overlap", () => {
    const link = walkwayGeometry(b("a", 0, 0), b("b", 10, 0))!;
    expect(link.axis).toBe("x");
    expect(link.gapM).toBeCloseTo(4, 9); // 10 − 6
    expect(link.origin[0]).toBeCloseTo(6, 9);
    expect(link.overlapM).toBeCloseTo(3, 9);
  });

  it("is symmetric in argument order", () => {
    const ab = walkwayGeometry(b("a", 0, 0), b("b", 10, 0))!;
    const ba = walkwayGeometry(b("b", 10, 0), b("a", 0, 0))!;
    expect(ba.gapM).toBeCloseTo(ab.gapM, 9);
    expect(ba.origin).toEqual(ab.origin);
  });

  it("spans along Z when X ranges overlap", () => {
    const link = walkwayGeometry(b("a", 0, 0), b("b", 0, 9))!;
    expect(link.axis).toBe("z");
    expect(link.gapM).toBeCloseTo(6, 9); // 9 − 3
    expect(link.origin[2]).toBeCloseTo(3, 9);
  });

  it("centres the run within the overlapping span", () => {
    // 6m-long buildings facing along Z: overlap 6m, walkway 2.4m wide
    const link = walkwayGeometry(b("a", 0, 0), b("b", 0, 9))!;
    expect(link.origin[0]).toBeCloseTo((6 - 2.4) / 2, 9);
  });

  it("returns null for diagonal or overlapping buildings", () => {
    expect(walkwayGeometry(b("a", 0, 0), b("b", 12, 12))).toBeNull();
    expect(walkwayGeometry(b("a", 0, 0), b("b", 3, 1))).toBeNull();
  });

  it("returns null for touching buildings (no gap to span)", () => {
    expect(walkwayGeometry(b("a", 0, 0), b("b", 6, 0))).toBeNull();
  });
});

describe("footing schedule", () => {
  it("derives height from FFL − floor build-up and real footing spacing", () => {
    // [Zinfra footing schedule; Central Darling 12x9 footing plan]
    const rows = footingSchedule([
      { ...b("office", 0, 0, 6, 3, 0, 765), name: "Site Office" },
      { ...b("wide", 0, 0, 9, 6, 0, 535), name: "Wide" },
    ]);
    expect(rows[0]).toMatchObject({
      name: "Site Office",
      ffl_mm: 765,
      footingHeightMm: 522, // 765 − 243
      modules: 1,
      footingCount: 6, // 3 positions × 2 bearer lines
    });
    // 9m long → 4 positions → 8 per block; 6m wide → 2 blocks
    expect(rows[1]).toMatchObject({ modules: 2, footingCount: 16, footingHeightMm: 292 });
    expect(totalFootings(rows)).toBe(22);
  });

  it("matches the drawn footing counts for real building lengths", () => {
    const lengths: [number, number][] = [
      [4.8, 6], // [Zinfra M/F toilet: 604/1800/1800/604]
      [6.0, 6], // [Zinfra 6x3:        804/2200/2200/804]
      [12.0, 10], // [Central Darling:   808/2600×4/808]
    ];
    for (const [lengthM, expected] of lengths) {
      const [row] = footingSchedule([
        { ...b("x", 0, 0, lengthM, 3), name: `${lengthM}m` },
      ]);
      expect(row!.footingCount, `${lengthM}m block`).toBe(expected);
    }
  });

  it("module count matches the engine rule", () => {
    expect(moduleCount(3)).toBe(1);
    expect(moduleCount(3.4)).toBe(1);
    expect(moduleCount(6)).toBe(2);
  });
});
