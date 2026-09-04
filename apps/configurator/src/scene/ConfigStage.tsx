import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls, PointerLockControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MathUtils,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from "three";
import { resetWalkInput, walkInput } from "./walkInput";
import {
  assembleBuilding,
  assembleWalkway,
  createPlaceholderPart,
  getPart,
  loadManifest,
  MODULE_WIDTH_M,
  ROOF_PITCH_DEG,
  WALL_HEIGHT_EAVE_M,
  type PlacedPart,
} from "@atom/assets";
import { footprint, walkwayGeometry } from "../site/geometry";
import { activeBuilding, useConfigurator, type BuildingState } from "../state/store";
import {
  doorLeafMaterial,
  footingMaterial,
  frameMaterial,
  glassMaterial,
  ROOF_PARTS,
  steelMaterial,
  WALL_PARTS,
  wallMaterial,
} from "./materials";
import { groundColorMap, proceduralSky, roofNormalMap } from "./textures";

/** ¾-aerial hero pose (SPEC benchmark camera): 45° azimuth, 35° elevation. */
export function benchmarkPose(view: { cx: number; cz: number; span: number }) {
  const d = view.span * 1.7;
  const el = MathUtils.degToRad(35);
  const az = MathUtils.degToRad(45);
  const horiz = Math.cos(el) * d;
  return {
    position: [
      view.cx + horiz * Math.cos(az),
      Math.sin(el) * d + 1,
      view.cz + horiz * Math.sin(az),
    ] as [number, number, number],
    target: [view.cx, 1.2, view.cz] as [number, number, number],
  };
}

const manifest = loadManifest();
const prototypes = new Map<string, Group>();

/**
 * Roof-trim developed dimensions, read from the manufacture drawings via
 * manifest.trimSpecs (Central Darling / RhinoSite / Air Liquide). RoofSolid
 * renders to THESE numbers so the flashing reconciles with the shop drawings
 * rather than eyeballed values. Millimetres → metres.
 */
const _ts = (manifest.trimSpecs ?? {}) as Record<string, { [k: string]: number }>;
const _mm = (v: number | undefined, fallback: number) => (v ?? fallback) / 1000;
const TRIM = {
  oversail: _mm(_ts.oversailMm as unknown as number, 65),
  fasciaFace: _mm(_ts.fasciaCappingRaked?.faceMm, 320),
  fasciaReturn: _mm(_ts.fasciaCappingRaked?.returnMm, 155),
  bargeTop: _mm(_ts.bargeCappingEnd?.topMm, 100),
  bargeFace: _mm(_ts.bargeCappingEnd?.faceMm, 125),
  gutterFace: _mm(_ts.gutterQuadEnd?.faceMm, 100),
  gutterDepth: _mm(_ts.gutterQuadEnd?.depthMm, 100),
  ridgeDev: _mm(_ts.ridgeCap?.developedWidthMm, 550),
};

function instantiate(
  p: PlacedPart,
  wallColour: string,
  roofColour: string,
  dim: boolean,
): Group {
  let proto = prototypes.get(p.partId);
  if (!proto) {
    proto = createPlaceholderPart(getPart(manifest, p.partId));
    prototypes.set(p.partId, proto);
  }
  const obj = proto.clone(true);
  obj.position.set(...p.position);
  obj.rotation.y = MathUtils.degToRad(p.rotationYDeg);
  if (p.scale) obj.scale.set(...p.scale);
  // Footings must reach the chassis underside — stretch to close the gap
  // between the ground and the sub-floor beam (was rendering as stilts).
  if (p.partId === "footing-surefoot") {
    const fflLocal = -p.position[1];
    const CHASSIS_H = 0.175;
    const FOOTING_PART_H = 0.3;
    obj.scale.y = Math.max(0.05, fflLocal - CHASSIS_H) / FOOTING_PART_H;
  }
  obj.userData = { ...proto.userData, meta: p.meta, partId: p.partId };

  const isWall = WALL_PARTS.has(p.partId);
  const isSteel = ROOF_PARTS.has(p.partId);
  const isOpening = p.partId.startsWith("window-") || p.partId.startsWith("door-");
  const corrugated = p.partId === "roof-sheet-skillion";

  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Per-mesh so a window's glazing is glass, its surround takes the wall
    // colour, its leaf a powder-coat, and only the reveal frame stays charcoal.
    let mat: MeshStandardMaterial | ReturnType<typeof glassMaterial>;
    if (mesh.userData.glass) mat = glassMaterial();
    else if (mesh.userData.steel) mat = steelMaterial(roofColour, false);
    else if (mesh.userData.wallSurround) mat = wallMaterial(wallColour);
    else if (mesh.userData.leaf) mat = doorLeafMaterial();
    else if (p.partId === "footing-surefoot") mat = footingMaterial();
    else if (isWall) mat = wallMaterial(wallColour);
    else if (isSteel) mat = steelMaterial(roofColour, corrugated);
    else if (isOpening) mat = frameMaterial();
    else mat = wallMaterial(wallColour);

    if (dim && "color" in mat) mat.color.multiplyScalar(0.82);
    mesh.material = mat;
  });
  return obj;
}

