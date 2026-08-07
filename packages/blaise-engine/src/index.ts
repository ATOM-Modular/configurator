/**
 * @atom/blaise-engine — pure TypeScript pricing engine.
 *
 * No React. No DOM. No I/O. The catalog is passed IN — the engine never
 * reads files or the network. SERVER-ONLY: never imported by the public
 * configurator app (ESLint boundary + CI grep).
 */
import type { CatalogData } from "@atom/catalog";
import type {
  BuildingConfig,
  EstimateWarning,
  InternalBuildingEstimate,
  InternalEstimate,
  PricedEstimate,
  PriceRequest,
  PublicEstimate,
  SiteConfig,
} from "@atom/contracts";
import { PricingValidationError } from "./errors.js";
import { sizeAcForRooms } from "./rules/ac.js";
import { chassisSku } from "./rules/chassis.js";
import { hwsSku } from "./rules/hws.js";
import { moduleCount, perimeterLm, teeJoinCount } from "./rules/modules.js";
import { toPublic } from "./serialize.js";
import { round2, type CostedLine } from "./types.js";
import { resolveSku, validateSite } from "./validate.js";

export { PricingValidationError } from "./errors.js";
export { toPublic } from "./serialize.js";
export {
  moduleCount,
  teeJoinCount,
  SINGLE_MODULE_MAX_WIDTH_M,
  MODULE_WIDTH_M,
} from "./rules/modules.js";

/** Price a site and return the shape matching the requested mode. */
export function price(req: PriceRequest, catalog: CatalogData): PricedEstimate {
  const internal = priceSiteInternal(req.site, catalog);
  return req.mode === "public" ? toPublic(internal) : internal;
}

/** Convenience: always-public estimate. */
export function pricePublic(site: SiteConfig, catalog: CatalogData): PublicEstimate {
  return toPublic(priceSiteInternal(site, catalog));
}

/** Full internal estimate with cost/GP. SERVER-ONLY consumption. */
export function priceSiteInternal(
  site: SiteConfig,
  catalog: CatalogData,
): InternalEstimate {
  validateSite(site);

  const windMult = catalog.windRegionMultipliers[site.windRegion];
  if (windMult === undefined) {
    throw new PricingValidationError(
      "VALIDATION_ERROR",
      `Unknown wind region "${site.windRegion}"`,
    );
  }

  const warnings: EstimateWarning[] = [];
  const perBuilding = site.buildings.map((b) =>
    priceBuilding(b, catalog, windMult, warnings),
  );

  // Site kit
  const siteKitLines: CostedLine[] = site.siteKit.map((k) => {
    const sku = resolveSku(k.sku, catalog);
    return {
      sku: k.sku,
      label: sku.label,
      qty: k.qty,
      amount_exGst: round2(sku.sellPrice * k.qty),
      cost: round2(sku.standardCost * k.qty),
    };
  });
  const siteKit_exGst = round2(
    siteKitLines.reduce((s, l) => s + l.amount_exGst, 0),
  );
  const siteKitCost = siteKitLines.reduce((s, l) => s + l.cost, 0);

  const buildingsTotal = perBuilding.reduce((s, b) => s + b.subtotal_exGst, 0);
  const buildingsCost = perBuilding.reduce((s, b) => s + b.standardCost, 0);

  const total_exGst = round2(buildingsTotal + siteKit_exGst);
  const gst = round2(total_exGst * catalog.gstRate);
  const totalCost = round2(buildingsCost + siteKitCost);

  return {
    mode: "internal",
    total_exGst,
    gst,
    total_incGst: round2(total_exGst + gst),
    perBuilding,
    siteKit_exGst,
    warnings,
    totals: {
      standardCost: totalCost,
      gpPercent: total_exGst > 0 ? round2(((total_exGst - totalCost) / total_exGst) * 100) : 0,
      salePrice: total_exGst,
    },
  };
}

// ---------------------------------------------------------------------------

