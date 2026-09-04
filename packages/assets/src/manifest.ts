/**
 * @atom/assets — manifest schema + typed loader.
 *
 * manifest.json is the single source of truth mapping config → meshes → SKUs.
 * The 3D scene and the pricing request must derive from the same config
 * state; `skus[]` on each part is that link.
 *
 * Safe to import from the public configurator (contains geometry metadata
 * and SKU IDs only — never rates).
 */
import { z } from "zod";

export const TRI_BUDGET_CEILING = 5000;

export const anchorSocketSchema = z.object({
  name: z.string().min(1),
  /** metres, part-local — origin at the SW-bottom attachment corner */
  position: z.tuple([z.number(), z.number(), z.number()]),
  normal: z.tuple([z.number(), z.number(), z.number()]).optional(),
});

export const manifestPartSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9.×x]+)*$/i),
  file: z.string().regex(/\.glb$/),
  /** true ⇒ procedural placeholder; rendered with wireframe overlay in internal mode */
  placeholder: z.boolean(),
  category: z.enum(["structure", "opening", "roof", "sitekit", "service"]),
  /**
   * Which rect an instance's transform is derived from. Placeholder
   * generators and assembly functions MUST position every instance against
   * the rect matching this frame — never the other one:
   *   wall   → building footprint rect (L × W) at floor datum: wall panels,
   *            openings, corner/base flashings, chassis edge, downpipes
   *   roof   → footprint + oversail (~65mm all sides): roof sheet, fascia,
   *            barge, gutter, ridge cap, module-join cover flashing
   *   ground → footprint / site placement at ground level: footings, tanks,
   *            site kit
   */
  anchorFrame: z.enum(["wall", "roof", "ground"]),
  /** Palette label shown in the browsable catalogue. */
  displayName: z.string().min(1),
  /** Search + grouping keywords for the palette. */
  tags: z.array(z.string().min(1)),
  /**
   * Top-down icon path (parts/thumbs/<id>.png). Optional: the thumbnail
   * generator renders a placeholder so the palette works before real art,
   * and authored PNGs later overwrite the file — no code change.
   */
  thumbnail2d: z.string().optional(),
  /**
   * How the configurator places an instance of this part:
   *   bay-grid     → structural wall panels (tile on the 1200 grid)
   *   wall-mounted → openings: snap to nearest 1200 bay, swap the bay
   *   floor-free   → fixtures: drop anywhere in a room, rotate, assigned to
   *                  the room dropped into
   *   partition    → internal wall segments
   */
  placementMode: z.enum(["bay-grid", "wall-mounted", "floor-free", "partition"]),
  /** metres, glTF +Y up */
  dimensions: z.object({ x: z.number().positive(), y: z.number().positive(), z: z.number().positive() }),
  tilingAxis: z.enum(["x", "z", "none"]),
  /** required when tilingAxis != "none" (refined below) */
  tileStepM: z.number().positive().optional(),
  anchors: z.array(anchorSocketSchema).min(1),
  /** Blaise SKU(s) this part represents — the config↔price link */
  skus: z.array(z.string().min(1)).min(1),
  triBudget: z.number().int().positive().max(TRI_BUDGET_CEILING),
  scalable: z
    .object({
      axis: z.enum(["x", "y", "z"]),
      minM: z.number().positive(),
      maxM: z.number().positive(),
    })
    .optional(),
  /** openings: how many 1200mm wall bays this unit swaps out (no CSG) */
  replacesBays: z.number().int().positive().optional(),
});

/**
 * Roof/wall trim developed dimensions, bend angles and stock lengths. The
 * authoritative source is Blaise's `roof-trim-specs.json` (merged here under
 * `trimSpecs`); until that lands these values are read off the manufacture
 * drawings and flagged `placeholder`. Panel-wrap legs are parametric on
 * `panels.ceilingMm` (leg = ceilingMm + wrapLapMm) — never a hardcoded 50mm.
 */
export const trimSpecsSchema = z
  .object({
    placeholder: z.boolean().optional(),
    note: z.string().optional(),
    oversailMm: z.number().nonnegative().optional(),
    roofPitchDeg: z.number().optional(),
  })
  .catchall(z.unknown());

export const manifestSchema = z
  .object({
    version: z.string(),
    units: z.literal("m"),
    upAxis: z.literal("Y"),
    anchorConvention: z.literal("SW-bottom"),
    parts: z.array(manifestPartSchema).min(1),
    trimSpecs: trimSpecsSchema.optional(),
  })
  .superRefine((m, ctx) => {
    const seen = new Set<string>();
    for (const [i, part] of m.parts.entries()) {
      if (seen.has(part.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parts", i, "id"], message: `duplicate part id "${part.id}"` });
      }
      seen.add(part.id);
      if (part.tilingAxis !== "none" && part.tileStepM === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts", i, "tileStepM"],
          message: `part "${part.id}" tiles along ${part.tilingAxis} but has no tileStepM`,
        });
      }
      if (part.scalable && part.scalable.minM > part.scalable.maxM) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parts", i, "scalable"],
          message: `part "${part.id}" scalable.minM > maxM`,
        });
      }
    }
  });

export type AnchorSocket = z.infer<typeof anchorSocketSchema>;
export type ManifestPart = z.infer<typeof manifestPartSchema>;
export type Manifest = z.infer<typeof manifestSchema>;

export function parseManifest(raw: unknown): Manifest {
  return manifestSchema.parse(raw);
}
