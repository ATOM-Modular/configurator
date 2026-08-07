import { useMemo } from "react";
import { MathUtils, type Group, type Mesh } from "three";
import {
  assembleBuilding,
  assembleWalkway,
  createPlaceholderPart,
  getPart,
  loadManifest,
  type PlacedPart,
} from "@atom/assets";
import { demoBuildings, demoWalkway } from "../demo-site";

const manifest = loadManifest();
const prototypes = new Map<string, Group>();

function instantiate(p: PlacedPart): Group {
  let proto = prototypes.get(p.partId);
  if (!proto) {
    proto = createPlaceholderPart(getPart(manifest, p.partId));
    prototypes.set(p.partId, proto);
  }
  const obj = proto.clone(true);
  obj.position.set(...p.position);
  obj.rotation.y = MathUtils.degToRad(p.rotationYDeg);
  if (p.scale) obj.scale.set(...p.scale);
  obj.traverse((child) => {
    if ((child as Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return obj;
}

function Placements({ placements }: { placements: PlacedPart[] }) {
  const objects = useMemo(() => placements.map(instantiate), [placements]);
  return (
    <group>
      {objects.map((o, i) => (
        <primitive key={i} object={o} />
      ))}
    </group>
  );
}

export function SiteScene() {
  const buildings = useMemo(
    () =>
      demoBuildings.map((b) => ({
        key: b.config.id,
        fflM: b.config.ffl_mm / 1000,
        site: b.site,
        result: assembleBuilding(
          {
            lengthM: b.config.lengthM,
            widthM: b.config.widthM,
            ffl_mm: b.config.ffl_mm,
            openings: b.openings,
          },
          manifest,
        ),
      })),
    [],
  );

  const walkway = useMemo(() => assembleWalkway(demoWalkway, manifest), []);

  return (
    <>
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

      {/* buildings sit at their FFL; footings reach back down to the ground */}
      {buildings.map((b) => (
        <group key={b.key} position={[b.site.xM, b.fflM, b.site.zM]}>
          <Placements placements={b.result.placements} />
        </group>
      ))}

      <Placements placements={walkway.placements} />

      {/* ground — placeholder for the textured radial-fade plane (M3) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[7.5, 0, 1.5]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color={0x77775f} roughness={1} metalness={0} />
      </mesh>
    </>
  );
}
