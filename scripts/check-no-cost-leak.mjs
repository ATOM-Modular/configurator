/**
 * CI gate — SPEC Security rule #1 (second half).
 *
 * Greps the BUILT public configurator bundle for cost/GP strings and rate
 * values. Fails the build on any hit. Skips with a notice while the
 * configurator app has no build output yet (pre-M3).
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN = ["standardCost", "gpPercent", "costPerSqm"];
const distDir = join(process.cwd(), "apps", "configurator", "dist");

if (!existsSync(distDir)) {
  console.log(
    "check-no-cost-leak: apps/configurator/dist not found (app not built yet) — skipping. " +
      "This check becomes MANDATORY once the configurator builds (M3).",
  );
  process.exit(0);
}

let failures = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!/\.(js|mjs|cjs|css|html|json|map)$/.test(name)) continue;
    const content = readFileSync(p, "utf-8");
    for (const needle of FORBIDDEN) {
      if (content.includes(needle)) {
        console.error(`✗ LEAK: "${needle}" found in public bundle file ${p}`);
        failures++;
      }
    }
  }
}
walk(distDir);

if (failures > 0) {
  console.error(`check-no-cost-leak FAILED: ${failures} occurrence(s) of cost/GP strings in the public bundle`);
  process.exit(1);
}
console.log("check-no-cost-leak PASSED: public bundle is clean");
