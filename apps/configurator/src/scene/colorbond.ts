/**
 * Colorbond® PBR set — one entry per colour used by the configurator.
 *
 * hex values are PLACEHOLDER approximations of the Colorbond swatches.
 * [CHECK with Duane — verify against a physical swatch before customer use.]
 *
 * The SAME colour renders two ways depending on ROLE:
 *   - painted EPS wall panel: near-matte, almost no metalness
 *   - Colorbond steel (roof, cappings, flashings, gutter): coated steel sheen
 * so the tunable metalness/roughness live on the role (WALL_PBR / STEEL_PBR),
 * and this file only owns the base colours.
 */
export interface ColorbondSwatch {
  name: string;
  hex: string;
}

export const COLORBOND: ColorbondSwatch[] = [
  { name: "Surfmist", hex: "#E4E2D5" },
  { name: "Shale Grey", hex: "#BDBFBA" },
  { name: "Basalt", hex: "#6D6C6E" },
  { name: "Woodland Grey", hex: "#4D4E4C" },
  { name: "Monument", hex: "#2F3133" },
];

export function colorbondHex(name: string): string {
  return COLORBOND.find((c) => c.name === name)?.hex ?? "#E4E2D5";
}

/** Painted EPS panel — matte, minimal specular. */
export const WALL_PBR = { metalness: 0.05, roughness: 0.7, envMapIntensity: 0.85 } as const;

/** Colorbond coated steel — SPEC: metalness ~0.6, roughness ~0.35. */
export const STEEL_PBR = { metalness: 0.6, roughness: 0.35, envMapIntensity: 1.0 } as const;

/** Powder-coat door/window frames — between the two. */
export const FRAME_PBR = { metalness: 0.2, roughness: 0.5, envMapIntensity: 0.9 } as const;
