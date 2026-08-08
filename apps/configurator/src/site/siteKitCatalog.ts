/** Placeable site-kit items: label + Blaise SKU + manifest part (3D). */
export interface SiteKitDef {
  sku: string;
  partId: string;
  label: string;
  /** plan footprint, metres */
  sizeM: [number, number];
}

export const SITE_KIT_CATALOG: SiteKitDef[] = [
  { sku: "STEPS-SINGLE", partId: "steps-single-width", label: "Steps (single)", sizeM: [1.0, 1.6] },
  { sku: "STEPS-DOUBLE", partId: "steps-double-width", label: "Steps (double)", sizeM: [2.0, 1.6] },
  { sku: "BALUSTRADE-1250", partId: "balustrade-1250", label: "Balustrade 1250", sizeM: [1.25, 0.1] },
  { sku: "BALUSTRADE-3000", partId: "balustrade-3000", label: "Balustrade 3000", sizeM: [3.0, 0.1] },
  { sku: "TANK-5000", partId: "tank-5000", label: "Water tank 5000L", sizeM: [1.9, 1.9] },
  { sku: "WATERSKID-1000", partId: "waterskid-1000", label: "Water skid 1000L", sizeM: [2.4, 1.2] },
  { sku: "WASTETANK-4000", partId: "wastetank-4000", label: "Waste tank 4000L", sizeM: [2.4, 1.8] },
  { sku: "MACERATOR-PUMP", partId: "macerator-pump", label: "Macerator pump", sizeM: [0.5, 0.4] },
];

export function siteKitDef(sku: string): SiteKitDef | undefined {
  return SITE_KIT_CATALOG.find((d) => d.sku === sku);
}
