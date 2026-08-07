import { describe, expect, it } from "vitest";
import { loadCatalog } from "@atom/catalog";
import {
  price,
  priceSiteInternal,
  PricingValidationError,
  moduleCount,
  teeJoinCount,
} from "@atom/blaise-engine";
import { office6x3, toilet48x3, site } from "./fixtures.js";

const catalog = loadCatalog();

describe("module geometry rules", () => {
  it("width ≤ 3.4m is a single module", () => {
    expect(moduleCount(3.0)).toBe(1);
    expect(moduleCount(3.4)).toBe(1);
    expect(teeJoinCount(3.0)).toBe(0);
  });

  it("width > 3.4m splits into 3m modules with tee joins", () => {
    expect(moduleCount(6.0)).toBe(2);
    expect(teeJoinCount(6.0)).toBe(1);
    expect(moduleCount(9.0)).toBe(3);
    expect(teeJoinCount(9.0)).toBe(2);
  });
});

describe("fixture: 6×3 office prices end-to-end", () => {
  const est = priceSiteInternal(site([office6x3()]), catalog);
  const b = est.perBuilding[0]!;
  const skus = b.lines.map((l) => l.sku);

  it("uses the single-module office chassis tier", () => {
    expect(skus).toContain("CHASSIS-OFFICE-SINGLE");
    expect(skus).not.toContain("CHASSIS-COMPLEX");
    expect(skus).not.toContain("TEE-JOIN-KIT");
  });

  it("prices walls on perimeter (18lm) and per-module items once", () => {
    const walls = b.lines.find((l) => l.sku === "PANEL-EPS-FR-50-WALL")!;
    expect(walls.qty).toBe(18); // 2 × (6 + 3)
    expect(b.lines.find((l) => l.sku === "CEILING-PANEL-MODULE")!.qty).toBe(1);
    expect(b.lines.find((l) => l.sku === "FLOOR-MODULE")!.qty).toBe(1);
    expect(b.lines.find((l) => l.sku === "POWER-MODULE")!.qty).toBe(1);
  });

  it("includes gutters by default and the Others component always", () => {
    expect(skus).toContain("GUTTER-DOWNPIPE-SET");
    expect(skus).toContain("OTHERS");
  });

  it("adds one auto-sized AC per zone plus a condenser bracket", () => {
    // 18m² single zone → max(2.5, 18×0.15)=2.7 → 3.5kW unit
    expect(skus).toContain("AC-SPLIT-3.5");
    const bracket = b.lines.find((l) => l.sku === "AC-CONDENSER-BRACKET")!;
    expect(bracket.qty).toBe(1);
  });

  it("does NOT add HWS (dry build)", () => {
    expect(skus.some((s) => s?.startsWith("HWS-"))).toBe(false);
  });

  it("produces positive totals and internal metrics", () => {
    expect(b.subtotal_exGst).toBeGreaterThan(0);
    expect(b.standardCost).toBeGreaterThan(0);
    expect(b.gpPercent).toBeGreaterThan(0);
    expect(b.costPerSqm).toBeCloseTo(b.standardCost / 18, 1);
    expect(est.total_incGst).toBeCloseTo(est.total_exGst * 1.1, 1);
  });
});

describe("fixture: 4.8×3 toilet prices end-to-end", () => {
  const est = priceSiteInternal(site([toilet48x3()]), catalog);
  const b = est.perBuilding[0]!;
  const skus = b.lines.map((l) => l.sku);

  it("uses the single-module toilet chassis tier", () => {
    expect(skus).toContain("CHASSIS-TOILET-SINGLE");
  });

  it("prices the bathroom as an assembly", () => {
    expect(skus).toContain("BATH-ASSY-MF-STD");
  });

  it("auto-includes an electric HWS on the wet build", () => {
    expect(skus).toContain("HWS-ELECTRIC");
    expect(skus).not.toContain("HWS-GAS");
  });

  it("adds no AC to a toilet-chassis building", () => {
    expect(skus.some((s) => s?.startsWith("AC-"))).toBe(false);
  });
});

