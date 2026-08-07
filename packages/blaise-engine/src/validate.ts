import type { CatalogData, CatalogSku } from "@atom/catalog";
import type { BuildingConfig, SiteConfig } from "@atom/contracts";
import { PricingValidationError } from "./errors.js";

/**
 * Resolve a SKU against the catalog. Unknown SKU or a $0 rate is a HARD
 * error ("MANUAL PRICE REQUIRED") — never $0, never silent. (SPEC engine rules)
 */
export function resolveSku(
  sku: string,
  catalog: CatalogData,
  buildingId?: string,
): CatalogSku {
  const entry = catalog.skus[sku];
  if (!entry) {
    throw new PricingValidationError(
      "MANUAL_PRICE_REQUIRED",
      `MANUAL PRICE REQUIRED: unknown SKU "${sku}"`,
      buildingId !== undefined ? { sku, buildingId } : { sku },
    );
  }
  if (!(entry.sellPrice > 0) || !(entry.standardCost > 0)) {
    throw new PricingValidationError(
      "MANUAL_PRICE_REQUIRED",
      `MANUAL PRICE REQUIRED: SKU "${sku}" has a $0 rate`,
      buildingId !== undefined ? { sku, buildingId } : { sku },
    );
  }
  return entry;
}

export function validateSite(site: SiteConfig): void {
  if (!site || !Array.isArray(site.buildings) || !Array.isArray(site.siteKit)) {
    throw new PricingValidationError(
      "VALIDATION_ERROR",
      "SiteConfig must include buildings[] and siteKit[]",
    );
  }
  for (const b of site.buildings) validateBuilding(b);
  for (const k of site.siteKit) {
    if (!k.sku || !(k.qty > 0)) {
      throw new PricingValidationError(
        "VALIDATION_ERROR",
        `Site kit line has missing SKU or non-positive qty`,
        k.sku ? { sku: k.sku } : undefined,
      );
    }
  }
}

function validateBuilding(b: BuildingConfig): void {
  if (!b.id) {
    throw new PricingValidationError("VALIDATION_ERROR", "Building missing id");
  }
  if (!(b.lengthM > 0) || !(b.widthM > 0)) {
    throw new PricingValidationError(
      "VALIDATION_ERROR",
      `Building "${b.id}" has non-positive dimensions`,
      { buildingId: b.id },
    );
  }
  if (b.chassis !== "office" && b.chassis !== "toilet") {
    throw new PricingValidationError(
      "VALIDATION_ERROR",
      `Building "${b.id}" has invalid chassis "${String(b.chassis)}"`,
      { buildingId: b.id },
    );
  }
  for (const f of b.fitout) {
    if (!f.sku || !(f.qty > 0)) {
      throw new PricingValidationError(
        "VALIDATION_ERROR",
        `Building "${b.id}" fitout line has missing SKU or non-positive qty`,
        { buildingId: b.id, ...(f.sku ? { sku: f.sku } : {}) },
      );
    }
  }
  // Accessible sets only when the DDA flag is set (SPEC engine rules).
  const hasAccessible = b.fitout.some((f) => f.sku === "BATH-ASSY-ACCESSIBLE");
  if (hasAccessible && b.flags?.dda !== true) {
    throw new PricingValidationError(
      "VALIDATION_ERROR",
      `Building "${b.id}" includes an accessible bathroom set but the DDA flag is not set`,
      { buildingId: b.id, sku: "BATH-ASSY-ACCESSIBLE" },
    );
  }
}
