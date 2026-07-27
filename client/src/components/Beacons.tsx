import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";

/**
 * In-world beacons (§8): a vertical shaft of light over each fresh cluster,
 * intensity scaled to remaining nectar. The shafts follow the planet's
 * curvature, so a tall shaft peeking over the horizon is the far-signal.
 */
export function Beacons({ sim }: { sim: Sim }) {
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

  const mats = useMemo(
    () =>
      sim.clusters.map(() =>
        curveMaterial(
          new THREE.MeshBasicMaterial({
            color: "#ffe98a",
            transparent: true,
            opacity: CONFIG.fx.beaconMaxOpacity,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
          })
        )
      ),
    [sim]
  );
  useEffect(() => () => {
    geo.dispose();
    mats.forEach((m) => m.dispose());
  }, [geo, mats]);

  useFrame(() => {
    const now = performance.now();
    if (now - last.current < 250) return;
    last.current = now;
    sim.clusters.forEach((c, i) => {
      const m = mats[i];
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
          material={mats[i]}
          frustumCulled={false}
          position={[c.center.x, sim.heightAt(c.center.x, c.center.z), c.center.z]}
        />
      ))}
    </>
  );
}
