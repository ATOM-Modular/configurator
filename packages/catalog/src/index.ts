/**
 * @atom/catalog — versioned rate catalog, exported from Blaise.
 *
 * SERVER-ONLY. Never import from apps/configurator (enforced by ESLint
 * boundary rule + CI bundle grep).
 *
 * data/catalog.v1.json is generated — never hand-edit rates. Placeholder
 * rates are flagged with `placeholder: true` at both catalog and SKU level.
 */
import catalogV1 from "../data/catalog.v1.json";

export interface CatalogSku {
  label: string;
  unit: string;
  standardCost: number;
  sellPrice: number;
  placeholder?: boolean;
}

export interface CatalogData {
  version: string;
  placeholder: boolean;
  gstRate: number;
  /** Blaise cost-plus margin (Subtotal = TotalCost / (1 − GP)). Server-only. */
  grossProfitMargin: number;
  windRegionMultipliers: Record<string, number>;
  skus: Record<string, CatalogSku>;
}

const catalog = catalogV1 as unknown as CatalogData;

/** The current catalog. Swapping in a real Blaise export = replacing the JSON file. */
export function loadCatalog(): CatalogData {
  return catalog;
}

export const catalogVersion = catalog.version;
