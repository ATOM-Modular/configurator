/**
 * Material treatment for the 3D stage.
 *
 * Calibrated against ATOM's own sales renders (Central Darling PSL R0):
 * cream Surfmist EPS wall panels read as a low-sheen painted surface, while
 * the Monument roof, cappings, gutter and downpipes read as coated steel
 * with a visible sheen. That cream/near-black contrast is the single
 * strongest visual signature of an ATOM building.
 *
 * [CHECK with Duane] metalness/roughness are SPEC starting values — worth
 * calibrating against physical Colorbond swatches.
 */
import { Color, MeshStandardMaterial } from "three";
import { COLORBOND_COLOURS } from "../state/presets";

/** Parts whose colour follows the WALL selection. */
export const WALL_PARTS = new Set(["panel-wall-1200", "panel-wall-cut"]);

/** Parts whose colour follows the ROOF selection (Monument by default). */
export const ROOF_PARTS = new Set([
  "roof-sheet-skillion",
  "capping-ridge",
  "capping-fascia",
  "barge-gutter-section",
  "downpipe",
  "flashing-corner",
  "flashing-basechannel",
  "flashing-tee-join",
  "chassis-edge",
]);

export function colourHex(name: string): string {
  return COLORBOND_COLOURS.find((c) => c.name === name)?.hex ?? "#E4E2D5";
}

/** Painted EPS panel — matte, barely any specular. */
export function wallMaterial(colour: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(colourHex(colour)),
    metalness: 0.04,
    roughness: 0.72,
  });
}

/** Colorbond steel — SPEC: metalness 0.55–0.7, roughness 0.3–0.4. */
export function steelMaterial(colour: string): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color(colourHex(colour)),
    metalness: 0.62,
    roughness: 0.36,
  });
}

export function glassMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: new Color("#93a7b4"),
    metalness: 0.25,
    roughness: 0.08,
    transparent: true,
    opacity: 0.62,
  });
}