function priceBuilding(
  b: BuildingConfig,
  catalog: CatalogData,
  windMult: number,
  warnings: EstimateWarning[],
): InternalBuildingEstimate {
  const lines: CostedLine[] = [];
  const modules = moduleCount(b.widthM);
  const joins = teeJoinCount(b.widthM);
  const areaM2 = b.lengthM * b.widthM;

  const add = (
    skuId: string,
    qty: number,
    opts?: { windAffected?: boolean; labelSuffix?: string },
  ) => {
    const sku = resolveSku(skuId, catalog, b.id);
    const mult = opts?.windAffected ? windMult : 1;
    lines.push({
      sku: skuId,
      label: sku.label + (opts?.labelSuffix ?? ""),
      qty,
      amount_exGst: round2(sku.sellPrice * qty * mult),
      cost: round2(sku.standardCost * qty * mult),
    });
  };

  // --- Structure (wind-region multiplier applies — PLACEHOLDER rule) ---
  add(chassisSku(b.chassis, b.widthM), modules, { windAffected: true });
  if (joins > 0) {
    add("TEE-JOIN-KIT", joins, { windAffected: true });
    warnings.push({
      code: "MULTI_MODULE",
      message: `Building "${b.id}" is ${b.widthM}m wide → ${modules} transport modules with ${joins} tee join(s)`,
      buildingId: b.id,
    });
  }

  // External walls priced on perimeter; ceiling/flooring/power per module.
  add("PANEL-EPS-FR-50-WALL", perimeterLm(b.lengthM, b.widthM), {
    windAffected: true,
    labelSuffix: ` (${b.panels.colour})`,
  });
  add("CEILING-PANEL-MODULE", modules, { windAffected: true });
  // Width>3.4m repeats the module envelope under a single continuous roof —
  // still priced per module.
  add("ROOF-MODULE", modules, { windAffected: true });
  add("FLOOR-MODULE", modules);
  add("POWER-MODULE", modules);

  // Gutters/downpipes default ON; removal adds STORMWATER_RISK.
  if (b.flags?.gutters !== false) {
    add("GUTTER-DOWNPIPE-SET", modules);
  } else {
    warnings.push({
      code: "STORMWATER_RISK",
      message: `Building "${b.id}" configured without gutters/downpipes — stormwater management is the client's responsibility`,
      buildingId: b.id,
    });
  }

  // --- AC: per room/zone, never whole floor; bracket per split unit ---
  const ac = sizeAcForRooms(b);
  warnings.push(...ac.warnings);
  for (const unit of ac.units) add(unit.sku, 1);
  if (ac.units.length > 0) add("AC-CONDENSER-BRACKET", ac.units.length);

  // --- Fitout (doors, windows, bathrooms, kitchens, explicit HWS...) ---
  for (const f of b.fitout) add(f.sku, f.qty);

  // --- HWS auto-included on wet/kitchen builds ---
  const autoHws = hwsSku(b);
  if (autoHws) add(autoHws, 1, { labelSuffix: " (auto-included)" });

  // --- "Others" component always included ---
  add("OTHERS", 1);

  const subtotal_exGst = round2(lines.reduce((s, l) => s + l.amount_exGst, 0));
  const standardCost = round2(lines.reduce((s, l) => s + l.cost, 0));

  return {
    id: b.id,
    subtotal_exGst,
    // Public-safe lines only carry label/qty/amount/sku — cost is stripped here,
    // and toPublic() re-strips defensively.
    lines: lines.map((l) => ({
      label: l.label,
      qty: l.qty,
      amount_exGst: l.amount_exGst,
      ...(l.sku !== undefined ? { sku: l.sku } : {}),
    })),
    standardCost,
    gpPercent:
      subtotal_exGst > 0
        ? round2(((subtotal_exGst - standardCost) / subtotal_exGst) * 100)
        : 0,
    salePrice: subtotal_exGst,
    costPerSqm: areaM2 > 0 ? round2(standardCost / areaM2) : 0,
    pricePerSqm: areaM2 > 0 ? round2(subtotal_exGst / areaM2) : 0,
  };
}