function buildingPlacements(b: BuildingState): PlacedPart[] {
  const result = assembleBuilding(
    {
      lengthM: b.lengthM,
      widthM: b.widthM,
      ffl_mm: b.ffl_mm,
      openings: b.openings.map((o) => ({
        elevation: o.elevation,
        partId: o.partId,
        startBay: o.startBay,
      })),
    },
    manifest,
  );
  return result.placements.filter((p) => {
    // Everything on the roof frame (sheets, cappings, gutter, fascia, cover
    // flashing) plus the downpipe is drawn cleanly by <RoofSolid>; their
    // placeholder boxes are excluded from the generic scene render.
    if (getPart(manifest, p.partId).anchorFrame === "roof") return false;
    if (p.partId === "downpipe-100x50") return false;
    return true;
  });
}

/**
 * ATOM standard roof, drawn as a solid (source of truth: manufacture drawings
 * + Blaise gutter/downpipe sheet):
 *  - shallow dual-fall roof, ridge ACROSS the width at MID-LENGTH, 2° each
 *    side draining to the two SHORT ends; ridge = eave + tan(2°)·(L/2)
 *  - one continuous roof over the whole footprint; multi-module joins get a
 *    raised lengthwise cover flashing (no valley, no change in fall)
 *  - corrugation ribs run ALONG the length (parallel to fall)
 *  - gutters across the two short ends only; long sides carry a raking fascia
 *  - downpipes 100×50 at the end-wall corners
 * Everything is Monument (b.roofColour).
 */
