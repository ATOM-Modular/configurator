# ATOM Modular Building & Site Configurator — Spec (v2)

> INTERNAL — do not deploy cost/margin data publicly. Read the Security section before writing any code.
> v2 adds the 3D asset pipeline (kit-of-parts) and rendering quality spec.

## Context

You are building a web-based 3D building configurator for ATOM Modular, a steel-framed EPS-panel modular building manufacturer in New Gisborne, VIC, Australia. The UX reference is Mobile Modular's "360 3D Visualizer" (mobilemodular.com/3d-visualizer). We replicate its 3-step wizard pattern and exceed it in two ways:

1. **Live pricing** — the price updates on every configuration change (Mobile Modular has no pricing at all; a rep contacts you later).
2. **Site layout** — multiple buildings plus site kit (Rapta covered walkways, steps, balustrades, water/waste skids) arranged on one site.

Pricing comes from ATOM's internal estimating engine ("Blaise"). The configurator NEVER computes prices — it sends config state to a pricing API and renders the response.

## UX flow (3-step wizard, persistent breadcrumb stepper)

**Step 1 — Project setup.** State/postcode (drives wind region default: A&B unless flagged) + building use (Office / Lunchroom / Toilet & Amenities / Accommodation / Lab / Classroom). Selections persist as URL query params (deep-linkable).

**Step 2 — Building catalog.** Cards grouped by building family. Each card: render thumbnail, name ("6.0 × 3.0m Site Office"), floor area m², suggested occupancy, indicative from-price ex GST. Sizes step in transport-module increments (3m-wide modules; width > 3.4m = multi-module). A "Custom size" card opens length/width inputs with live module-count feedback.

**Step 3 — Design.** 3D stage with orbit controls + config tabs + docked live price panel:

- **Structure**: length, width, panel type (EPS-FR default) & thickness (50mm default), Colorbond colour (Surfmist default), wind region A&B/C/D
- **Openings**: doors (920/820/double, closers), windows (sliding 1175, fixed, toilet 600×300) — placed by clicking a wall
- **Interior**: rooms/zones via a 2D floor-plan inset (drag partition walls); per-zone AC (auto-sized, overridable with warning), lighting, GPOs, data
- **Wet areas**: bathroom assembly builder (pans/basins/showers/urinals/partitions/accessible sets), kitchen (1500/2100/3600), HWS (auto-included on wet builds, demand-sized)
- **Site kit** (site mode): walkways (standard/elevated), balustrades, steps, water skids, waste tanks, macerator pumps
- **Price panel**: running total ex GST, per-category subtotals, delta flash (+$X/−$X) on every change. Internal mode adds standard cost, GP%, cost/m², price/m².
- **CTA**: internal → "Export estimate"; public → "Get a detailed quote" (contact form + config JSON → webhook → n8n → HubSpot)

## Reference layout (site-mode acceptance scenario)

"Zinfra Craigieburn": Site Office 6×3 (FFL 765mm, elevated), M/F Toilet 4.8×3 (FFL 1080mm), Lunchrooms 01 & 02 6×3 (FFL 535mm), 2 Rapta covered walkways (one elevated FFL 755mm), balustrades, 2 double-width steps, 5000L water tank, 1000L waterskid, 4000L waste tank under the toilet block, 2 macerator pumps, Surefoot footing blocks with heights derived per building FFL. The configurator must reproduce this site.

## Architecture (non-negotiable)

Monorepo (pnpm workspaces):

```
packages/blaise-engine/    # pure TS pricing engine. No React, no DOM, no I/O.
packages/catalog/          # versioned JSON: SKUs, rates, assembly recipes (exported from Blaise, never hand-edited)
packages/assets/           # GLB kit parts + manifest.json + procedural placeholder generators
apps/pricing-api/          # POST /price. mode=internal (auth) full estimate; mode=public sale prices only
apps/configurator/         # React + Vite + react-three-fiber + drei. Zustand state. Never computes a dollar.
```

> Implementation addendum (agreed at kickoff): `packages/contracts` — a types-only package holding SiteConfig / estimate shapes so the configurator never has a reason to import the engine or catalog.

### Security rules (hard requirements — enforce with tests)

