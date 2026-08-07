/**
 * pnpm assets:check — validates manifest.json (SPEC asset conventions):
 *   1. Schema-valid (zod), incl. tileStepM required when tiling
 *   2. Tri budgets ≤ 5,000 per part (schema-enforced ceiling)
 *   3. Every referenced GLB exists on disk UNLESS placeholder: true
 *   4. Every skus[] entry resolves in the rate catalog
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "@atom/catalog";
import { parseManifest } from "../src/manifest.js";

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
}

console.log(`  ${placeholders}/${manifest.parts.length} parts are placeholders (authored GLBs pending)`);

if (failures > 0) {
  console.error(`assets:check FAILED with ${failures} error(s)`);
  process.exit(1);
}
console.log("assets:check PASSED");
