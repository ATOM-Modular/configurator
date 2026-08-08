# Blaise pricing model — reference for the configurator

Source: **Blaise v10.2.xlsm** (ATOM's estimating workbook). The configurator
must trace every priced parameter back to this model. Machine-readable
vocabulary: [`blaise-parameters.json`](./blaise-parameters.json).

## How Blaise prices (it is cost-plus, not per-SKU sell prices)

1. A building is described by the **Sales Calculator** inputs (region, module,
   chassis, panel upgrades, per-section product selections + quantities +
   options).
2. Each **component category is its own sheet** (`External Walls`, `Roof`,
   `Gutter + Downpipe`, `Chassis`, `Windows 1..4`, `Doors 1..4`,
   `Airconditioning 1..3`, `Lighting 1..4`, `Electrical Fit-outs 1..5`,
   `Bathroom 1`, `Kitchen 1`, `Hot Water System`, `Laundry`, `Others`,
   `Fire Rated Wall`, `Additional`, …). Each sheet computes **Materials
   (`K4`)** and **Labour (`K5`)** from the building parameters, pulling rates
   from the `Materials` (2,345 rows) and `Labor` sheets.
3. `ESTIMATOR` sums all categories:
   - `Materials = Σ category materials`, `Labour = Σ category labour`
   - `Standard Cost = Materials + Labour + Transport`
   - `Total Cost = Standard Cost + Variation Adjustments`
   - **`Subtotal (sell) = Total Cost / (1 − GP%)`**, default **GP% = 0.45**
   - `TOTAL = Subtotal × Qty(modules)`; `Cost $/m² = TOTAL / Qty / FloorArea`
4. COGS is split into **Odoo account codes** (310 Materials, 311 Production
   Labour, 313 Plumbing, 314 Electrical, 314.01 Fabrication, 314.02 Cleaners,
   314.03 Other) — the same codes the WIP tracker consumes.
5. **Transport** is a separate per-module model (kms, truck loads, 20% GPM).

Key constants: wall height **2.7 m** (`ext wall area = L·2·2.7 + W·2·2.7`);
GST excluded throughout; GP margin **45 %**.

Wind-region panel upgrade (auto-enforced minimums):
- Region **C** → external ≥ 100 mm, ceiling ≥ 100 mm
- Region **D** → external ≥ 200 mm, ceiling ≥ 250 mm

## Blaise inputs ↔ configurator `SiteConfig`

| Blaise (Sales Calculator) | Configurator today | Status |
|---|---|---|
| Region Class (A&B / C / D) | `windRegion` | ✅ aligned |
| Module / Chassis Size (10 std sizes) | `lengthM`/`widthM` free sliders | ⚠️ should snap to Blaise chassis sizes |
| Chassis Type (Office / Toilet / …) | `chassis` | ✅ aligned (extend enum) |
| Wall / Ceiling thickness (50/75/100[/125]) | `panels.wallMm` / `ceilingMm` | ✅ aligned; add ceiling 125 |
| Colourbond colour (**22**) | `panels.colour` (5) | ⚠️ expand to the 22 |
| Panel upgrade (region-driven min) | — | ❌ not modelled |
| Internal Wall l.m. / stops / corners | `partitionsX` (visual only) | ⚠️ derive l.m./stops/corners |
| Colourbond Roof / Gutters (bool) | `flags.gutters` | ⚠️ split into the two booleans |
| Doors 1–4 (type + closer/lockbox/seal/window/colour/swing/handle + qty) | `fitout` door SKUs | ⚠️ becomes a typed door slot |
| Windows 1–4 (size + glazing/function/grill/blinds/colour + qty) | `fitout` window SKUs | ⚠️ typed window slot |
| Airconditioning 1–3 (+ extra piping l.m.) | per-zone AC auto-size | ⚠️ map to AC slots |
| Lighting 1–4, Electrical Fit-outs 1–5 | per-room gpo/light/data | ⚠️ map to product slots |
| Bathroom / Kitchen / Laundry / HWS (demand-sized) | `wet` builder | ⚠️ align product names + HWS demand calc |
| Additional (fire wall, spray foam, PPU, …) | `extraFitout` | ⚠️ align to Additional list |
| Qty (modules) | site mode buildings | ~ |

## Divergences to resolve (decisions needed)

1. **GP margin**: Blaise = **45 %**; configurator engine currently seeds/uses
   **35 %**. Blaise wins → set `TARGET_GP_PCT`/`gpPercent` to 0.45.
2. **Pricing shape**: Blaise is **cost-plus per category** (materials + labour,
   one GP at the end), not per-SKU sell prices. The catalog/engine should be
   re-shaped to category material+labour rates, GP applied once.
3. **Wall height**: Blaise uses **2.7 m** for wall-area costing; the 3D/manifest
   now use 2.754 m (eave, from the manufacture drawings). Keep 2.754 for
   geometry, but **cost on 2.7** (or reconcile with Duane).
4. **Sizes**: expose Blaise's 10 **chassis sizes** as the catalog presets
   instead of free length/width.
5. **Colours**: adopt the **22** Colourbond colours.
6. **Doors/Windows/AC/Lighting/etc.**: switch from ad-hoc SKUs to Blaise's
   **typed slots** (Doors 1–4, Windows 1–4, …) with the Lists options.

## Recommended architecture

Blaise stays the source of truth. Export from it a **versioned catalog**
(per-category material + labour rates, keyed by the Lists parameters) that the
**server-side `blaise-engine`** consumes to reproduce the cost-plus roll-up;
the public configurator keeps sending Blaise-shaped parameters and rendering
the response. This preserves the security boundary (rates stay server-side)
while making every number traceable to Blaise.