function RoofSolid({ b }: { b: BuildingState }) {
  const L = b.lengthM;
  const W = b.widthM;
  const eaveH = WALL_HEIGHT_EAVE_M;
  const pitch = MathUtils.degToRad(ROOF_PITCH_DEG);
  const rise = Math.tan(pitch) * (L / 2);
  const ridgeH = eaveH + rise;
  const oh = TRIM.oversail; // 65mm oversail past the wall line (drawings)
  const fasciaDrop = TRIM.fasciaFace; // 320mm raking-fascia face (drawings)
  const multi = W > 3.4;
  const rakeAngle = Math.atan2(rise, L / 2);
  const slopeLen = Math.hypot(L / 2, rise);

  const geom = useMemo(() => {
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const v = (x: number, y: number, z: number, u: number, w: number) => {
      pos.push(x, y, z);
      uv.push(u, w);
      return pos.length / 3 - 1;
    };
    const quad = (a: number, c: number, d: number, e: number) => idx.push(a, c, d, a, d, e);

    // roof surface — ribs along length ⇒ u = z/W (across width), v = x/L
    const zS = -oh;
    const zN = W + oh;
    const AwS = v(-oh, eaveH, zS, zS / W, 0);
    const AwN = v(-oh, eaveH, zN, zN / W, 0);
    const RdS = v(L / 2, ridgeH, zS, zS / W, 0.5);
    const RdN = v(L / 2, ridgeH, zN, zN / W, 0.5);
    const EwS = v(L + oh, eaveH, zS, zS / W, 1);
    const EwN = v(L + oh, eaveH, zN, zN / W, 1);
    quad(AwS, AwN, RdN, RdS); // west slope
    quad(RdS, RdN, EwN, EwS); // east slope

    // raking fascia hanging below the two long edges (follows the rake, peaks
    // at mid-length — the dominant profile on the long elevations)
    const fascia = (zEdge: number) => {
      const t0 = v(-oh, eaveH, zEdge, 0, 0);
      const t1 = v(L / 2, ridgeH, zEdge, 0, 0);
      const t2 = v(L + oh, eaveH, zEdge, 0, 0);
      const b0 = v(-oh, eaveH - fasciaDrop, zEdge, 0, 0);
      const b1 = v(L / 2, ridgeH - fasciaDrop, zEdge, 0, 0);
      const b2 = v(L + oh, eaveH - fasciaDrop, zEdge, 0, 0);
      quad(t0, t1, b1, b0);
      quad(t1, t2, b2, b1);
    };
    fascia(zS);
    fascia(zN);

    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [L, W, eaveH, ridgeH]);

  const mat = useMemo(() => {
    const normal = roofNormalMap().clone();
    normal.needsUpdate = true;
    // ribs repeat across the width → each rib runs the length (down the fall)
    normal.repeat.set(Math.max(6, Math.round(W * 4)), 1);
    const m = steelMaterial(b.roofColour, false);
    m.normalMap = normal;
    m.normalScale = new Vector2(0.6, 0.6);
    m.side = DoubleSide;
    return m;
  }, [b.roofColour, W]);

  const trim = useMemo(() => steelMaterial(b.roofColour, false), [b.roofColour]);

  const joins: number[] = [];
  if (multi) for (let z = MODULE_WIDTH_M; z < W - 0.01; z += MODULE_WIDTH_M) joins.push(z);

  // Downpipes sit ~120mm in from the end-wall corners; stop just under the
  // chassis so they hug the building envelope instead of dangling to the ground
  // through the open under-floor.
  const dpZ = multi ? [0.12, W - 0.12] : [0.12];
  const dpTop = eaveH;
  const dpBottom = -0.2; // just below the chassis underside (−0.175)
  const dpH = dpTop - dpBottom;

  return (
    <group>
      <mesh geometry={geom} material={mat} castShadow receiveShadow />

      {/* ridge cap ACROSS the width at mid-length (550mm developed, folded
          shallow over the 2° ridge → ~half that as a horizontal footprint) */}
      <mesh position={[L / 2, ridgeH + 0.015, W / 2]} material={trim} castShadow>
        <boxGeometry args={[TRIM.ridgeDev / 2, 0.04, W + 2 * oh]} />
      </mesh>

      {/* module-join cover flashing — raised, full length, following the fall
          (two segments meeting at the ridge). NO valley. */}
      {joins.map((z, i) => (
        <group key={`join-${i}`}>
          <mesh
            position={[L / 4, eaveH + rise / 2 + 0.03, z]}
            rotation={[0, 0, rakeAngle]}
            material={trim}
            castShadow
          >
            <boxGeometry args={[slopeLen, 0.05, 0.3]} />
          </mesh>
          <mesh
            position={[(3 * L) / 4, eaveH + rise / 2 + 0.03, z]}
            rotation={[0, 0, -rakeAngle]}
            material={trim}
            castShadow
          >
            <boxGeometry args={[slopeLen, 0.05, 0.3]} />
          </mesh>
        </group>
      ))}

      {/* Barge capping down each SHORT end (drawings: 100mm top return lapping
          over the roof + 125mm face over the end wall). Roof-edge trim — always
          present, gutters or not — this is what closes the eave at the ends. */}
      {[-oh, L + oh].map((x, i) => {
        const inward = i === 0 ? 1 : -1; // lap the top return back over the roof
        return (
          <group key={`barge-${i}`}>
            <mesh
              position={[x + inward * (TRIM.bargeTop / 2), eaveH + 0.02, W / 2]}
              material={trim}
              castShadow
            >
              <boxGeometry args={[TRIM.bargeTop, 0.04, W + 2 * oh]} />
            </mesh>
            <mesh
              position={[x, eaveH - TRIM.bargeFace / 2, W / 2]}
              material={trim}
              castShadow
            >
              <boxGeometry args={[0.04, TRIM.bargeFace, W + 2 * oh]} />
            </mesh>
          </group>
        );
      })}

      {b.gutters && (
        <>
          {/* quad gutter (100×100) across each SHORT end, under the barge face */}
          {[-oh, L + oh].map((x, i) => (
            <mesh
              key={`gut-${i}`}
              position={[x, eaveH - TRIM.bargeFace - TRIM.gutterFace / 2, W / 2]}
              material={trim}
              castShadow
            >
              <boxGeometry args={[TRIM.gutterDepth, TRIM.gutterFace, W + 2 * oh]} />
            </mesh>
          ))}
          {/* 100×50 downpipes flat against the EXTERIOR of each end wall,
              hugging the corner: wide face (0.1) runs along the wall, the 0.05
              edge protrudes. */}
          {[-0.025, L + 0.025].flatMap((x, xi) =>
            dpZ.map((z, zi) => (
              <mesh
                key={`dp-${xi}-${zi}`}
                position={[x, dpBottom + dpH / 2, z]}
                material={trim}
                castShadow
              >
                <boxGeometry args={[0.05, dpH, 0.1]} />
              </mesh>
            )),
          )}
        </>
      )}
    </group>
  );
}

function BuildingModel({ b, interactive }: { b: BuildingState; interactive: boolean }) {
  const pending = useConfigurator((s) => s.pendingOpeningPartId);
  const placePendingOpening = useConfigurator((s) => s.placePendingOpening);
  const selectBuilding = useConfigurator((s) => s.selectBuilding);
  const activeId = useConfigurator((s) => s.activeId);
  const mode = useConfigurator((s) => s.mode);

  const dim = mode === "site" && b.id !== activeId;

  const objects = useMemo(
    () => buildingPlacements(b).map((p) => instantiate(p, b.colour, b.roofColour, dim)),
    [b, dim],
  );

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) {
      selectBuilding(b.id);
      return;
    }
    if (!pending) return;
    const meta = e.eventObject.userData?.meta as
      | { elevation?: string; bay?: number }
      | undefined;
    const partId = e.eventObject.userData?.partId as string | undefined;
    if (partId === "panel-wall-1200" && meta?.elevation && meta.bay !== undefined) {
      e.stopPropagation();
      placePendingOpening(meta.elevation as never, meta.bay);
    }
  };

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || !pending) return;
    if (e.eventObject.userData?.partId !== "panel-wall-1200") return;
    e.eventObject.traverse((c) => {
      const m = c as Mesh;
      if (m.isMesh) (m.material as MeshStandardMaterial).emissive.set(0xba0c2f);
    });
    document.body.style.cursor = "crosshair";
  };
  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.eventObject.traverse((c) => {
      const m = c as Mesh;
      if (m.isMesh) (m.material as MeshStandardMaterial).emissive.set(0x000000);
    });
    document.body.style.cursor = "auto";
  };

  return (
    <group
      position={[b.placement.xM, b.ffl_mm / 1000, b.placement.zM]}
      rotation={[0, MathUtils.degToRad(-b.placement.rotationDeg), 0]}
    >
      {/* interior floor at FFL (group origin) — a surface to stand on in walk
          mode, and closes the view through the doorway in orbit mode */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[b.lengthM / 2, 0.002, b.widthM / 2]} receiveShadow>
        <planeGeometry args={[b.lengthM, b.widthM]} />
        <meshStandardMaterial color={0xd8d3c8} roughness={0.92} metalness={0} />
      </mesh>
      {objects.map((o, i) => (
        <primitive
          key={i}
          object={o}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      ))}
      {b.partitionsX.map((x, i) => (
        <mesh key={`part-${i}`} position={[x, 1.35, b.widthM / 2]} castShadow>
          <boxGeometry args={[0.09, 2.7, b.widthM - 0.1]} />
          <meshStandardMaterial color={0xe8e4d8} roughness={0.85} metalness={0.03} />
        </mesh>
      ))}
      {/* drawn partition segments (placedInstances with a second endpoint) */}
      {b.placedInstances
        .filter((p) => p.x2M !== undefined && p.y2M !== undefined)
        .map((p) => {
          const cx = (p.xM + p.x2M!) / 2;
          const cz = (p.yM + p.y2M!) / 2;
          const len = Math.hypot(p.x2M! - p.xM, p.y2M! - p.yM);
          const angle = Math.atan2(p.y2M! - p.yM, p.x2M! - p.xM);
          return (
            <mesh key={p.instanceId} position={[cx, 1.35, cz]} rotation={[0, -angle, 0]} castShadow>
              <boxGeometry args={[len, 2.7, 0.09]} />
              <meshStandardMaterial color={0xe8e4d8} roughness={0.85} metalness={0.03} />
            </mesh>
          );
        })}
      <RoofSolid b={b} />
    </group>
  );
}

