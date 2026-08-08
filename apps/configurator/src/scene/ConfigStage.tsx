import { useEffect, useMemo } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  MathUtils,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2,
  type Group,
  type Mesh,
} from "three";
import {
  assembleBuilding,
  assembleWalkway,
  createPlaceholderPart,
  getPart,
  loadManifest,
  ROOF_PITCH_DEG,
  WALL_HEIGHT_EAVE_M,
  type PlacedPart,
} from "@atom/assets";
import { footprint, walkwayGeometry } from "../site/geometry";
import { activeBuilding, useConfigurator, type BuildingState } from "../state/store";
import {
  footingMaterial,
  frameMaterial,
  glassMaterial,
  ROOF_PARTS,
  steelMaterial,
  WALL_PARTS,
  wallMaterial,
} from "./materials";
import { groundColorMap, proceduralSky, roofNormalMap } from "./textures";

/** Placeholder roof boxes rendered as a clean solid instead (below). */
const ROOF_SOLID_PARTS = new Set(["roof-sheet-skillion", "capping-ridge", "capping-fascia"]);

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

    // Per-mesh so a window's glazing is glass but its frame stays opaque.
    let mat: MeshStandardMaterial | ReturnType<typeof glassMaterial>;
    if (mesh.userData.glass) mat = glassMaterial();
    else if (p.partId === "footing-surefoot") mat = footingMaterial();
    else if (isWall) mat = wallMaterial(wallColour);
    else if (isSteel) mat = steelMaterial(roofColour, corrugated);
    else if (isOpening) mat = frameMaterial("Surfmist");
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
    // roof sheets/cappings AND gutter/downpipe are drawn cleanly by
    // <RoofSolid>; their placeholder boxes are excluded from the scene.
    if (ROOF_SOLID_PARTS.has(p.partId)) return false;
    if (p.partId === "barge-gutter-section" || p.partId === "downpipe") return false;
    return true;
  });
}

/**
 * Clean duo-pitch roof drawn as a solid, replacing the stepped placeholder
 * sheets. Ridge runs ALONG the length at mid-width, falling 2° to both long
 * eaves — matching the ATOM roof plans — with a small consistent overhang,
 * ridge cap, fascia and barge trim in the roof colour.
 */
function RoofSolid({ b }: { b: BuildingState }) {
  const L = b.lengthM;
  const W = b.widthM;
  const wallH = WALL_HEIGHT_EAVE_M;
  const rise = (W / 2) * Math.tan(MathUtils.degToRad(ROOF_PITCH_DEG));
  const ridgeY = wallH + rise;
  const ohX = 0.15; // end (barge) overhang
  const ohZ = 0.2; // eave overhang

  const fflM = b.ffl_mm / 1000;

  const geom = useMemo(() => {
    const P = [
      [-ohX, wallH, -ohZ], // A south eave, x-min
      [L + ohX, wallH, -ohZ], // B south eave, x-max
      [-ohX, ridgeY, W / 2], // C ridge x-min
      [L + ohX, ridgeY, W / 2], // D ridge x-max
      [-ohX, wallH, W + ohZ], // E north eave x-min
      [L + ohX, wallH, W + ohZ], // F north eave x-max
    ];
    const pos = new Float32Array(P.flat());
    // u across the width, v along the length → corrugation ribs run LONG ways
    // (parallel to the ridge), the way long-run Colorbond is laid on a
    // near-flat 2° cross-fall roof.
    const uv = new Float32Array([0, 0, 0, 1, 0.5, 0, 0.5, 1, 1, 0, 1, 1]);
    const idx = [0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4];
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("uv", new BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }, [L, W, wallH, ridgeY]);

  const mat = useMemo(() => {
    const normal = roofNormalMap().clone();
    normal.needsUpdate = true;
    // ribs repeat across the width → each rib runs the length of the roof
    normal.repeat.set(Math.max(6, Math.round(W * 4)), 1);
    const m = steelMaterial(b.roofColour, false);
    m.normalMap = normal;
    m.normalScale = new Vector2(0.6, 0.6);
    m.side = DoubleSide;
    return m;
  }, [b.roofColour, W]);

  const trim = useMemo(() => steelMaterial(b.roofColour, false), [b.roofColour]);
  const ridgeLen = L + 2 * ohX;

  return (
    <group>
      <mesh geometry={geom} material={mat} castShadow receiveShadow />

      {/* ridge cap along the length */}
      <mesh position={[L / 2, ridgeY + 0.02, W / 2]} material={trim} castShadow>
        <boxGeometry args={[ridgeLen, 0.04, 0.14]} />
      </mesh>

      {/* barge/rake capping across the two 3m ends (over the ridge) */}
      <mesh position={[-ohX, wallH + rise / 2, W / 2]} material={trim} castShadow>
        <boxGeometry args={[0.05, 0.14, W + 2 * ohZ]} />
      </mesh>
      <mesh position={[L + ohX, wallH + rise / 2, W / 2]} material={trim} castShadow>
        <boxGeometry args={[0.05, 0.14, W + 2 * ohZ]} />
      </mesh>

      {b.gutters && (
        <>
          {/* box gutter along each long low eave */}
          <mesh position={[L / 2, wallH - 0.05, -ohZ - 0.02]} material={trim} castShadow>
            <boxGeometry args={[ridgeLen, 0.11, 0.11]} />
          </mesh>
          <mesh position={[L / 2, wallH - 0.05, W + ohZ + 0.02]} material={trim} castShadow>
            <boxGeometry args={[ridgeLen, 0.11, 0.11]} />
          </mesh>
          {/* one downpipe at a rear corner, gutter → ground */}
          <mesh
            position={[L - 0.12, (wallH - fflM) / 2 - 0.05, W + ohZ + 0.04]}
            material={trim}
            castShadow
          >
            <boxGeometry args={[0.08, wallH + fflM, 0.06]} />
          </mesh>
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

export function ConfigStage() {
  const mode = useConfigurator((s) => s.mode);
  const buildings = useConfigurator((s) => s.buildings);
  const active = useConfigurator(activeBuilding);

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
        intensity={2.4}
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

      <OrbitControls
        target={[view.cx, 1.2, view.cz]}
        maxPolarAngle={Math.PI / 2.05}
        makeDefault
      />
    </Canvas>
  );
}
