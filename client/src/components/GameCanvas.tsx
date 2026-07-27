import { Canvas } from "@react-three/fiber";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { World } from "./World";

export function GameCanvas({ sim }: { sim: Sim }) {
  return (
    <Canvas
      // Clamp devicePixelRatio (§12) and skip antialias on high-dpi phones.
      dpr={[1, CONFIG.perf.maxDPR]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: CONFIG.camera.fov, near: 0.1, far: CONFIG.fog.far + 60 }}
      shadows={false}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
    >
      <World sim={sim} />
    </Canvas>
  );
}
