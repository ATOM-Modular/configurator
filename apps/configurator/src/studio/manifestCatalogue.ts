/**
 * The manifest, made browsable. Every draggable catalogue item IS a manifest
 * part (mapping to Blaise SKU[s]) — nothing draggable exists outside it, so
 * everything can price. Shared by the palette (browse) and the 2D plan
 * (labels for placed instances).
 */
import { loadManifest, type ManifestPart } from "@atom/assets";

const manifest = loadManifest();

export const MANIFEST_PARTS: ManifestPart[] = manifest.parts;
export const PART_BY_ID = new Map(manifest.parts.map((p) => [p.id, p]));

/** Human label for a placed instance / catalogue tile. */
export function partLabel(partId: string): string {
  return PART_BY_ID.get(partId)?.displayName ?? partId;
}

export interface PaletteGroup {
  category: ManifestPart["category"];
  title: string;
  parts: ManifestPart[];
}

const CATEGORY_TITLES: Record<ManifestPart["category"], string> = {
  structure: "Structure",
  opening: "Openings",
  roof: "Roof",
  service: "Fit-out & services",
  sitekit: "Site kit",
};
const CATEGORY_ORDER: ManifestPart["category"][] = [
  "opening",
  "service",
  "structure",
  "roof",
  "sitekit",
];

/** Parts grouped by category, filtered by a tag/name query. */
export function paletteGroups(query = ""): PaletteGroup[] {
  const q = query.trim().toLowerCase();
  const match = (p: ManifestPart) =>
    !q ||
    p.displayName.toLowerCase().includes(q) ||
    p.id.toLowerCase().includes(q) ||
    p.tags.some((t) => t.toLowerCase().includes(q));

  return CATEGORY_ORDER.map((category) => ({
    category,
    title: CATEGORY_TITLES[category],
    parts: MANIFEST_PARTS.filter((p) => p.category === category && match(p)),
  })).filter((g) => g.parts.length > 0);
}