function Walkways() {
  const buildings = useConfigurator((s) => s.buildings);
  const walkways = useConfigurator((s) => s.walkways);

  const objects = useMemo(() => {
    const out: Group[] = [];
    for (const w of walkways) {
      const from = buildings.find((b) => b.id === w.fromBuildingId);
      const to = buildings.find((b) => b.id === w.toBuildingId);
      if (!from || !to) continue;
      const link = walkwayGeometry(from, to);
      if (!link) continue;
      const y = w.elevated ? Math.max(from.ffl_mm, to.ffl_mm) / 1000 : 0;
      const run = assembleWalkway(
        {
          gapM: link.gapM,
          origin: [link.origin[0], y, link.origin[2]],
          rotationYDeg: link.axis === "x" ? 0 : 90,
        },
        manifest,
      );
      out.push(...run.placements.map((p) => instantiate(p, "Shale Grey", "Monument", false)));
    }
    return out;
  }, [buildings, walkways]);

  return (
    <group>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}

function SiteKitModels() {
  const siteKit = useConfigurator((s) => s.siteKit);
  const objects = useMemo(
    () =>
      siteKit.map((k) =>
        instantiate(
          {
            partId: k.partId,
            position: [k.xM, 0, k.zM],
            rotationYDeg: k.rotationDeg as 0 | 90 | 180 | 270,
          },
          "Shale Grey",
          "Monument",
          false,
        ),
      ),
    [siteKit],
  );
  return (
    <group>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}

/**
 * Overcast-daylight IBL from a procedural equirectangular sky, used for both
 * reflections and the visible background. SPEC calls for a Poly Haven HDRI;
 * this keeps the bundle self-contained (no CDN fetch) and a real .hdr is a
 * drop-in via drei <Environment files>. The env map is what gives Colorbond
 * steel its sheen — flat lights on flat materials read as plastic.
 */
function SceneEnv() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const sky = proceduralSky();
    scene.environment = sky;
    scene.background = sky;
    return () => {
      scene.environment = null;
    };
  }, [scene]);
  return null;
}

