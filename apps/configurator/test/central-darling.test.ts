/**
 * TEST-DESIGN — Central Darling Shire 12x9.
 *
 * Asserts the configurator reproduces the real product as drawn:
 *   [PLAN 06.08.26] chassis "Standard Block QTY 2, SIZE 12x3m",
 *   3000 walkway between them, 13 × 600×300 windows, 5 doors,
 *   the plumbing schedule, and 20 Surefoot blocks.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "@atom/catalog";
import { price } from "@atom/blaise-engine";
import { assembleBuilding, loadManifest } from "@atom/assets";
import { centralDarlingLoaded } from "../src/site/centralDarling";
import { footingSchedule, totalFootings, walkwayGeometry } from "../src/site/geometry";
import { buildSiteConfig, useConfigurator } from "../src/state/store";

const catalog = loadCatalog();
const manifest = loadManifest();
const initial = useConfigurator.getState();
beforeEach(() => useConfigurator.setState(initial, true));

function load() {
  useConfigurator.getState().loadSite(centralDarlingLoaded());
  return useConfigurator.getState();
}

const skuQty = (fitout: { sku: string; qty: number }[], sku: string) =>
  fitout.filter((f) => f.sku === sku).reduce((n, f) => n + f.qty, 0);

describe("Central Darling — modularity matches the chassis schedule", () => {
  it("is TWO 12×3 blocks, not one 9m-wide building", () => {
    const s = load();
    expect(s.buildings).toHaveLength(2);
    for (const b of s.buildings) {
      expect(b.lengthM).toBe(12);
      expect(b.widthM).toBe(3);
    }
  });

  it("the 3m gap between blocks is the Rapta walkway shelter", () => {
    const s = load();
    const [a, b] = s.buildings;
    const link = walkwayGeometry(a!, b!)!;
    expect(link).not.toBeNull();
    expect(link.gapM).toBeCloseTo(3, 9); // 9000 = 3000 + 3000 + 3000
    expect(link.axis).toBe("z");
    expect(s.walkways).toHaveLength(1);
    // the shelter roofs the full 12m frontage: 3 × 12 = 36m²
    expect(link.overlapM).toBeCloseTo(12, 9);
    expect(link.coveredAreaM2).toBeCloseTo(36, 9);
  });

  it("overall footprint is 12000 × 9000", () => {
    const s = load();
    const xs = s.buildings.flatMap((b) => [b.placement.xM, b.placement.xM + b.lengthM]);
    const zs = s.buildings.flatMap((b) => [b.placement.zM, b.placement.zM + b.widthM]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(12, 9);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(9, 9);
  });
});

describe("Central Darling — schedules match the drawing", () => {
  it("13 × 600×300 windows and 5 doors [WINDOWS / DOOR schedules]", () => {
    const site = buildSiteConfig(load());
    const all = site.buildings.flatMap((b) => b.fitout);
    expect(skuQty(all, "WINDOW-TOILET-600X300")).toBe(13);
    expect(skuQty(all, "DOOR-820-SC") + skuQty(all, "DOOR-920-SC")).toBe(5);
    // exactly one door carries the closer (the accessible entry)
    expect(skuQty(all, "DOOR-920-SC")).toBe(1);
  });

  it("plumbing fixture counts [PLUMBING FIXTURE schedule]", () => {
    const site = buildSiteConfig(load());
    const all = site.buildings.flatMap((b) => b.fitout);
    // 6 Estilo pans + 1 accessible = 7
    expect(skuQty(all, "BATH-PAN") + skuQty(all, "BATH-ACC-TOILET")).toBe(7);
    // 7 hand basins + 1 accessible = 8
    expect(skuQty(all, "BATH-BASIN") + skuQty(all, "BATH-ACC-BASIN")).toBe(8);
    // "Shower Base 900×900: 4" + "Shower Base Rotated Left: 4" = 8 showers,
    // priced as one BATH-SHOWER line each (NOT shower + base, which would
    // double-count), plus the accessible shower.
    expect(skuQty(all, "BATH-SHOWER")).toBe(8);
    expect(skuQty(all, "BATH-SHOWER-BASE-900")).toBe(0);
    expect(skuQty(all, "BATH-ACC-SHOWER")).toBe(1);
    expect(skuQty(all, "LAUNDRY-TUB")).toBe(1);
    expect(skuQty(all, "TAP-POINT")).toBe(6);
    expect(skuQty(all, "HWS-ELECTRIC-160L")).toBe(2); // "Water Heater 160L Electric: 2"
    expect(skuQty(all, "EXHAUST-FAN")).toBe(11); // "Exhaust: 11"
    expect(skuQty(all, "MIRROR-300")).toBe(7);
    expect(skuQty(all, "TOILET-ROLL-HOLDER")).toBe(7);
    expect(skuQty(all, "TOWEL-DISPENSER")).toBe(4);
  });

  it("GPO count matches the electrical schedule (10 total)", () => {
    const site = buildSiteConfig(load());
    const all = site.buildings.flatMap((b) => b.fitout);
    expect(skuQty(all, "GPO-DOUBLE")).toBe(10);
  });

  it("accessible fixtures require the DDA flag on their block", () => {
    const s = load();
    const accessibleBlock = s.buildings.find((b) => b.name.includes("Accessible"))!;
    expect(accessibleBlock.dda).toBe(true);
    const other = s.buildings.find((b) => !b.name.includes("Accessible"))!;
    expect(other.extraFitout.some((f) => f.sku.startsWith("BATH-ACC-"))).toBe(false);
  });

  it("both blocks route to the toilet chassis tier", () => {
    const site = buildSiteConfig(load());
    for (const b of site.buildings) expect(b.chassis).toBe("toilet");
  });
});

describe("Central Darling — footings match the footing plan", () => {
  it("10 blocks per 12m chassis, 20 total [808/2600×4/808 × 2 bearer lines]", () => {
    const s = load();
    const rows = footingSchedule(s.buildings);
    for (const r of rows) expect(r.footingCount).toBe(10);
    expect(totalFootings(rows)).toBe(20);
  });

  it("assembly places the same 10 footings per block", () => {
    const s = load();
    const r = assembleBuilding(
      { lengthM: 12, widthM: 3, ffl_mm: s.buildings[0]!.ffl_mm },
      manifest,
    );
    expect(r.counts["footing-surefoot"]).toBe(10);
  });
});

describe("Central Darling — prices end to end", () => {
  it("returns a complete public estimate with no MANUAL_PRICE_REQUIRED", () => {
    const site = buildSiteConfig(load());
    const est = price({ mode: "public", site }, catalog);
    expect(est.mode).toBe("public");
    expect(est.perBuilding).toHaveLength(2);
    expect(est.total_exGst).toBeGreaterThan(0);
    // every line must carry a real amount — the engine throws otherwise,
    // but assert explicitly so a $0 rate can never slip through silently
    for (const b of est.perBuilding) {
      for (const line of b.lines) expect(line.amount_exGst).toBeGreaterThan(0);
    }
  });

  it("no AC on either block (toilet chassis)", () => {
    const site = buildSiteConfig(load());
    const est = price({ mode: "public", site }, catalog);
    const skus = est.perBuilding.flatMap((b) => b.lines.map((l) => l.sku));
    expect(skus.some((s) => s?.startsWith("AC-"))).toBe(false);
  });

  it("prices the walkway bays and the movable items list", () => {
    const site = buildSiteConfig(load());
    const kit = Object.fromEntries(site.siteKit.map((k) => [k.sku, k.qty]));
    expect(kit["WALKWAY-BAY-STD"]).toBe(2); // ceil(3.0 / 1.8)
    expect(kit["BALUSTRADE-1250"]).toBe(6); // "Rapta Balustrade: 6"
    expect(kit["WALKWAY-POST"]).toBe(2); // "Walkway Shelter Post: 2"
    expect(kit["RAPTA-STEP-2200"]).toBe(1);
    expect(kit["RAMP-1500X2400"]).toBe(1);
  });
});