1. `blaise-engine` and `catalog` must NEVER be imported by `apps/configurator`. ESLint boundary rule + CI grep failing the build if the public bundle contains rate values or the strings "standardCost", "gpPercent", "costPerSqm".
2. Public API responses contain sale prices only. Contract test: serialize a public `/price` response, assert no cost/GP fields at any depth.
3. Internal mode behind auth (shared header token now; Microsoft 365 SSO later).

## Pricing contract

```ts
{ mode: "internal" | "public", site: SiteConfig }

SiteConfig {
  windRegion: "AB" | "C" | "D",
  buildings: BuildingConfig[],
  siteKit: { sku: string, qty: number, meta?: object }[]
}

BuildingConfig {
  id: string, use: string,
  lengthM: number, widthM: number,       // width > 3.4 => engine splits modules + tee joints
  ffl_mm: number,
  chassis: "office" | "toilet",
  panels: { type: string, wallMm: number, ceilingMm: number, colour: string },
  rooms: Room[],
  fitout: { sku: string, qty: number, roomId?: string }[]
}

// public response
{ total_exGst, gst, total_incGst,
  perBuilding: [{ id, subtotal_exGst, lines: [{ label, qty, amount_exGst }] }],
  siteKit_exGst, warnings: [{ code, message }] }
// internal adds: standardCost, gpPercent, salePrice, costPerSqm, pricePerSqm per building + totals
```

## Engine rules living in blaise-engine (UI only surfaces their warnings)

- Chassis rate tier: single-module office / single-module toilet / complex (>3.4m wide)
- Module split + tee-section joint kit per join; external walls priced on perimeter; ceiling/chassis/flooring/power per module
- AC sized per room/zone, never whole floor area; each split adds a condenser bracket
- Bathrooms priced as assemblies; accessible sets only when DDA flag set
- HWS auto-included on any wet/kitchen build (electric default; gas only when showers push demand)
- "Others" component always included
- Unknown SKU or $0 line = hard validation error ("MANUAL PRICE REQUIRED"), never $0, never silent
- Gutters/downpipes default on; removal adds `STORMWATER_RISK` warning

## 3D approach: kit-of-parts assembly + PBR rendering

No whole-building model imports. Buildings are assembled at runtime from a small library of authored parts, so any dimension the user picks renders with authored-model quality. Realism comes from materials and lighting, not geometry complexity.

### Part library (authored in Blender, exported GLB)

Structure & envelope:

- `panel-wall-1200` — one 1200mm Askin EPS wall panel bay, 2700mm high, with real rib/joint profile (geometry or normal map). Tileable along X.
- `panel-wall-cut` — parametric-width closer piece (code scales a plain panel ≤1200mm for the modulo remainder)
- `flashing-corner`, `flashing-basechannel`, `flashing-tee-join` (multi-module joint cover)
- `roof-sheet-skillion` — Colorbond sheet segment, tileable; `barge-gutter-section`, `downpipe`
- `chassis-edge` — visible chassis profile below floor line; `footing-surefoot` — footing block, vertically scalable to per-FFL height

Openings (each replaces N wall-panel bays — no CSG):

- `door-920-single`, `door-820-single`, `door-1600-double` (framed unit incl. reveal)
- `window-sliding-1175`, `window-fixed-1175`, `window-toilet-600x300`

Site kit:

- `rapta-walkway-bay` — one structural bay incl. roof + posts, tileable along its axis; elevated variant = same part on taller posts
- `balustrade-1250`, `balustrade-3000`, `balustrade-post`
- `steps-single-width`, `steps-double-width`
- `tank-5000`, `waterskid-1000`, `wastetank-4000`, `macerator-pump`
- `ac-condenser-bracket`, `hws-electric`, `hws-gas`

### Asset conventions (enforce in a validation script `pnpm assets:check`)

- Units: metres, real-world scale. glTF +Y up.
- Origin: every part's origin at its SW-bottom attachment corner. Buildings assemble with origin at SW corner — matching the site coordinate convention (X east, Y north).
- `packages/assets/manifest.json` is the single source of truth: per part — file, dimensions, tiling axis, anchor sockets, and the Blaise SKU(s) it represents. The 3D scene and the pricing request must derive from the same config state; the manifest maps config → meshes.
- Budgets: ≤5,000 tris per part; full Zinfra site ≤150k tris on screen. Draco-compress geometry; KTX2/Basis textures; shared trim-sheet atlas for flashings.
- Placeholder-first: ship procedural placeholder generators implementing the same manifest interface (simple extrusions with correct dimensions), so the app works before Blender assets exist and authored GLBs drop in with zero code change. Placeholders flagged `placeholder: true` in the manifest and rendered with a subtle wireframe overlay in internal mode.

