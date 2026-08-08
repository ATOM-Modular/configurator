# Rendering parity pass — progress

Target: the "Central Darling 12×3 Amenities" Enscape renders (Central Darling
NSW PSL R0, pages 1–2). This pass is materials / lighting / cheap geometry
only — no features, no assembly or pricing changes.

## ⚠️ Benchmark-screenshot constraint

The spec's benchmark discipline (capture the hero frame each stage, place it
beside the reference in `/reference/progress/`, list deltas) **could not be
executed in this dev environment**: the automated browser pane does not
composite WebGL frames, so the canvas stays at its 300×150 default and
`toDataURL`/screenshots return nothing usable. There is also no `/reference`
folder in the repo — the reference used here is the PSL PDF.

What was built so the ATOM team can run it:

- **Hero angle** button in the 3D stage (and the `b` key) snaps the benchmark
  camera: ¾ aerial, 45° azimuth, 35° elevation, ~32° FOV (≈40mm, no wide-angle).
- **Capture ↓** button (internal build only) exports a **1920×1080 PNG** from
  that exact pose. `preserveDrawingBuffer` is on so the export is pixel-exact.

Run `VITE_INTERNAL=true pnpm --filter configurator build` (or dev), open a
building, click **Hero angle** then **Capture ↓**, and drop the PNG beside the
PSL render.

## Stage status

### Stage 1 — bugs + lighting ✅
- **Translucent walls fixed.** Root cause: the window part applied its glass
  material to the whole unit (frame included). Glazing is now tagged per-mesh
  (`userData.glass`) so only the pane is transmissive; every other material is
  hard-forced `transparent:false / opacity:1 / depthWrite:true / FrontSide`.
- Renderer: `ACESFilmicToneMapping`, `outputColorSpace = SRGBColorSpace`,
  `toneMappingExposure` 1.1, MSAA on (`antialias:true`).
- Environment: procedural equirectangular overcast sky (`textures.ts`) used
  for **both** IBL and the visible background — this is what gives the steel
  its sheen. Self-contained (no CDN fetch); a real Poly Haven `.hdr` is a
  drop-in (see below).
- Sun: one `DirectionalLight`, warm white, PCF soft shadows, 2048 map, tight
  frustum, bias tuned.
- `ContactShadows` grounds every building.

### Stage 2 — materials ✅
- Colorbond PBR set in `colorbond.ts` (base colours) × role params: painted
  EPS wall (metalness 0.05 / rough 0.7) vs coated steel (0.6 / 0.35) vs
  powder-coat frame (0.2 / 0.5). **hex values are PLACEHOLDER — verify against
  a physical swatch.**
- Wall panel **1200mm joint groove** via a procedural normal map, UV-aligned
  to the panel grid (one bay = one tile).
- Roof **corrugation** normal map on the steel sheets.
- Ground: procedural mottled gravel colour map, 24× tiled, melting into the
  horizon via fog.
- Glazing = `MeshPhysicalMaterial` transmission (the only transmissive
  material in the scene); frames powder-coat Surfmist.

### Stage 3 — cheap geometry ✅ (mostly landed in the prior commit)
- 2° duo-pitch gable to a centre ridge; **ridge capping** along the ridge and
  **fascia capping** down both long walls (`capping-ridge` / `capping-fascia`).
- Corner flashings on every external corner; tee-join covers at module joins.
- Downpipes at the gutter positions; gutter run along the low eave.
- Footings at the drawn 450×450 pad, height per FFL, sitting on the ground.
- Roof/cappings/gutter/flashings all default **Monument**, chosen separately
  from the wall colour (the cream/near-black contrast is the signature).

### Stage 4 — camera / post / entourage ◻ deferred
- AA is covered by MSAA (`antialias:true`). **Postprocessing** (SMAA pass,
  vignette 0.15, optional SSAO) and **entourage** (gum-tree billboards, fence,
  puddle decals) are NOT done: they add a heavy dependency
  (`@react-three/postprocessing`) and/or blind-placed geometry, and with no
  way to see the result here the risk/reward wasn't there. Recommended as the
  next pass once someone can eyeball it.

## Remaining deltas to the reference (by impact)

1. **Authored GLB parts** — doors/windows/sheeting are still procedural boxes.
   This is the single biggest gap and the separate GLB workstream; the
   manifest makes it a file swap.
2. **Real HDRI** — procedural sky is soft but flat vs a photographed sky.
3. **Real PBR texture sets** (ambientCG) for panels/ground vs the procedural
   canvas maps.
4. **Entourage + backplate** — the reference leans on trees/fence/puddles and
   a photographic sky for life and scale.
5. **SSAO / contact AO in corners** — adds solidity.

## Drop-in paths (no code change beyond the swap)

- **HDRI**: put e.g. `public/env/overcast_2k.hdr`, then in `ConfigStage`
  replace `<SceneEnv/>` with drei `<Environment files="/env/overcast_2k.hdr"
  background />`.
- **Authored GLBs**: drop `packages/assets/parts/*.glb`, set
  `placeholder:false` in `manifest.json`; the loader swaps automatically.
- **Colorbond hex**: correct the values in `scene/colorbond.ts`.
