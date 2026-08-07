import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { ACESFilmicToneMapping } from "three";
import { PricePanel } from "./PricePanel";
import { SiteScene } from "./scene/SiteScene";

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">ATOM MODULAR</span>
        <span className="crumb">Configurator preview — M2 kit-of-parts (placeholder geometry)</span>
      </header>
      <main className="stage">
        <Canvas
          shadows
          camera={{ position: [17, 8.5, -12], fov: 42 }}
          gl={{ antialias: true, toneMapping: ACESFilmicToneMapping }}
        >
          <color attach="background" args={[0xcfd6dd]} />
          <SiteScene />
          <OrbitControls target={[7.5, 1.4, 1.5]} maxPolarAngle={Math.PI / 2.05} />
        </Canvas>
        <PricePanel />
      </main>
    </div>
  );
}