/**
 * Benchmark discipline (SPEC): snap the hero pose (window "atom-benchmark"
 * event or the "b" key) and export a 1920×1080 PNG ("atom-capture" event).
 * Internal-mode buttons in the stage dispatch these.
 */
function CaptureRig({ view }: { view: { cx: number; cz: number; span: number } }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: { set: (x: number, y: number, z: number) => void }; update: () => void }
    | null;

  useEffect(() => {
    const snap = () => {
      const pose = benchmarkPose(view);
      camera.position.set(...pose.position);
      if (controls?.target) {
        controls.target.set(...pose.target);
        controls.update();
      }
      camera.lookAt(...pose.target);
    };

    const capture = () => {
      const prev = new Vector2();
      gl.getSize(prev);
      const W = 1920;
      const H = 1080;
      const cam = camera as { aspect: number; updateProjectionMatrix: () => void };
      const prevAspect = cam.aspect;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      gl.setSize(W, H, false);
      gl.render(scene, camera);
      const url = gl.domElement.toDataURL("image/png");
      cam.aspect = prevAspect;
      cam.updateProjectionMatrix();
      gl.setSize(prev.x, prev.y, false);
      const a = document.createElement("a");
      a.href = url;
      a.download = "atom-benchmark-1920x1080.png";
      a.click();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "b" && !/input|textarea|select/i.test((e.target as Element)?.tagName ?? "")) {
        snap();
      }
    };
    window.addEventListener("atom-benchmark", snap);
    window.addEventListener("atom-capture", capture);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("atom-benchmark", snap);
      window.removeEventListener("atom-capture", capture);
      window.removeEventListener("keydown", onKey);
    };
  }, [gl, scene, camera, controls, view]);

  return null;
}

