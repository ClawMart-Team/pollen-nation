import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";

/**
 * In-world locators for clusters hidden below the curved horizon: an annular
 * arc "ribbon" hovers over each cluster and shrinks as the bee approaches
 * (smaller = closer). The disc lies flat so its normal is parallel to the
 * world surface normal (up), and it is curved with the planet so distant
 * ribbons ride the horizon like the beacon shafts. Replaces the old 2D
 * compass petals.
 */
export function ClusterRings({ sim }: { sim: Sim }) {
  const { camera } = useThree();
  const R = CONFIG.fx.ring;
  const planetRadius = CONFIG.world.planetRadius;

  // Complete circular annulus (full ring, no gap).
  const geo = useMemo(
    () => new THREE.RingGeometry(R.innerRadius, R.outerRadius, 64),
    [R.innerRadius, R.outerRadius]
  );

  const mats = useMemo(
    () =>
      sim.clusters.map(() =>
        curveMaterial(
          new THREE.MeshBasicMaterial({
            color: "#ffcf3a",
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
          })
        )
      ),
    [sim]
  );

  const meshes = useRef<THREE.Mesh[]>([]);

  useEffect(
    () => () => {
      geo.dispose();
      mats.forEach((m) => m.dispose());
    },
    [geo, mats]
  );

  useFrame(() => {
    for (let i = 0; i < sim.clusters.length; i++) {
      const c = sim.clusters[i];
      const mesh = meshes.current[i];
      const m = mats[i];
      if (!mesh || !m) continue;
      const dist = c.center.distanceTo(sim.pos);
      const frac = Math.max(0, c.nectarLeft / Math.max(1, c.nectarMax));
      // Shrink as the bee approaches: nearDist -> minScale, farDist -> maxScale.
      const t = THREE.MathUtils.clamp(
        (dist - R.nearDist) / (R.farDist - R.nearDist),
        0,
        1
      );
      mesh.scale.setScalar(THREE.MathUtils.lerp(R.minScale, R.maxScale, t));
      // The curvature shader sinks geometry by (d^2)/(2R) with distance from
      // the camera; add that back (capped) to the height so the ribbon rides
      // just above its cluster near the horizon instead of sinking underground.
      const cdx = c.center.x - camera.position.x;
      const cdz = c.center.z - camera.position.z;
      const drop = Math.min((cdx * cdx + cdz * cdz) / (2 * planetRadius), R.maxLift);
      mesh.position.y = sim.heightAt(c.center.x, c.center.z) + R.height + drop;
      m.opacity = R.maxOpacity * frac;
    }
  });

  return (
    <>
      {sim.clusters.map((c, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) meshes.current[i] = el;
          }}
          geometry={geo}
          material={mats[i]}
          frustumCulled={false}
          // Lay the disc flat: RingGeometry sits in the XY plane (normal +Z),
          // rotate -90deg about X so its normal points up (+Y), parallel to
          // the world surface normal.
          rotation={[-Math.PI / 2, 0, 0]}
          position={[
            c.center.x,
            sim.heightAt(c.center.x, c.center.z) + R.height,
            c.center.z,
          ]}
        />
      ))}
    </>
  );
}
