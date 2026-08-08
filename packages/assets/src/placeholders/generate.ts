/**
 * Procedural placeholder generators (SPEC: placeholder-first).
 *
 * For every manifest part this produces a THREE.Group with the SAME
 * contract as a loaded authored GLB:
 *   - correct real-world dimensions (bounding box == manifest dimensions)
 *   - origin at the SW-bottom attachment corner
 *   - group.name = part id, group.userData = { partId, placeholder: true }
 *
 * Authored Blender GLBs drop in with zero code change; internal mode renders
 * placeholders with a subtle wireframe overlay (flagged via userData).
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from "three";
import type { ManifestPart } from "../manifest.js";

/** PLACEHOLDER palette — replaced by real PBR materials with authored GLBs. */
const CATEGORY_COLORS: Record<ManifestPart["category"], number> = {
  structure: 0xdbcdac, // panel tan
  opening: 0x8a9bb0,
  roof: 0x4a4a4a,
  sitekit: 0x9aa88a,
  service: 0xb0b0b0,
};

function material(part: ManifestPart, color?: number): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: color ?? CATEGORY_COLORS[part.category],
    metalness: 0.2,
    roughness: 0.7,
  });
}

/** Box with its min corner at (x, y, z). */
function box(
  w: number,
  h: number,
  d: number,
  at: [number, number, number],
  mat: MeshStandardMaterial,
): Mesh {
  const geo = new BoxGeometry(w, h, d);
  geo.translate(at[0] + w / 2, at[1] + h / 2, at[2] + d / 2);
  return new Mesh(geo, mat);
}

export function createPlaceholderPart(part: ManifestPart): Group {
  const group = new Group();
  group.name = part.id;
  group.userData = { partId: part.id, placeholder: true, skus: part.skus };

  const { x, y, z } = part.dimensions;
  const mat = material(part);

  switch (true) {
    case part.id.startsWith("door-"): {
      // frame + inset leaf. The leaf is tagged so the renderer can give it a
      // powder-coat finish distinct from the reveal frame.
      const frame = 0.07;
      group.add(box(x, y, z, [0, 0, 0], mat));
      const leaf = box(x - 2 * frame, y - frame - 0.02, z / 2, [frame, 0.02, z / 4], material(part, 0x6e7f94));
      leaf.userData.leaf = true;
      group.add(leaf);
      break;
    }
    case part.id.startsWith("window-"): {
      // frame + glazing. The glazing mesh is tagged so ONLY it renders as
      // glass — the frame stays opaque (fixes see-through window units).
      const frame = 0.06;
      group.add(box(x, y, z, [0, 0, 0], mat));
      const glass = material(part, 0xa8c6d8);
      glass.transparent = true;
      glass.opacity = 0.55;
      const glazing = box(x - 2 * frame, y - 2 * frame, z / 2, [frame, frame, z / 4], glass);
      glazing.userData.glass = true;
      group.add(glazing);
      break;
    }
    case part.id === "tank-5000": {
      const r = Math.min(x, z) / 2;
      const geo = new CylinderGeometry(r, r, y, 20);
      geo.translate(x / 2, y / 2, z / 2);
      group.add(new Mesh(geo, mat));
      break;
    }
    case part.id === "rapta-walkway-bay": {
      const post = 0.09;
      const roofT = 0.12;
      for (const px of [0, x - post]) {
        for (const pz of [0, z - post]) {
          group.add(box(post, y - roofT, post, [px, 0, pz], mat));
        }
      }
      group.add(box(x, roofT, z, [0, y - roofT, 0], material(part, 0x4a4a4a)));
      break;
    }
    case part.id.startsWith("steps-"): {
      const nSteps = 4;
      for (let i = 0; i < nSteps; i++) {
        const h = ((i + 1) / nSteps) * y;
        group.add(box(x, h, z / nSteps, [0, 0, z - (i + 1) * (z / nSteps)], mat));
      }
      break;
    }
    case part.id.startsWith("balustrade-") && part.id !== "balustrade-post": {
      const railT = 0.06;
      const postT = 0.05;
      group.add(box(x, railT, z, [0, y - railT, 0], mat)); // top rail
      const nPosts = Math.max(2, Math.round(x / 0.6) + 1);
      for (let i = 0; i < nPosts; i++) {
        const px = (i / (nPosts - 1)) * (x - postT);
        group.add(box(postT, y - railT, Math.min(postT, z), [px, 0, 0], mat));
      }
      break;
    }
    default:
      // simple extrusion with correct dimensions
      group.add(box(x, y, z, [0, 0, 0], mat));
  }

  return group;
}
