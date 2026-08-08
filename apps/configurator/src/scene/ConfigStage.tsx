import { useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  MathUtils,
  MeshStandardMaterial,
  type Group,
  type Mesh,
} from "three";
import {
  assembleBuilding,
  assembleWalkway,
  createPlaceholderPart,
  getPart,
  loadManifest,
  type PlacedPart,
} from "@atom/assets";
import { footprint, walkwayGeometry } from "../site/geometry";
import { activeBuilding, useConfigurator, type BuildingState } from "../state/store";
import {
  glassMaterial,
  ROOF_PARTS,
  steelMaterial,
  WALL_PARTS,
  wallMaterial,
} from "./materials";

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
  obj.userData = { ...proto.userData, meta: p.meta, partId: p.partId };

  const isWall = WALL_PARTS.has(p.partId);
  const isSteel = ROOF_PARTS.has(p.partId);
  const isGlazed = p.partId.startsWith("window-");

  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mat = isWall
      ? wallMaterial(wallColour)
      : isSteel
        ? steelMaterial(roofColour)
        : isGlazed
          ? glassMaterial()
          : wallMaterial(wallColour);
    if (dim) mat.color.multiplyScalar(0.82);
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
  return b.gutters
    ? result.placements
    : result.placements.filter(
        (p) => p.partId !== "barge-gutter-section" && p.partId !== "downpipe",
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
 * Overcast-daylight environment built from in-scene lightformers.
 *
 * SPEC calls for an HDRI; this is the same idea generated procedurally so
 * the public bundle stays self-contained (no CDN fetch, no CSP exemption).
 * It's what gives the Colorbond steel its sheen — flat lights alone read
 * as plastic.
 */
function SoftSky() {
  return (
    <Environment resolution={256} frames={1}>
      {/* bright overcast dome */}
      <Lightformer intensity={0.85} rotation-x={Math.PI / 2} position={[0, 6, -9]} scale={[24, 24, 1]} color="#eef2f6" />
      {/* sun card */}
      <Lightformer intensity={2.6} rotation-y={Math.PI / 4} position={[9, 7, 6]} scale={[8, 8, 1]} color="#fff6e8" />
      {/* cool bounce from the opposite side */}
      <Lightformer intensity={0.5} rotation-y={-Math.PI / 3} position={[-9, 4, -6]} scale={[10, 10, 1]} color="#cfd9e4" />
      {/* warm ground bounce — stops undersides going dead black */}
      <Lightformer intensity={0.4} rotation-x={-Math.PI / 2} position={[0, -3, 0]} scale={[20, 20, 1]} color="#b9ab92" />
    </Environment>
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

  const dist = view.span * 1.5;

  return (
    <Canvas
      shadows
      camera={{ position: [view.cx + dist, dist * 0.52, view.cz - dist * 0.85], fov: 38 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
    >
      {/* soft overcast gradient, matching the sales-render backdrop */}
      <color attach="background" args={[0xdfe4e8]} />
      <fog attach="fog" args={[0xdfe4e8, view.span * 4, view.span * 12]} />

      <SoftSky />
      <directionalLight
        position={[view.cx + 18, 26, view.cz - 14]}
        intensity={1.7}
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[view.cx, 0, view.cz]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color={0x9c9280} roughness={0.98} metalness={0} />
      </mesh>

      <OrbitControls
        target={[view.cx, 1.2, view.cz]}
        maxPolarAngle={Math.PI / 2.05}
        makeDefault
      />
    </Canvas>
  );
}
