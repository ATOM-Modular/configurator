/**
 * Material treatment for the 3D stage — calibrated toward ATOM's Enscape
 * sales renders (cream Surfmist walls, near-black Monument steel, soft
 * overcast light).
 *
 * INVARIANT: every material except glazing is fully opaque. Translucent
 * walls were a real bug (glass material bleeding onto window frames); the
 * factories below hard-set transparent:false / depthWrite:true / FrontSide
 * so it cannot recur.
 */
import {
  FrontSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  Vector2,
  type Material,
} from "three";
import { colorbondHex, FRAME_PBR, STEEL_PBR, WALL_PBR } from "./colorbond";
import { roofNormalMap, wallNormalMap } from "./textures";

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

/** Kept for callers that still want the raw hex (plan swatches etc.). */
export function colourHex(name: string): string {
  return colorbondHex(name);
}

/** Force the opacity invariant on any opaque material. */
function opaque<T extends Material>(m: T): T {
  m.transparent = false;
  m.opacity = 1;
  m.depthWrite = true;
  m.side = FrontSide;
  return m;
}

/** Painted EPS panel — matte, with the 1200mm joint groove. */
export function wallMaterial(colour: string): MeshStandardMaterial {
  const normal = wallNormalMap();
  normal.repeat.set(1, 1);
  return opaque(
    new MeshStandardMaterial({
      color: colorbondHex(colour),
      metalness: WALL_PBR.metalness,
      roughness: WALL_PBR.roughness,
      envMapIntensity: WALL_PBR.envMapIntensity,
      normalMap: normal,
      normalScale: new Vector2(0.4, 0.4),
    }),
  );
}

/** Colorbond coated steel — sheen + corrugation. */
export function steelMaterial(colour: string, corrugated = false): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    color: colorbondHex(colour),
    metalness: STEEL_PBR.metalness,
    roughness: STEEL_PBR.roughness,
    envMapIntensity: STEEL_PBR.envMapIntensity,
  });
  if (corrugated) {
    const normal = roofNormalMap();
    normal.wrapS = normal.wrapT = RepeatWrapping;
    normal.repeat.set(6, 1);
    mat.normalMap = normal;
    mat.normalScale = new Vector2(0.7, 0.7);
  }
  return opaque(mat);
}

/** Powder-coat door leaf / window frame. */
export function frameMaterial(colour = "Surfmist"): MeshStandardMaterial {
  return opaque(
    new MeshStandardMaterial({
      color: colorbondHex(colour),
      metalness: FRAME_PBR.metalness,
      roughness: FRAME_PBR.roughness,
      envMapIntensity: FRAME_PBR.envMapIntensity,
    }),
  );
}

/**
 * Real glazing — the ONLY transmissive material in the scene (SPEC).
 * MeshPhysicalMaterial transmission keeps it see-through without the sorting
 * pitfalls of plain alpha blending.
 */
export function glassMaterial(): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: "#aebfc9",
    metalness: 0,
    roughness: 0.06,
    transmission: 0.9,
    thickness: 0.04,
    ior: 1.5,
    envMapIntensity: 1.2,
  });
  m.transparent = true; // required for transmission compositing
  return m;
}
