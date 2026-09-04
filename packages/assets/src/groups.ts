/**
 * Assembly groups — the SPEC's "bathroom assembly builder". A group is a named
 * set of placedInstance templates with relative offsets; dropping it in the
 * configurator instantiates every part as an individual placedInstance, so the
 * parts price and edit exactly like hand-placed items (one drag, N instances).
 *
 * groups.json lives next to manifest.json; assets:check validates that every
 * partId resolves in the manifest and every sku resolves in the catalog.
 */
import { z } from "zod";
import groupsJson from "../groups.json";

export const groupPartSchema = z.object({
  partId: z.string().min(1),
  sku: z.string().min(1),
  /** offset from the drop point, plan metres (X across, Y = 3D Z depth) */
  dxM: z.number(),
  dyM: z.number(),
  rotationDeg: z.number().optional(),
  /** present ⇒ a partition SEGMENT; the second endpoint offset */
  dx2M: z.number().optional(),
  dy2M: z.number().optional(),
});

export const assemblyGroupSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  displayName: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  /** DDA-only: offered and priced only when the building's dda flag is set */
  dda: z.boolean().optional(),
  parts: z.array(groupPartSchema).min(1),
});

export const groupsSchema = z.object({
  version: z.string(),
  note: z.string().optional(),
  groups: z.array(assemblyGroupSchema).min(1),
});

export type GroupPart = z.infer<typeof groupPartSchema>;
export type AssemblyGroup = z.infer<typeof assemblyGroupSchema>;
export type Groups = z.infer<typeof groupsSchema>;

export function parseGroups(raw: unknown): Groups {
  return groupsSchema.parse(raw);
}

let cached: Groups | undefined;
export function loadGroups(): Groups {
  if (!cached) cached = parseGroups(groupsJson);
  return cached;
}
