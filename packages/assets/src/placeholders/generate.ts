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
  group.userData = {
    partId: part.id,
    placeholder: true,
    skus: part.skus,
    anchorFrame: part.anchorFrame,
  };

  const { x, y, z } = part.dimensions;
  const mat = material(part);

  switch (true) {
    case part.id.startsWith("door-"): {
      // A PUNCHED opening, not a full-bay slab: the bay stays wall on both
      // jambs + a head panel above the door, with the door leaf recessed into
      // the hole. Meshes are tagged so the renderer paints the surround in the
      // WALL colour and the leaf as powder-coat — so a door reads as a door
      // (was a featureless dark rectangle before). The recess gives a reveal
      // shadow that frames the leaf without a separate (occluding) frame box.
      const leafW = Math.min(0.92, x - 0.12);
      const leafH = Math.min(2.1, y - 0.08);
      const x0 = (x - leafW) / 2;
      const surround = (w: number, h: number, at: [number, number, number]) => {
        const b = box(w, h, z, at, material(part));
        b.userData.wallSurround = true; // painted in the wall colour
        group.add(b);
      };
      surround(x0, y, [0, 0, 0]); // left jamb
      surround(x - (x0 + leafW), y, [x0 + leafW, 0, 0]); // right jamb
      surround(leafW, y - leafH, [x0, leafH, 0]); // head panel above the door
      // leaf, recessed 15% of the wall thickness so a reveal shadow frames it
      const leaf = box(leafW, leafH, z * 0.85, [x0, 0, z * 0.15], material(part, 0x8b9096));
      leaf.userData.leaf = true;
      group.add(leaf);
      break;
    }
    case part.id.startsWith("window-"): {
      // A PUNCHED window: wall sill below + head above + jambs each side, with
      // recessed glazing in the hole (tagged so ONLY it renders as glass, the
      // surround as wall). Was a full-height dark slab that didn't read as a
      // window.
      const winW = Math.min(1.175, x - 0.1);
      const sillH = 0.9;
      const headH = Math.min(2.1, y - 0.1);
      const x0 = (x - winW) / 2;
      const surround = (w: number, h: number, at: [number, number, number]) => {
        const b = box(w, h, z, at, material(part));
        b.userData.wallSurround = true;
        group.add(b);
      };
      surround(x0, y, [0, 0, 0]); // left jamb
      surround(x - (x0 + winW), y, [x0 + winW, 0, 0]); // right jamb
      surround(winW, sillH, [x0, 0, 0]); // sill wall below the window
      surround(winW, y - headH, [x0, headH, 0]); // head wall above
      const glazing = box(winW, headH - sillH, z * 0.85, [x0, sillH, z * 0.15], material(part));
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
    case part.id === "rapta-cover": {
      // RAPTA Cover™: a flat canopy — Monument steel posts + a boxed perimeter
      // frame carrying a low roof deck of alternating opaque (Colorbond) and
      // translucent (polycarbonate) strips. Open sides. Steel meshes are tagged
      // for the Monument finish; translucent strips are tagged as glass.
      const post = 0.1;
      const bw = 0.09; // perimeter frame beam width
      const frameH = 0.2; // frame depth
      const roofT = 0.05;
      const postH = y - frameH; // posts up to the underside of the frame
      const steel = (w: number, h: number, d: number, at: [number, number, number]) => {
        const m = box(w, h, d, at, mat);
        m.userData.steel = true;
        group.add(m);
      };
      // 6 posts: 3 columns × 2 rows (front/back)
      for (const px of [0, x / 2 - post / 2, x - post]) {
        for (const pz of [0, z - post]) steel(post, postH, post, [px, 0, pz]);
      }
      // boxed perimeter frame at the top
      steel(x, frameH, bw, [0, postH, 0]);
      steel(x, frameH, bw, [0, postH, z - bw]);
      steel(bw, frameH, z, [0, postH, 0]);
      steel(bw, frameH, z, [x - bw, postH, 0]);
      // roof deck: alternating opaque / translucent strips within the frame
      const rw = x - 2 * bw;
      const rd = z - 2 * bw;
      const strips = Math.max(6, Math.round(rw / 0.6));
      const sw = rw / strips;
      const roofY = postH + (frameH - roofT) * 0.6;
      for (let i = 0; i < strips; i++) {
        const translucent = i % 2 === 1;
        const glass = material(part, 0xa8c6d8);
        glass.transparent = true;
        glass.opacity = 0.5;
        const m = box(sw * 0.96, roofT, rd, [bw + i * sw, roofY, bw], translucent ? glass : mat);
        if (translucent) m.userData.glass = true;
        else m.userData.steel = true;
        group.add(m);
      }
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
