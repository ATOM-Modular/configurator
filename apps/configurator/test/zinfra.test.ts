/**
 * M4 ACCEPTANCE — "Zinfra Craigieburn" (SPEC site-mode reference layout).
 *
 * Asserts the configurator reproduces the site: the right buildings at the
 * right FFLs, both walkways resolving to real spans, the site kit priced,
 * and the whole scene inside the 150k-triangle budget.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  assembleBuilding,
  assembleWalkway,
  getPart,
  loadManifest,
  type PlacedPart,
} from "@atom/assets";
import {
  estimateTriangles,
  footingSchedule,
  SITE_TRI_BUDGET,
  totalFootings,
  walkwayGeometry,
} from "../src/site/geometry";
import { zinfraLoaded } from "../src/site/zinfra";
import { buildSiteConfig, useConfigurator } from "../src/state/store";

const manifest = loadManifest();
const initial = useConfigurator.getState();
beforeEach(() => useConfigurator.setState(initial, true));

function loadZinfra() {
  useConfigurator.getState().loadSite(zinfraLoaded());
  return useConfigurator.getState();
}

describe("Zinfra site loads into the store", () => {
  it("switches to site mode with all four buildings", () => {
    const s = loadZinfra();
    expect(s.mode).toBe("site");
    expect(s.step).toBe(3);
    expect(s.buildings.map((b) => b.name)).toEqual([
      "Site Office",
      "M/F Toilet",
      "Lunchroom 01",
      "Lunchroom 02",
    ]);
  });

  it("carries the specified FFLs", () => {
    const s = loadZinfra();
    const ffl = Object.fromEntries(s.buildings.map((b) => [b.name, b.ffl_mm]));
    expect(ffl).toEqual({
      "Site Office": 765,
      "M/F Toilet": 1080,
      "Lunchroom 01": 535,
      "Lunchroom 02": 535,
    });
  });

  it("has two walkways, one elevated, both spanning real gaps", () => {
    const s = loadZinfra();
    expect(s.walkways).toHaveLength(2);
    expect(s.walkways.filter((w) => w.elevated)).toHaveLength(1);
    for (const w of s.walkways) {
      const from = s.buildings.find((b) => b.id === w.fromBuildingId)!;
      const to = s.buildings.find((b) => b.id === w.toBuildingId)!;
      const link = walkwayGeometry(from, to);
      expect(link, `${from.name} ↔ ${to.name} must face each other`).not.toBeNull();
      expect(link!.gapM).toBeGreaterThan(0);
    }
  });

  it("places the site kit called for in the brief", () => {
    const s = loadZinfra();
    const bySku = s.siteKit.reduce<Record<string, number>>((acc, k) => {
      acc[k.sku] = (acc[k.sku] ?? 0) + 1;
      return acc;
    }, {});
    expect(bySku["STEPS-DOUBLE"]).toBe(2);
    expect(bySku["TANK-5000"]).toBe(1);
    expect(bySku["WATERSKID-1000"]).toBe(1);
    expect(bySku["WASTETANK-4000"]).toBe(1);
    expect(bySku["MACERATOR-PUMP"]).toBe(2);
    expect(bySku["BALUSTRADE-3000"]).toBe(2);
  });
});

describe("Zinfra footing schedule", () => {
  it("derives per-building footing heights from FFL", () => {
    const s = loadZinfra();
    const rows = footingSchedule(s.buildings);
    const byName = Object.fromEntries(rows.map((r) => [r.name, r]));
    // Drawing states 521 for the elevated office and 292 for the lunchrooms;
    // FFL − 243mm build-up reproduces these to within 1mm of drawing rounding.
    expect(byName["Site Office"]!.footingHeightMm).toBe(522);
    expect(byName["M/F Toilet"]!.footingHeightMm).toBe(837);
    expect(byName["Lunchroom 01"]!.footingHeightMm).toBe(292);
    // four single-module buildings → 24 Surefoot blocks
    expect(totalFootings(rows)).toBe(24);
  });
});

describe("Zinfra pricing request", () => {
  it("prices every building plus walkway bays and site kit", () => {
    const s = loadZinfra();
    const site = buildSiteConfig(s);
    expect(site.buildings).toHaveLength(4);

    const kit = Object.fromEntries(site.siteKit.map((k) => [k.sku, k.qty]));
    // office↔toilet gap is 6m → ceil(6/1.8) = 4 elevated bays
    expect(kit["WALKWAY-BAY-ELEV"]).toBe(4);
    expect(kit["WALKWAY-BAY-STD"]).toBe(4);
    expect(kit["MACERATOR-PUMP"]).toBe(2);
    expect(kit["TANK-5000"]).toBe(1);
  });

  it("routes the toilet block to the toilet chassis and keeps wet fitout", () => {
    const s = loadZinfra();
    const site = buildSiteConfig(s);
    const toilet = site.buildings.find((b) => b.use === "Toilet & Amenities")!;
    expect(toilet.chassis).toBe("toilet");
    expect(toilet.fitout.map((f) => f.sku)).toContain("BATH-ASSY-MF-STD");
  });

  it("single-building mode prices only the active building", () => {
    loadZinfra();
    useConfigurator.getState().setMode("single");
    const site = buildSiteConfig(useConfigurator.getState());
    expect(site.buildings).toHaveLength(1);
    expect(site.siteKit).toHaveLength(0);
  });
});

describe("Zinfra render budget (SPEC: ≤150k tris on screen)", () => {
  it("stays within the site triangle budget", () => {
    const s = loadZinfra();
    const placements: PlacedPart[] = [];

    for (const b of s.buildings) {
      placements.push(
        ...assembleBuilding(
          {
            lengthM: b.lengthM,
            widthM: b.widthM,
            ffl_mm: b.ffl_mm,
            openings: b.openings.map((o) => ({
              elevation: o.elevation,
              partId: o.partId,
              startBay: o.startBay,
            })),
          },
          manifest,
        ).placements,
      );
    }

    for (const w of s.walkways) {
      const from = s.buildings.find((b) => b.id === w.fromBuildingId)!;
      const to = s.buildings.find((b) => b.id === w.toBuildingId)!;
      const link = walkwayGeometry(from, to)!;
      placements.push(...assembleWalkway({ gapM: link.gapM }, manifest).placements);
    }

    for (const k of s.siteKit) {
      placements.push({ partId: k.partId, position: [k.xM, 0, k.zM], rotationYDeg: 0 });
    }

    const tris = estimateTriangles(placements, (id) => getPart(manifest, id).triBudget);
    expect(placements.length).toBeGreaterThan(100);
    expect(tris).toBeLessThanOrEqual(SITE_TRI_BUDGET);
  });
});
