# ATOM Modular — Building & Site Configurator

Web-based 3D modular-building configurator with live pricing and multi-building site layout. Full spec: [SPEC.md](SPEC.md). Working notes for AI-assisted dev: [CLAUDE.md](CLAUDE.md).

**INTERNAL — cost/margin data must never reach the public bundle.** See Security below.

## Status: M2 complete — assets + assembly

| Milestone | Status |
|---|---|
| M1 Engine + API skeleton | ✅ done |
| M2 Assets package + assembly | ✅ done |
| M3 Single-building configurator | ⬜ next |
| M4 Site mode (Zinfra acceptance) | ⬜ |
| M5 Outputs / export | ⬜ |

All catalog rates are `PLACEHOLDER: true` — real rates arrive as a Blaise export replacing `packages/catalog/data/catalog.v1.json`.

## Layout

```
packages/contracts/       types only — request/response shapes (safe for the public app)
packages/blaise-engine/   pure TS pricing engine (no React, no DOM, no I/O) — SERVER-ONLY
packages/catalog/         versioned JSON rates from Blaise — SERVER-ONLY, never hand-edit
packages/assets/          GLB kit-of-parts manifest + assets:check (placeholder-first)
apps/pricing-api/         Hono — POST /price (mode=public | mode=internal w/ bearer auth)
apps/configurator/        React+Vite+r3f public app — lands in M3, never computes a dollar
```

## Quick start

```bash
pnpm install
pnpm test            # engine rules + API contract tests incl. no-cost-leak
pnpm assets:check    # manifest schema / budgets / SKU resolution
pnpm --filter pricing-api dev   # http://localhost:8787
```

Price a 6×3 office (public mode):

```bash
curl -s -X POST http://localhost:8787/price -H "content-type: application/json" -d '{"mode":"public","site":{"windRegion":"AB","buildings":[{"id":"b1","use":"Office","lengthM":6,"widthM":3,"ffl_mm":765,"chassis":"office","panels":{"type":"EPS-FR","wallMm":50,"ceilingMm":50,"colour":"Surfmist"},"rooms":[],"fitout":[{"sku":"DOOR-920-SC","qty":1},{"sku":"WINDOW-SLIDING-1175","qty":2}]}],"siteKit":[]}}'
```

Internal mode adds cost/GP and requires `INTERNAL_API_TOKEN`:

```bash
INTERNAL_API_TOKEN=dev-secret pnpm --filter pricing-api dev
# then send:  Authorization: Bearer dev-secret   with  "mode": "internal"
```

## Security model

1. **Package boundary** — `apps/configurator` can never import `@atom/blaise-engine` / `@atom/catalog` (ESLint `no-restricted-imports` + CI grep of the built bundle for `standardCost` / `gpPercent` / `costPerSqm`).
2. **Type-level split** — `PublicEstimate` vs `InternalEstimate` are separate interfaces; `toPublic()` constructs the public shape field-by-field (no spreads). Contract tests deep-scan serialized public responses for forbidden keys.
3. **Auth** — internal mode is bearer-token gated and default-denies when `INTERNAL_API_TOKEN` is unset. M365 SSO planned.

## Assembly layer (M2, `packages/assets`)

Pure functions turning config into part placements (`PlacedPart[]` — id, position, rotation, scale) that both the 3D scene and footing schedules consume:

- `tileWallRun` — full 1200mm panels + an X-scaled cut panel for the remainder; openings snap to the panel grid and swap out covered bays (no CSG)
- `assembleBuilding` — four elevations, corner flashings, base channel/chassis edge, tee joins at module boundaries, roof sheets per module row, gutters/downpipes, 6 footings per module (2×3) scaled to FFL − chassis allowance (hard error past the footing's scalable max)
- `assembleWalkway` — bays tiled across a gap, posts auto-counted
- `createPlaceholderPart` — procedural three.js stand-in per manifest part: correct bounding box, SW-bottom origin, `userData.placeholder` flag; authored GLBs replace these with zero code change

Note: assembly lives in `packages/assets` (not `apps/configurator` as SPEC drafted) so it's testable without the React app and reusable by exports — flagged as an accepted deviation.

## Engine behaviours worth knowing

- Width > 3.4m ⇒ multi-module: complex chassis tier, tee-join kits, `MULTI_MODULE` warning
- AC auto-sizes per room/zone (override ⇒ `AC_OVERRIDE` warning); toilet buildings get none
- Wet/kitchen builds auto-include HWS (electric; gas at ≥3 showers)
- Unknown SKU or $0 rate ⇒ HTTP 422 `MANUAL_PRICE_REQUIRED` — never a silent $0 line
- Removing gutters ⇒ `STORMWATER_RISK` warning
