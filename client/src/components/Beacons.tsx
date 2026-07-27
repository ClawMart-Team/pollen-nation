import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";

/**
 * In-world beacons (§8): a vertical shaft of light over each fresh cluster,
 * visible over terrain and through fog, intensity scaled to remaining nectar.
 */
export function Beacons({ sim }: { sim: Sim }) {
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const last = useRef(0);

  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(
      CONFIG.fx.beaconRadius * 0.6,
      CONFIG.fx.beaconRadius,
      CONFIG.fx.beaconHeight,
      8,
      1,
      true
    );
    g.translate(0, CONFIG.fx.beaconHeight / 2, 0);
    return g;
  }, []);

  useFrame(() => {
    const now = performance.now();
    if (now - last.current < 250) return;
    last.current = now;
    sim.clusters.forEach((c, i) => {
      const m = mats.current[i];
      if (!m) return;
      const frac = Math.max(0, c.nectarLeft / Math.max(1, c.nectarMax));
      // Fade out up close: beacons signal distant clusters, not nearby ones.
      const dist = c.center.distanceTo(sim.pos);
      const nearFade = THREE.MathUtils.clamp(
        (dist - CONFIG.fx.beaconFadeNear * 0.5) / (CONFIG.fx.beaconFadeNear * 0.5),
        0,
        1
      );
      m.opacity = CONFIG.fx.beaconMaxOpacity * frac * nearFade;
    });
  });

  return (
    <>
      {sim.clusters.map((c, i) => (
        <mesh
          key={i}
          geometry={geo}
          position={[c.center.x, sim.heightAt(c.center.x, c.center.z), c.center.z]}
        >
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color="#ffe98a"
            transparent
            opacity={CONFIG.fx.beaconMaxOpacity}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
            fog={false}
          />
        </mesh>
      ))}
    </>
  );
}