### Assembly logic (in `apps/configurator`, pure functions, unit-tested)

- Walls: tile `panel-wall-1200` along each elevation; modulo remainder uses `panel-wall-cut`. Openings snap to the 1200mm panel grid; placing a door/window swaps out the covered bays for the opening unit. (Mirrors real construction — window cutouts are +25mm in EPS, but visually the swap is sufficient.)
- Width > 3.4m: repeat module envelope, insert `flashing-tee-join` at joins, single continuous roof.
- Walkways: tile `rapta-walkway-bay` between two selected building edges; auto-count posts.
- Footings: 6 blocks per module footprint (2×3 pattern), height = FFL − chassis allowance, from `footing-surefoot` scaled.
- Use `InstancedMesh` for repeated parts (panels, footings, balustrade posts).

### Rendering quality spec (this is where realism lives — do not skimp)

- Renderer: WebGL2, `ACESFilmicToneMapping`, sRGB output, physically based lighting (no legacy lights)
- Environment: neutral overcast/daylight HDRI via drei `<Environment>`, drives reflections on Colorbond
- Sun: one directional light, PCF soft shadows (2048 map desktop / 1024 mobile); drei `<ContactShadows>` or a baked AO plane under each building
- Materials: `MeshStandardMaterial` PBR. Colorbond steel ≈ metalness 0.55–0.7, roughness 0.3–0.4 — treat as starting values, calibrate against physical swatches [CHECK with Duane]. Named palette constants: Surfmist, Monument, Shale Grey, Basalt, Woodland Grey (hex values to be confirmed against Colorbond swatch — mark `PLACEHOLDER`)
- Panel rib profile via normal map baked from high-poly in Blender; AO baked into part textures
- Ground: large soft-edged plane (gravel/grass texture, radial fade); site mode optionally underlays a user-uploaded site plan image with two-point scale calibration
- AA: MSAA (default framebuffer) with SMAA fallback; optional SSAO toggle (off on mobile)
- Performance targets: 60fps desktop, 30fps mid-range mobile, on the full Zinfra site

## Milestones (each ends with a working demo)

- **M1 — Engine + API skeleton.** blaise-engine with seed catalog (rates clearly `PLACEHOLDER: true`), /price both modes, contract tests incl. no-cost-leak test. Fixtures: 6×3 office and 4.8×3 toilet price end-to-end. Real rates arrive later as a catalog JSON drop-in.
- **M2 — Assets package + assembly.** manifest.json schema, procedural placeholder generators for every part, `assets:check` validation, assembly functions (wall tiling, opening swap, module join, footings) with unit tests on part counts (e.g. 6m wall = 5× 1200 panels + 1× cut panel).
- **M3 — Single-building configurator.** 3-step wizard, catalog cards, 3D stage per the rendering spec, config tabs, live price panel (300ms debounce → POST /price → delta badge; warnings as amber chips), export/enquiry CTA. Mobile responsive.
- **M4 — Site mode.** 2D top-down canvas (SVG/Konva): place/rotate/drag buildings on 0.1m snap grid, walkway tool connecting two buildings, site kit placement, footing schedule table from FFLs, whole-site 3D, site-level pricing. Acceptance: rebuild the Zinfra layout within budgets and framerate.
- **M5 — Outputs.** Internal: estimate JSON (Sales Calculator structure) + floor-plan brief JSON per building. Public: enquiry POST to configurable webhook. Screenshot + GLB export of the scene.

Blender-authored GLBs are produced outside this repo (Duane to arrange) and land in `packages/assets/` replacing placeholders — the manifest interface makes this a file swap, never a code change.

## Definition of done (every milestone)

- `pnpm test` green, incl. boundary, contract, and assembly-count tests
- No cost/GP strings in the built public bundle (CI grep)
- `pnpm assets:check` green
- 60fps desktop on the current demo scene
- README updated

## Explicit non-goals

- Generative/auto layout (manual placement only)
- Interior furniture beyond partition walls
- Checkout/payment
- CAD/Revit export (future phase — keep config JSON clean enough to feed it)