/** Large textured ground plane with mottled gravel so tiling doesn't read. */
function GroundPlane({ cx, cz }: { cx: number; cz: number }) {
  const map = useMemo(() => {
    const t = groundColorMap();
    t.repeat.set(24, 24);
    return t;
  }, []);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, cz]} receiveShadow>
      <planeGeometry args={[220, 220]} />
      <meshStandardMaterial map={map} roughness={0.97} metalness={0} />
    </mesh>
  );
}

// --- First-person walkthrough -------------------------------------------
const EYE_H = 1.6; // eye height above the floor (metres)
const WALK_SPEED = 2.8; // m/s
const RUN_SPEED = 5.2; // m/s (Shift)
const PLAYER_R = 0.32; // clearance kept from solid walls

interface DoorGaps {
  south: [number, number][];
  north: [number, number][];
  west: [number, number][];
  east: [number, number][];
}

/** Door openings expressed as clear spans along each elevation (local metres). */
function doorGaps(b: BuildingState): DoorGaps {
  const g: DoorGaps = { south: [], north: [], west: [], east: [] };
  for (const o of b.openings) {
    if (!o.partId.includes("door")) continue; // only doors are walk-through
    const m = /(\d{3,4})/.exec(o.partId);
    const w = m ? +m[1]! / 1000 : 0.9;
    const bays = o.partId.includes("1600") ? 2 : 1;
    const centre = (o.startBay + bays / 2) * 1.2;
    const half = w / 2 + 0.12;
    g[o.elevation].push([centre - half, centre + half]);
  }
  return g;
}
const inGap = (t: number, gaps: [number, number][]) =>
  gaps.some(([a, b]) => t >= a && t <= b);

/**
 * First-person controls (desktop + touch):
 *  - Look: pointer-lock mouse on desktop, or the on-screen look-pad on touch —
 *    both feed walkInput.look. Move: WASD/arrows + the on-screen joystick
 *    (walkInput.move). Shift runs.
 *  - Eye height locked to the building floor, with a subtle walking head-bob.
 *  - Wider FOV than the orbit hero view; restored on exit.
 *  - Walls are solid (keep PLAYER_R clearance, can't be crossed) EXCEPT at door
 *    openings, so you enter by walking through a door. Collision runs in the
 *    building's local frame so rotated placements work.
 */
