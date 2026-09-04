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
import { roofNormalMap, wallNormalMap, wallSeamMap } from "./textures";

/** Parts whose colour follows the WALL selection. */
export const WALL_PARTS = new Set(["panel-wall-1200", "panel-wall-cut"]);

/**
 * Generically-rendered parts that take the Monument steel treatment. Roof
 * parts themselves are drawn by <RoofSolid> (not here); this set is the
 * wall-frame flashings + chassis edge that still render as placeholder boxes.
 */
export const ROOF_PARTS = new Set([
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

/** Painted EPS panel — matte, with a visible 1200mm joint at every angle. */
export function wallMaterial(colour: string): MeshStandardMaterial {
  const normal = wallNormalMap();
  normal.repeat.set(1, 1);
  const seam = wallSeamMap();
  seam.repeat.set(1, 1);
  return opaque(
    new MeshStandardMaterial({
      color: colorbondHex(colour),
      map: seam, // faint albedo seam so joints read under flat light
      metalness: WALL_PBR.metalness,
      roughness: WALL_PBR.roughness,
      envMapIntensity: WALL_PBR.envMapIntensity,
      normalMap: normal,
      normalScale: new Vector2(0.28, 0.28),
    }),
  );
}

/** Galvanised / concrete footing block — dark, matte, no sheen. */
export function footingMaterial(): MeshStandardMaterial {
  return opaque(
    new MeshStandardMaterial({ color: "#6b6d6e", metalness: 0.1, roughness: 0.9 }),
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

/**
 * Door/window frame — dark anodised charcoal so openings read clearly
 * against cream walls (a Surfmist frame on a Surfmist wall is invisible,
 * which is exactly why placed windows disappeared).
 */
export function frameMaterial(): MeshStandardMaterial {
  return opaque(
    new MeshStandardMaterial({
      color: "#33363a",
      metalness: FRAME_PBR.metalness,
      roughness: FRAME_PBR.roughness,
      envMapIntensity: FRAME_PBR.envMapIntensity,
    }),
  );
}

/**
 * Door leaf — a brushed powder-coat, lighter than the charcoal reveal frame
 * so the leaf reads as a distinct panel inside the frame (a door that looks
 * like a door, not a flat dark rectangle).
 */
export function doorLeafMaterial(): MeshStandardMaterial {
  return opaque(
    new MeshStandardMaterial({
      color: "#8b9096",
      metalness: 0.35,
      roughness: 0.5,
      envMapIntensity: 1.0,
    }),
  );
}

/**
 * Glazing — the ONLY transmissive material in the scene (SPEC). Tinted and
 * reflective so it reads as a real window (picking up the sky) against a cream
 * wall rather than a flat dark hole. Kept modestly transmissive so the frame
 * behind it never bleeds through as translucent (the historical wall bug).
 */
export function glassMaterial(): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: "#6d8794",
    metalness: 0.1,
    roughness: 0.04,
    transmission: 0.45,
    thickness: 0.04,
    ior: 1.5,
    reflectivity: 0.75,
    envMapIntensity: 2.0,
  });
  m.transparent = true; // required for transmission compositing
  return m;
}
