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
  createPlaceholderPart,
  getPart,
  loadManifest,
  type PlacedPart,
} from "@atom/assets";
import { COLORBOND_COLOURS } from "../state/presets";
import { useConfigurator } from "../state/store";

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

function instantiate(p: PlacedPart, wallColour: string): Group {
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
    // per-instance materials so tint + hover highlights never bleed
    const mat = (mesh.material as MeshStandardMaterial).clone();
    if (wall) mat.color = new Color(colourHex(wallColour));
    if (trim) mat.color = new Color(colourHex(wallColour)).multiplyScalar(0.55);
    mesh.material = mat;
  });
  return obj;
}

function BuildingModel() {
  const lengthM = useConfigurator((s) => s.lengthM);
  const widthM = useConfigurator((s) => s.widthM);
  const ffl_mm = useConfigurator((s) => s.ffl_mm);
  const colour = useConfigurator((s) => s.colour);
  const gutters = useConfigurator((s) => s.gutters);
  const openings = useConfigurator((s) => s.openings);
  const partitionsX = useConfigurator((s) => s.partitionsX);
  const pending = useConfigurator((s) => s.pendingOpeningPartId);
  const placePendingOpening = useConfigurator((s) => s.placePendingOpening);

  const objects = useMemo(() => {
    const result = assembleBuilding(
      {
        lengthM,
        widthM,
        ffl_mm,
        openings: openings.map((o) => ({
          elevation: o.elevation,
          partId: o.partId,
          startBay: o.startBay,
        })),
      },
      manifest,
    );
    const placements = gutters
      ? result.placements
      : result.placements.filter(
          (p) => p.partId !== "barge-gutter-section" && p.partId !== "downpipe",
        );
    return placements.map((p) => instantiate(p, colour));
  }, [lengthM, widthM, ffl_mm, colour, gutters, openings]);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
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
    if (!pending) return;
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

  const fflM = ffl_mm / 1000;
  return (
    <group position={[0, fflM, 0]}>
      {objects.map((o, i) => (
        <primitive
          key={i}
          object={o}
          onPointerDown={onPointerDown}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
        />
      ))}
      {/* interior partitions (visual only — rooms drive AC/electrical pricing) */}
      {partitionsX.map((x, i) => (
        <mesh key={`part-${i}`} position={[x, 1.35, widthM / 2]} castShadow>
          <boxGeometry args={[0.09, 2.7, widthM - 0.1]} />
          <meshStandardMaterial color={0xf2ebd8} roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export function ConfigStage() {
  const lengthM = useConfigurator((s) => s.lengthM);
  const widthM = useConfigurator((s) => s.widthM);
  const camDist = Math.max(10, lengthM * 1.7);

  return (
    <Canvas
      shadows
      camera={{ position: [camDist, camDist * 0.55, -camDist * 0.8], fov: 42 }}
      gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
    >
      <color attach="background" args={[0xcfd6dd]} />
      <hemisphereLight args={[0xdfe8f0, 0x8a8674, 1.25]} />
      <directionalLight
        position={[20, 26, -14]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
      />
      <BuildingModel />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[lengthM / 2, 0, widthM / 2]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color={0x77775f} roughness={1} metalness={0} />
      </mesh>
      <OrbitControls
        target={[lengthM / 2, 1.4, widthM / 2]}
        maxPolarAngle={Math.PI / 2.05}
        makeDefault
      />
    </Canvas>
  );
}
