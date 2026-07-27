import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { World } from "./World";

let runCounter = 0;

export function GameCanvas({ sim }: { sim: Sim }) {
  // The canvas stays mounted across levels (so the world remains visible
  // behind menu screens), but chunk-streaming components (Terrain, Grass)
  // cache geometry per chunk coordinate. Remount the whole World per sim so
  // no stale per-level state survives into the next day.
  const runKey = useMemo(() => ++runCounter, [sim]);
  return (
    <Canvas
      // Clamp devicePixelRatio (§12) and skip antialias on high-dpi phones.
      dpr={[1, CONFIG.perf.maxDPR]}
      gl={{ antialias: false, powerPreference: "high-performance" }}
      camera={{ fov: CONFIG.camera.fov, near: 0.1, far: CONFIG.fog.far + 60 }}
      shadows={false}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
    >
      <World key={runKey} sim={sim} />
    </Canvas>
  );
}
