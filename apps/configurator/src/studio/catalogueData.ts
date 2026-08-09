/**
 * The one-page catalogue — every Blaise option as a draggable item, grouped
 * by Blaise category. Prices are NOT shown per card (rates are server-side);
 * the live estimate rail carries the real total.
 *
 * Item kinds decide the drop behaviour:
 *   chassis   → drag onto the SITE → creates a building of that size/type
 *   opening   → drag onto a WALL bay (building 2D) → door/window
 *   partition → drag into a building → adds an internal wall
 *   counted   → drag into a ROOM → increments a per-room count (Blaise model)
 *   sitekit   → drag onto the SITE → places site kit
 */
export type CatalogueKind = "chassis" | "opening" | "partition" | "counted" | "sitekit";

export interface CatalogueItem {
  id: string;
  label: string;
  icon: string; // tabler icon name
  kind: CatalogueKind;
  /** Blaise SKU (opening / counted / sitekit) */
  sku?: string;
  /** manifest part (opening 3D / sitekit 3D) */
  partId?: string;
  /** chassis size + type */
  lengthM?: number;
  widthM?: number;
  chassisType?: "office" | "toilet";
}

export interface CatalogueGroup {
  category: string;
  items: CatalogueItem[];
}

// Buildings are created/sized with the length + width sliders
// (studio/BuildingControls), not draggable cards.
export const CATALOGUE: CatalogueGroup[] = [
  {
    category: "Openings",
    items: [
      { id: "door-920", label: "Swing 920 door", icon: "ti-door", kind: "opening", sku: "DOOR-920-SC", partId: "door-920-single" },
      { id: "door-820", label: "Swing 820 door", icon: "ti-door", kind: "opening", sku: "DOOR-820-SC", partId: "door-820-single" },
      { id: "door-double", label: "Double door 1600", icon: "ti-door", kind: "opening", sku: "DOOR-1600-DOUBLE", partId: "door-1600-double" },
      { id: "win-slide", label: "Sliding window 1175", icon: "ti-window", kind: "opening", sku: "WINDOW-SLIDING-1175", partId: "window-sliding-1175" },
      { id: "win-fixed", label: "Fixed window 1175", icon: "ti-window", kind: "opening", sku: "WINDOW-FIXED-1175", partId: "window-fixed-1175" },
      { id: "win-toilet", label: "Toilet window 600×300", icon: "ti-window", kind: "opening", sku: "WINDOW-TOILET-600X300", partId: "window-toilet-600x300" },
    ],
  },
  {
    category: "Internal",
    items: [
      { id: "internal-wall", label: "Internal wall", icon: "ti-wall", kind: "partition" },
    ],
  },
  {
    category: "Lighting & power",
    items: [
      { id: "light", label: "LED batten light", icon: "ti-bulb", kind: "counted", sku: "LIGHT-LED-PANEL" },
      { id: "gpo", label: "Double GPO", icon: "ti-plug", kind: "counted", sku: "GPO-DOUBLE" },
      { id: "data", label: "Data point", icon: "ti-network", kind: "counted", sku: "DATA-POINT" },
    ],
  },
  {
    category: "Aircon",
    items: [
      { id: "ac-25", label: "Split 2.5kW", icon: "ti-air-conditioning", kind: "counted", sku: "AC-SPLIT-2.5" },
      { id: "ac-35", label: "Split 3.5kW", icon: "ti-air-conditioning", kind: "counted", sku: "AC-SPLIT-3.5" },
      { id: "ac-50", label: "Split 5.0kW", icon: "ti-air-conditioning", kind: "counted", sku: "AC-SPLIT-5.0" },
      { id: "ac-71", label: "Split 7.1kW", icon: "ti-air-conditioning", kind: "counted", sku: "AC-SPLIT-7.1" },
    ],
  },
  {
    category: "Bathroom",
    items: [
      { id: "pan", label: "Toilet pan", icon: "ti-bath", kind: "counted", sku: "BATH-PAN" },
      { id: "basin", label: "Basin", icon: "ti-bath", kind: "counted", sku: "BATH-BASIN" },
      { id: "shower", label: "Shower", icon: "ti-bath", kind: "counted", sku: "BATH-SHOWER" },
      { id: "urinal", label: "Urinal", icon: "ti-bath", kind: "counted", sku: "BATH-URINAL" },
      { id: "partition-cubicle", label: "Toilet partition", icon: "ti-separator", kind: "counted", sku: "BATH-PARTITION" },
      { id: "mirror", label: "Mirror 300", icon: "ti-square", kind: "counted", sku: "MIRROR-300" },
      { id: "towel", label: "Towel dispenser", icon: "ti-paper-bag", kind: "counted", sku: "TOWEL-DISPENSER" },
      { id: "exhaust", label: "Exhaust fan", icon: "ti-wind", kind: "counted", sku: "EXHAUST-FAN" },
    ],
  },
  {
    category: "Kitchen & laundry",
    items: [
      { id: "kitchen-1500", label: "Kitchenette 1500", icon: "ti-tools-kitchen-2", kind: "counted", sku: "KITCHEN-1500" },
      { id: "kitchen-2100", label: "Kitchenette 2100", icon: "ti-tools-kitchen-2", kind: "counted", sku: "KITCHEN-2100" },
      { id: "laundry-tub", label: "Laundry tub", icon: "ti-wash-machine", kind: "counted", sku: "LAUNDRY-TUB" },
      { id: "hws", label: "HWS — electric", icon: "ti-flame", kind: "counted", sku: "HWS-ELECTRIC" },
      { id: "hws-160", label: "HWS — 160L electric", icon: "ti-flame", kind: "counted", sku: "HWS-ELECTRIC-160L" },
    ],
  },
  {
    category: "Site kit",
    items: [
      { id: "kit-tank", label: "Water tank 5000L", icon: "ti-barrel", kind: "sitekit", sku: "TANK-5000", partId: "tank-5000" },
      { id: "kit-waste", label: "Waste tank 4000L", icon: "ti-barrel", kind: "sitekit", sku: "WASTETANK-4000", partId: "wastetank-4000" },
      { id: "kit-steps-d", label: "Steps (double)", icon: "ti-stairs", kind: "sitekit", sku: "STEPS-DOUBLE", partId: "steps-double-width" },
      { id: "kit-balustrade", label: "Balustrade 3000", icon: "ti-fence", kind: "sitekit", sku: "BALUSTRADE-3000", partId: "balustrade-3000" },
      { id: "kit-macerator", label: "Macerator pump", icon: "ti-pump", kind: "sitekit", sku: "MACERATOR-PUMP", partId: "macerator-pump" },
    ],
  },
];

/** A flat lookup of the SKU/label for estimate-line labelling. */
export const CATALOGUE_BY_SKU: Record<string, CatalogueItem> = Object.fromEntries(
  CATALOGUE.flatMap((g) => g.items).filter((i) => i.sku).map((i) => [i.sku!, i]),
);
