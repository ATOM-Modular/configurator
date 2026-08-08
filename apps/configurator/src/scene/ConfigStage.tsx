import { useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  Color,
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
import { COLORBOND_COLOURS } from "../state/presets";
import { activeBuilding, useConfigurator, type BuildingState } from "../state/store";

const manifest = loadManifest();
const prototypes = new Map<string, Group>();

const WALL_PARTS = new Set(["panel-wall-1200", "panel-wall-cut"]);
const TRIM_PARTS = new Set([
  "flashing-corner",
  "flashing-basechannel",
  "flashing-tee-join",
  "barge-gutter-section",
  "downpipe",
]);

function colourHex(name: string): string {
  return COLORBOND_COLOURS.find((c) => c.name === name)?.hex ?? "#E4E2D5";
}

function instantiate(p: PlacedPart, wallColour: string, dim: boolean): Group {
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

  const wall = WALL_PARTS.has(p.partId);
  const trim = TRIM_PARTS.has(p.partId);
  obj.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const mat = (mesh.material as MeshStandardMaterial).clone();
    if (wall) mat.color = new Color(colourHex(wallColour));
    if (trim) mat.color = new Color(colourHex(wallColour)).multiplyScalar(0.55);
    if (dim) mat.color.multiplyScalar(0.75);
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
    () => buildingPlacements(b).map((p) => instantiate(p, b.colour, dim)),
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
      if (m.isMesh) (m.material as MeshStandardMaterial).emissive.set(0xdbcdac);
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

  const f = footprint(b);
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
          <meshStandardMaterial color={0xf2ebd8} roughness={0.9} />
        </mesh>
      ))}
      {/* keeps `f` meaningful for future selection outlines */}
      <group visible={false} position={[f.x1 - f.x0, 0, f.z1 - f.z0]} />
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
      // elevated runs sit at the higher of the two floor levels
      const y = w.elevated ? Math.max(from.ffl_mm, to.ffl_mm) / 1000 : 0;
      const run = assembleWalkway(
        {
          gapM: link.gapM,
          origin: [link.origin[0], y, link.origin[2]],
          rotationYDeg: link.axis === "x" ? 0 : 90,
        },
        manifest,
      );
      out.push(...run.placements.map((p) => instantiate(p, "Shale Grey", false)));
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

export function ConfigStage() {
  const mode = useConfigurator((s) => s.mode);
  const buildings = useConfigurator((s) => s.buildings);
  const active = useConfigurator(activeBuilding);

  const shown = mode === "site" ? buildings : [active];

  // frame the camera on everything visible
  const view = useMemo(() => {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const b of shown) {
      const f = footprint(b);
      x0 = Math.min(x0, f.x0); x1 = Math.max(x1, f.x1);
      z0 = Math.min(z0, f.z0); z1 = Math.max(z1, f.z1);
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
      camera={{ position: [view.cx + dist, dist * 0.6, view.cz - dist * 0.8], fov: 42 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
    >
      <color attach="background" args={[0xcfd6dd]} />
      <hemisphereLight args={[0xdfe8f0, 0x8a8674, 1.25]} />
      <directionalLight
        position={[view.cx + 20, 30, view.cz - 16]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
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

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[view.cx, 0, view.cz]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={0x77775f} roughness={1} metalness={0} />
      </mesh>
      <OrbitControls target={[view.cx, 1.4, view.cz]} maxPolarAngle={Math.PI / 2.05} makeDefault />
    </Canvas>
  );
}