describe("engine rules", () => {
  it("multi-module: >3.4m wide gets complex chassis, tee join, MULTI_MODULE warning", () => {
    const wide = office6x3({ id: "wide-1", widthM: 6.0 });
    const est = priceSiteInternal(site([wide]), catalog);
    const skus = est.perBuilding[0]!.lines.map((l) => l.sku);
    expect(skus).toContain("CHASSIS-COMPLEX");
    expect(est.perBuilding[0]!.lines.find((l) => l.sku === "TEE-JOIN-KIT")!.qty).toBe(1);
    expect(est.warnings.some((w) => w.code === "MULTI_MODULE")).toBe(true);
  });

  it("gas HWS when showers push demand", () => {
    const showers = toilet48x3({
      id: "shower-block",
      fitout: [{ sku: "BATH-SHOWER", qty: 4 }],
    });
    const est = priceSiteInternal(site([showers]), catalog);
    const skus = est.perBuilding[0]!.lines.map((l) => l.sku);
    expect(skus).toContain("HWS-GAS");
  });

  it("removing gutters adds STORMWATER_RISK warning and drops the line", () => {
    const noGutters = office6x3({ id: "ng-1", flags: { gutters: false } });
    const est = priceSiteInternal(site([noGutters]), catalog);
    expect(est.warnings.some((w) => w.code === "STORMWATER_RISK")).toBe(true);
    expect(
      est.perBuilding[0]!.lines.some((l) => l.sku === "GUTTER-DOWNPIPE-SET"),
    ).toBe(false);
  });

  it("AC override emits AC_OVERRIDE warning", () => {
    const b = office6x3({
      id: "ovr-1",
      rooms: [{ id: "r1", areaM2: 18, acOverrideKw: 7 }],
    });
    const est = priceSiteInternal(site([b]), catalog);
    expect(est.warnings.some((w) => w.code === "AC_OVERRIDE")).toBe(true);
    expect(est.perBuilding[0]!.lines.some((l) => l.sku === "AC-SPLIT-7.1")).toBe(true);
  });

  it("unknown SKU is a hard MANUAL_PRICE_REQUIRED error, never $0", () => {
    const bad = office6x3({ id: "bad-1", fitout: [{ sku: "NOT-A-SKU", qty: 1 }] });
    expect(() => priceSiteInternal(site([bad]), catalog)).toThrowError(
      PricingValidationError,
    );
    try {
      priceSiteInternal(site([bad]), catalog);
    } catch (e) {
      expect((e as PricingValidationError).code).toBe("MANUAL_PRICE_REQUIRED");
    }
  });

  it("accessible bathroom set without DDA flag is a hard error", () => {
    const noDda = toilet48x3({
      id: "dda-1",
      fitout: [{ sku: "BATH-ASSY-ACCESSIBLE", qty: 1 }],
    });
    expect(() => priceSiteInternal(site([noDda]), catalog)).toThrow(/DDA/);

    const withDda = toilet48x3({
      id: "dda-2",
      fitout: [{ sku: "BATH-ASSY-ACCESSIBLE", qty: 1 }],
      flags: { dda: true },
    });
    expect(() => priceSiteInternal(site([withDda]), catalog)).not.toThrow();
  });

  it("wind region C scales structure lines up vs A&B", () => {
    const ab = priceSiteInternal(site([office6x3()]), catalog);
    const c = priceSiteInternal(site([office6x3()], { windRegion: "C" }), catalog);
    expect(c.total_exGst).toBeGreaterThan(ab.total_exGst);
  });

  it("site kit lines price and sum separately", () => {
    const est = priceSiteInternal(
      site([office6x3()], {
        siteKit: [
          { sku: "WALKWAY-BAY-STD", qty: 4 },
          { sku: "TANK-5000", qty: 1 },
        ],
      }),
      catalog,
    );
    expect(est.siteKit_exGst).toBeGreaterThan(0);
    expect(est.total_exGst).toBeGreaterThan(est.perBuilding[0]!.subtotal_exGst);
  });
});

describe("mode discrimination", () => {
  it("price() returns internal shape only for internal mode", () => {
    const internal = price({ mode: "internal", site: site([office6x3()]) }, catalog);
    const pub = price({ mode: "public", site: site([office6x3()]) }, catalog);
    expect(internal.mode).toBe("internal");
    expect(pub.mode).toBe("public");
    expect("totals" in pub).toBe(false);
  });
});