function WalkControls({ b }: { b: BuildingState }) {
  const camera = useThree((s) => s.camera);
  // Desktop → drei PointerLockControls owns mouse-look (click to capture).
  // Touch → the on-screen look-pad drives yaw/pitch manually. Detect once.
  const isTouch = useMemo(
    () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches,
    [],
  );
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const bobPhase = useRef(0);
  const bobAmp = useRef(0);
  const fwd = useRef(new Vector3());
  const floorY = b.ffl_mm / 1000;
  const gaps = useMemo(() => doorGaps(b), [b]);
  const L = b.lengthM;
  const W = b.widthM;
  const thetaG = MathUtils.degToRad(-b.placement.rotationDeg);
  const cos = Math.cos(thetaG);
  const sin = Math.sin(thetaG);
  const Xo = b.placement.xM;
  const Zo = b.placement.zM;
  const toWorld = (lx: number, lz: number): [number, number] => [
    cos * lx + sin * lz + Xo,
    -sin * lx + cos * lz + Zo,
  ];
  const toLocal = (wx: number, wz: number): [number, number] => {
    const dx = wx - Xo;
    const dz = wz - Zo;
    return [cos * dx - sin * dz, sin * dx + cos * dz];
  };

  // Wider field of view for the walkthrough; restore the hero FOV on exit.
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const prevFov = cam.fov;
    cam.fov = 78;
    cam.updateProjectionMatrix();
    return () => {
      cam.fov = prevFov;
      cam.updateProjectionMatrix();
    };
  }, [camera]);

  // Spawn just outside the main door (or the south face), facing inward.
  useEffect(() => {
    const d = b.openings.find((o) => o.partId.includes("door"));
    let start: [number, number];
    let look: [number, number];
    if (d) {
      const bays = d.partId.includes("1600") ? 2 : 1;
      const c = (d.startBay + bays / 2) * 1.2;
      if (d.elevation === "south") { start = [c, -1.8]; look = [c, 2]; }
      else if (d.elevation === "north") { start = [c, W + 1.8]; look = [c, W - 2]; }
      else if (d.elevation === "west") { start = [-1.8, c]; look = [2, c]; }
      else { start = [L + 1.8, c]; look = [L - 2, c]; }
    } else {
      start = [L / 2, -2.6];
      look = [L / 2, W / 2];
    }
    const [wx, wz] = toWorld(start[0], start[1]);
    const [lx, lz] = toWorld(look[0], look[1]);
    camera.position.set(wx, floorY + EYE_H, wz);
    camera.lookAt(lx, floorY + EYE_H, lz); // desktop: drei picks up from here
    yaw.current = Math.atan2(-(lx - wx), -(lz - wz));
    pitch.current = 0;
  }, [b.id]);

  // Keyboard (desktop)
  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Zero any touch input when leaving walk mode.
  useEffect(() => () => resetWalkInput(), []);

  // DEV-only: expose the walk camera for manual verification (stripped in prod)
  useEffect(() => {
    if ((import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
      (window as unknown as { __cam?: unknown }).__cam = camera;
    }
  }, [camera]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);

    // --- look: TOUCH only (desktop mouse-look is owned by PointerLockControls) ---
    if (isTouch) {
      const LOOK = 0.0026;
      yaw.current -= walkInput.look.dx * LOOK;
      pitch.current -= walkInput.look.dy * LOOK;
      walkInput.look.dx = 0;
      walkInput.look.dy = 0;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current));
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    }

    // --- movement: keyboard + joystick, blended and clamped ---
    const k = keys.current;
    let f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + walkInput.move.f;
    let s = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + walkInput.move.s;
    f = Math.max(-1, Math.min(1, f));
    s = Math.max(-1, Math.min(1, s));
    const moving = Math.abs(f) > 0.06 || Math.abs(s) > 0.06;

    if (moving) {
      // forward from wherever the camera is actually looking (drei on desktop,
      // manual yaw/pitch on touch), flattened to the floor plane
      camera.getWorldDirection(fwd.current);
      fwd.current.y = 0;
      const flen = Math.hypot(fwd.current.x, fwd.current.z) || 1;
      const fx = fwd.current.x / flen;
      const fz = fwd.current.z / flen;
      const rx = -fz; // right = forward × up
      const rz = fx;
      let dx = fx * f + rx * s;
      let dz = fz * f + rz * s;
      const len = Math.hypot(dx, dz) || 1;
      const speed = (k.ShiftLeft || k.ShiftRight ? RUN_SPEED : WALK_SPEED) * step;
      dx = (dx / len) * speed;
      dz = (dz / len) * speed;

      const oldWx = camera.position.x;
      const oldWz = camera.position.z;
      const [px, pz] = toLocal(oldWx, oldWz);
      const wanted = toLocal(oldWx + dx, oldWz + dz);
      let nx = wanted[0];
      let nz = wanted[1];
      // block crossing a solid wall span (keep PLAYER_R clearance); door gaps pass
      const clamp = (
        prevPerp: number, newPerp: number, wallC: number, tangent: number, wg: [number, number][],
      ) => {
        if (inGap(tangent, wg)) return newPerp;
        const crossed = (prevPerp - wallC) * (newPerp - wallC) < 0;
        if (crossed || Math.abs(newPerp - wallC) < PLAYER_R) {
          return wallC + Math.sign(prevPerp - wallC || 1) * PLAYER_R;
        }
        return newPerp;
      };
      nx = clamp(px, nx, 0, nz, gaps.west);
      nx = clamp(px, nx, L, nz, gaps.east);
      nz = clamp(pz, nz, 0, nx, gaps.south);
      nz = clamp(pz, nz, W, nx, gaps.north);
      const [wx, wz] = toWorld(nx, nz);
      camera.position.x = wx;
      camera.position.z = wz;

      // walking head-bob — advance ~one bob per 0.45 m actually travelled
      const dist = Math.hypot(wx - oldWx, wz - oldWz);
      bobPhase.current += (dist / 0.45) * Math.PI;
      const targetAmp = k.ShiftLeft || k.ShiftRight ? 0.075 : 0.05;
      bobAmp.current += (targetAmp - bobAmp.current) * Math.min(1, step * 8);
    } else {
      bobAmp.current += (0 - bobAmp.current) * Math.min(1, step * 8);
    }
    camera.position.y = floorY + EYE_H + Math.sin(bobPhase.current) * bobAmp.current;
  });

  // Desktop: drei owns mouse-look (click-to-lock). Touch: look-pad drives it.
  return isTouch ? null : <PointerLockControls />;
}

