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

export const manifestSchema = z
  .object({
    version: z.string(),
    units: z.literal("m"),
    upAxis: z.literal("Y"),
    anchorConvention: z.literal("SW-bottom"),
    parts: z.array(manifestPartSchema).min(1),
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
