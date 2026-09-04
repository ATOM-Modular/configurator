/**
 * pnpm assets:check — validates manifest.json (SPEC asset conventions):
 *   1. Schema-valid (zod), incl. tileStepM required when tiling AND a
 *      required anchorFrame on every part (schema-enforced)
 *   2. Tri budgets ≤ 5,000 per part (schema-enforced ceiling)
 *   3. Every referenced GLB exists on disk UNLESS placeholder: true
 *   4. Every skus[] entry resolves in the rate catalog
 *   5. anchorFrame is consistent with the part category (roof↔roof)
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@atom/catalog";
import { parseManifest } from "../src/manifest.js";
import { parseGroups } from "../src/groups.js";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(pkgRoot, "manifest.json");

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error(`  ✗ ${msg}`);
};

console.log(`assets:check — ${manifestPath}`);

const manifest = parseManifest(JSON.parse(readFileSync(manifestPath, "utf-8")));
console.log(`  schema OK (${manifest.parts.length} parts, manifest v${manifest.version})`);

const catalog = loadCatalog();
let placeholders = 0;

for (const part of manifest.parts) {
  if (part.placeholder) {
    placeholders++;
  } else if (!existsSync(join(pkgRoot, part.file))) {
    fail(`${part.id}: file "${part.file}" missing but placeholder=false`);
  }
  for (const sku of part.skus) {
    if (!catalog.skus[sku]) {
      fail(`${part.id}: SKU "${sku}" does not resolve in catalog v${catalog.version}`);
    }
  }
  // anchorFrame presence is schema-enforced (parseManifest throws otherwise);
  // additionally require roof-category parts to sit in the roof frame so a
  // roof trim can never be positioned off the wall rect.
  if (part.category === "roof" && part.anchorFrame !== "roof") {
    fail(`${part.id}: category "roof" must declare anchorFrame "roof" (got "${part.anchorFrame}")`);
  }
  // Palette fields — a draggable catalogue item can't render or group without
  // them (schema-enforced too; re-checked here for a friendly message).
  if (!part.displayName) fail(`${part.id}: missing displayName (palette label)`);
  if (!Array.isArray(part.tags)) fail(`${part.id}: missing tags[] (search/grouping)`);
  if (!part.placementMode) fail(`${part.id}: missing placementMode`);
}

const byFrame: Record<string, number> = { wall: 0, roof: 0, ground: 0 };
for (const part of manifest.parts) byFrame[part.anchorFrame] = (byFrame[part.anchorFrame] ?? 0) + 1;
console.log(
  `  anchorFrame: ${byFrame.wall} wall · ${byFrame.roof} roof · ${byFrame.ground} ground`,
);
const byMode: Record<string, number> = {};
for (const part of manifest.parts) byMode[part.placementMode] = (byMode[part.placementMode] ?? 0) + 1;
console.log(
  `  placementMode: ${Object.entries(byMode).map(([k, n]) => `${n} ${k}`).join(" · ")}`,
);
if (manifest.trimSpecs?.placeholder) {
  console.log("  trimSpecs present (placeholder — awaiting roof-trim-specs.json)");
}

console.log(`  ${placeholders}/${manifest.parts.length} parts are placeholders (authored GLBs pending)`);

// --- Assembly groups: every partId resolves in the manifest, every sku in the catalog ---
const partIds = new Set(manifest.parts.map((p) => p.id));
const groups = parseGroups(JSON.parse(readFileSync(join(pkgRoot, "groups.json"), "utf-8")));
for (const g of groups.groups) {
  for (const gp of g.parts) {
    if (!partIds.has(gp.partId)) fail(`group "${g.id}": partId "${gp.partId}" not in manifest`);
    if (!catalog.skus[gp.sku]) fail(`group "${g.id}": SKU "${gp.sku}" does not resolve in catalog`);
    const part = manifest.parts.find((p) => p.id === gp.partId);
    if (part && !part.skus.includes(gp.sku)) {
      fail(`group "${g.id}": SKU "${gp.sku}" is not one of part "${gp.partId}"'s skus`);
    }
  }
}
const ddaGroups = groups.groups.filter((g) => g.dda).length;
console.log(`  groups: ${groups.groups.length} (${ddaGroups} DDA-gated), all partIds + SKUs resolve`);

if (failures > 0) {
  console.error(`assets:check FAILED with ${failures} error(s)`);
  process.exit(1);
}
console.log("assets:check PASSED");