export function ConfigStage() {
  const mode = useConfigurator((s) => s.mode);
  const buildings = useConfigurator((s) => s.buildings);
  const active = useConfigurator(activeBuilding);
  const walkMode = useConfigurator((s) => s.walkMode);

  const shown = mode === "site" ? buildings : [active];

  const view = useMemo(() => {
    let x0 = Infinity,
      x1 = -Infinity,
      z0 = Infinity,
      z1 = -Infinity;
    for (const b of shown) {
      const f = footprint(b);
      x0 = Math.min(x0, f.x0);
      x1 = Math.max(x1, f.x1);
      z0 = Math.min(z0, f.z0);
      z1 = Math.max(z1, f.z1);
    }
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    const span = Math.max(x1 - x0, z1 - z0, 6);
    return { cx, cz, span };
  }, [shown]);

  const pose = benchmarkPose(view);

  return (
    <Canvas
      shadows
      camera={{ position: pose.position, fov: 32 }}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: SRGBColorSpace,
        preserveDrawingBuffer: true, // required for PNG capture
      }}
    >
      {/* horizon haze so distant ground melts into the sky */}
      <fog attach="fog" args={[0xe4e8ec, view.span * 5, view.span * 14]} />

      <SceneEnv />
      <CaptureRig view={view} />
      <directionalLight
        position={[view.cx + 18, 26, view.cz - 14]}
        intensity={3.1}
        color={0xfff2e0}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
      />

      {shown.map((b) => (
        <BuildingModel key={b.id} b={b} interactive={mode === "single" || b.id === active.id} />
      ))}
      {mode === "site" && (
        <>
          <Walkways />
          <SiteKitModels />
        </>
      )}

      {/* grounding contact shadow — the single biggest cue that a building
          is sitting ON the site rather than floating above it */}
      <ContactShadows
        position={[view.cx, 0.01, view.cz]}
        scale={view.span * 3}
        far={6}
        blur={2.4}
        opacity={0.55}
        resolution={1024}
      />

      <GroundPlane cx={view.cx} cz={view.cz} />

      {walkMode ? (
        <WalkControls b={active} />
      ) : (
        <OrbitControls
          target={[view.cx, 1.2, view.cz]}
          maxPolarAngle={Math.PI / 2.05}
          makeDefault
        />
      )}
    </Canvas>
  );
}
