# ATOM Modular — Building & Site Configurator

INTERNAL — do not deploy cost/margin data publicly. Full product spec: `SPEC.md` (read it before structural changes).

## What this is

Web-based 3D building configurator for ATOM Modular (steel-framed EPS-panel modular buildings, New Gisborne VIC). UX reference: Mobile Modular's 360 3D Visualizer, exceeded by (1) live pricing on every config change and (2) multi-building site layout with site kit (Rapta walkways, steps, balustrades, water/waste skids).

Pricing comes from ATOM's internal estimating engine ("Blaise") via a versioned catalog export. **The configurator never computes prices** — it POSTs config state to the pricing API and renders the response.

## Monorepo layout (pnpm workspaces)

| Package | Role | Import rules |
|---|---|---|
| `packages/contracts` | Types ONLY (SiteConfig, estimates). No rates, no logic. | Importable by everything |
| `packages/blaise-engine` | Pure TS pricing engine. No React/DOM/I/O — catalog passed in. | SERVER-ONLY |
| `packages/catalog` | Versioned JSON rates exported from Blaise. Never hand-edit rates. | SERVER-ONLY |
| `packages/assets` | GLB kit-of-parts + `manifest.json` (config→mesh→SKU map) + placeholder generators | Importable by configurator (no rates) |
| `apps/pricing-api` | Hono. `POST /price` — mode=public (sale prices only), mode=internal (auth, full cost/GP) | imports engine+catalog |
| `apps/configurator` | React+Vite+r3f public app (M3). **Never imports engine or catalog.** | contracts + assets only |

## Security rules (hard requirements, tested)

1. `apps/configurator` must never import `@atom/blaise-engine` or `@atom/catalog` — ESLint `no-restricted-imports` (`.eslintrc.cjs`) + CI grep of the built bundle (`scripts/check-no-cost-leak.mjs`).
2. Public API responses carry sale prices only. `PublicEstimate` and `InternalEstimate` are separate interfaces (compile-time), `toPublic()` builds field-by-field with no spreads (runtime), contract tests deep-scan serialized output for `standardCost`/`gpPercent`/`costPerSqm`/etc.
3. Internal mode requires `INTERNAL_API_TOKEN` bearer auth; default-deny when unset. M365 SSO later.

## Commands

```bash
pnpm install
pnpm test              # vitest across all packages (engine rules, contracts, API)
pnpm typecheck         # per-package tsc --noEmit
pnpm lint              # incl. the import-boundary rule
pnpm assets:check      # manifest schema, tri budgets, GLB presence, SKU resolution
pnpm check:no-cost-leak # grep built public bundle (skips until M3 build exists)
pnpm --filter pricing-api dev   # API on :8787
```

## Engine rules (implemented in packages/blaise-engine/src/rules/)

- Modules are 3m wide; width > 3.4m ⇒ `ceil(width/3)` modules + tee-join kits + `MULTI_MODULE` warning; chassis tier becomes "complex"
- Walls priced on perimeter (lm); ceiling/roof/floor/power/gutters per module
- AC sized per room/zone (never whole floor); `acOverrideKw` ⇒ `AC_OVERRIDE` warning; one condenser bracket per unit; toilet-chassis buildings get no AC
- HWS auto-included on wet/kitchen builds — electric default, gas at ≥3 showers (PLACEHOLDER threshold)
- Accessible (DDA) bathroom sets without `flags.dda` = hard error
- `OTHERS` component always included
- Unknown SKU or $0 rate ⇒ `PricingValidationError` "MANUAL PRICE REQUIRED" (HTTP 422) — never $0, never silent
- Gutters default on; `flags.gutters: false` ⇒ `STORMWATER_RISK` warning
- Wind region multipliers (AB/C/D) scale structure lines — PLACEHOLDER values

## Placeholders awaiting real data (grep for PLACEHOLDER)

- All catalog rates (`packages/catalog/data/catalog.v1.json`) — replaced by a Blaise export file drop
- Wind multipliers, AC sizing heuristic (0.15 kW/m²), gas-HWS shower threshold
- Colorbond hex values + PBR material params (M3) — confirm against physical swatches with Duane
- All GLB parts are `placeholder: true` in `packages/assets/manifest.json` — authored Blender GLBs land as file swaps, never code changes

## Milestones

M1 engine+API (done) → M2 assets+assembly → M3 single-building configurator → M4 site mode (Zinfra Craigieburn acceptance layout) → M5 outputs/export. Definition of done per milestone: tests green, no cost strings in public bundle, assets:check green, 60fps desktop, README updated.

## Conventions

- TypeScript strict everywhere; packages export TS source directly (`main: src/index.ts`) — vitest/tsx consume it; production builds come later
- Units: metres, glTF +Y up, part origins at SW-bottom attachment corner, site coords X east / Y north
- Money: AUD ex GST at line level; GST 10% applied at totals; round to cents
