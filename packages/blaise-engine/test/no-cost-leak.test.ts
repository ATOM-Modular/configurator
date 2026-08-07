/**
 * CONTRACT TEST — SPEC Security rule #2.
 *
 * Serialize a public /price response and assert no cost/GP field exists at
 * ANY depth. This is the runtime backstop behind the compile-time split of
 * PublicEstimate vs InternalEstimate.
 */
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@atom/catalog";
import { pricePublic, priceSiteInternal, toPublic } from "@atom/blaise-engine";
import { office6x3, toilet48x3, site } from "./fixtures.js";

const catalog = loadCatalog();

const FORBIDDEN_KEYS = [
  "standardCost",
  "gpPercent",
  "costPerSqm",
  "pricePerSqm",
  "salePrice",
  "cost",
  "totals",
  "margin",
  "markup",
];

const FORBIDDEN_STRINGS = ["standardCost", "gpPercent", "costPerSqm"];

function collectKeysDeep(value: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const v of value) collectKeysDeep(v, out);
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out.add(k);
      collectKeysDeep(v, out);
    }
  }
  return out;
}

describe("no-cost-leak contract", () => {
  const fullSite = site([office6x3(), toilet48x3()], {
    siteKit: [
      { sku: "WALKWAY-BAY-ELEV", qty: 3 },
      { sku: "WASTETANK-4000", qty: 1 },
      { sku: "MACERATOR-PUMP", qty: 2 },
    ],
  });

  it("public estimate contains no forbidden key at any depth", () => {
    const pub = pricePublic(fullSite, catalog);
    const keys = collectKeysDeep(JSON.parse(JSON.stringify(pub)));
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys.has(forbidden), `found forbidden key "${forbidden}"`).toBe(false);
    }
  });

  it("serialized public JSON contains no forbidden strings", () => {
    const raw = JSON.stringify(pricePublic(fullSite, catalog));
    for (const s of FORBIDDEN_STRINGS) {
      expect(raw.includes(s), `serialized output contains "${s}"`).toBe(false);
    }
  });

  it("toPublic() strips a full internal estimate", () => {
    const internal = priceSiteInternal(fullSite, catalog);
    // sanity: the internal estimate DOES carry the fields...
    expect(internal.perBuilding[0]!.standardCost).toBeGreaterThan(0);
    expect(internal.totals.gpPercent).toBeGreaterThan(0);
    // ...and the public projection carries none of them
    const keys = collectKeysDeep(JSON.parse(JSON.stringify(toPublic(internal))));
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(keys.has(forbidden), `found forbidden key "${forbidden}"`).toBe(false);
    }
  });

  it("public and internal totals agree (stripping changes shape, not numbers)", () => {
    const internal = priceSiteInternal(fullSite, catalog);
    const pub = toPublic(internal);
    expect(pub.total_exGst).toBe(internal.total_exGst);
    expect(pub.gst).toBe(internal.gst);
    expect(pub.total_incGst).toBe(internal.total_incGst);
    expect(pub.perBuilding.map((b) => b.subtotal_exGst)).toEqual(
      internal.perBuilding.map((b) => b.subtotal_exGst),
    );
  });
});
