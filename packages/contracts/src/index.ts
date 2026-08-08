/**
 * @atom/contracts — TYPES ONLY.
 *
 * This package is importable by BOTH the public configurator app and the
 * server-side pricing stack. It must never contain rate values, catalog
 * data, or pricing logic — only the request/response shapes.
 *
 * Security note: PublicEstimate and InternalEstimate are deliberately
 * SEPARATE interfaces (not one interface with optional cost fields) so the
 * engine's toPublic() serializer is compile-time-checked to never carry a
 * cost/GP field into a public response.
 */

// ---------------------------------------------------------------------------
// Config (request) types
// ---------------------------------------------------------------------------

export type WindRegion = "AB" | "C" | "D";
export type Mode = "internal" | "public";
export type Chassis = "office" | "toilet";

export type BuildingUse =
  | "Office"
  | "Lunchroom"
  | "Toilet & Amenities"
  | "Accommodation"
  | "Lab"
  | "Classroom";

export interface PanelSpec {
  /** Panel system, e.g. "EPS-FR" (default) */
  type: string;
  /** Wall panel thickness in mm, 50 default */
  wallMm: number;
  /** Ceiling panel thickness in mm */
  ceilingMm: number;
  /** Colorbond colour name, e.g. "Surfmist" (default) */
  colour: string;
}

export interface Room {
  id: string;
  name?: string;
  use?: string;
  /** Derived from the partition layout; if absent, engine assumes an equal share of floor area. */
  areaM2?: number;
  /** Manual AC size override — engine emits an AC_OVERRIDE warning when set. */
  acOverrideKw?: number;
}

export interface FitoutLine {
  sku: string;
  qty: number;
  roomId?: string;
}

export interface BuildingFlags {
  /** Accessible (DDA) sets are only priceable when this is true. */
  dda?: boolean;
  /** Gutters/downpipes default ON. Setting false adds a STORMWATER_RISK warning. */
  gutters?: boolean;
  /** Colourbond roof upgrade (Blaise "Colourbond Roof"). */
  colourbondRoof?: boolean;
}

export interface BuildingPlacement {
  xM: number;
  yM: number;
  rotationDeg: 0 | 90 | 180 | 270;
}

export interface BuildingConfig {
  id: string;
  use: BuildingUse | string;
  lengthM: number;
  /** width > 3.4 ⇒ engine splits into 3m transport modules + tee-section joints */
  widthM: number;
  ffl_mm: number;
  chassis: Chassis;
  panels: PanelSpec;
  rooms: Room[];
  fitout: FitoutLine[];
  flags?: BuildingFlags;
  /** Site-mode placement (M4). Ignored by pricing. */
  placement?: BuildingPlacement;
}

export interface SiteKitLine {
  sku: string;
  qty: number;
  meta?: Record<string, unknown>;
}

export interface SiteConfig {
  windRegion: WindRegion;
  buildings: BuildingConfig[];
  siteKit: SiteKitLine[];
}

export interface PriceRequest {
  mode: Mode;
  site: SiteConfig;
}

// ---------------------------------------------------------------------------
// Estimate (response) types
// ---------------------------------------------------------------------------

export interface PriceLine {
  label: string;
  qty: number;
  amount_exGst: number;
  sku?: string;
}

export type WarningCode =
  | "STORMWATER_RISK"
  | "AC_OVERRIDE"
  | "MANUAL_PRICE_REQUIRED"
  | "MULTI_MODULE"
  // eslint-disable-next-line @typescript-eslint/ban-types -- `string & {}` preserves literal autocomplete while allowing engine-defined codes
  | (string & {});

export interface EstimateWarning {
  code: WarningCode;
  message: string;
  buildingId?: string;
}

export interface PublicBuildingEstimate {
  id: string;
  subtotal_exGst: number;
  lines: PriceLine[];
}

export interface PublicEstimate {
  mode: "public";
  total_exGst: number;
  gst: number;
  total_incGst: number;
  perBuilding: PublicBuildingEstimate[];
  siteKit_exGst: number;
  warnings: EstimateWarning[];
}

/** INTERNAL ONLY — never serialized to public callers. */
export interface InternalBuildingEstimate extends PublicBuildingEstimate {
  standardCost: number;
  gpPercent: number;
  salePrice: number;
  costPerSqm: number;
  pricePerSqm: number;
}

/** INTERNAL ONLY — never serialized to public callers. */
export interface InternalEstimate
  extends Omit<PublicEstimate, "mode" | "perBuilding"> {
  mode: "internal";
  perBuilding: InternalBuildingEstimate[];
  totals: {
    standardCost: number;
    gpPercent: number;
    salePrice: number;
  };
}

export type PricedEstimate = PublicEstimate | InternalEstimate;

// ---------------------------------------------------------------------------
// Error shape for hard validation failures (unknown SKU / $0 line)
// ---------------------------------------------------------------------------

export interface PricingErrorBody {
  error: "MANUAL_PRICE_REQUIRED" | "VALIDATION_ERROR" | "UNAUTHORIZED";
  message: string;
  detail?: { sku?: string; buildingId?: string };
}

// Blaise pricing vocabulary (shared, boundary-safe — see packages/catalog/blaise/)
export * from "./blaise.js";
