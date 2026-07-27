import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";
import { GameLoop } from "./GameLoop";
import { Terrain } from "./Terrain";
import { Bee } from "./Bee";
import { Flowers } from "./Flowers";
import { Grass } from "./Grass";
import { SunSky } from "./SunSky";
import { Beacons } from "./Beacons";
import { ClusterRings } from "./ClusterRings";
import { Particles } from "./Particles";

/** The hive: home marker. Stretch hook (§4): returning here could "bank"
 *  nectar before dusk — the sim knows the hive position via sim.map.hive. */
function Hive({ sim }: { sim: Sim }) {
  const { x, z } = sim.map.hive;
  const y = sim.heightAt(x, z);
  const mats = useMemo(
    () => ({
      body: curveMaterial(new THREE.MeshLambertMaterial({ color: "#c98f2e" })),
      hole: curveMaterial(new THREE.MeshBasicMaterial({ color: "#3a2a10" })),
    }),
    []
  );
  useEffect(() => () => {
    mats.body.dispose();
    mats.hole.dispose();
  }, [mats]);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 1.1, 0]} scale={[1.2, 1.5, 1.2]} material={mats.body}>
        <sphereGeometry args={[1, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.7, 1.05]} material={mats.hole}>
        <circleGeometry args={[0.32, 10]} />
      </mesh>
    </group>
  );
}

export function World({ sim }: { sim: Sim }) {
  return (
    <>
      <fog
        attach="fog"
        args={[new THREE.Color(sim.map.theme.skyTint), CONFIG.fog.near, CONFIG.fog.far]}
      />
      <SunSky sim={sim} />
      <Terrain sim={sim} />
      <Hive sim={sim} />
      <Flowers sim={sim} />
      <Grass sim={sim} />
      <Beacons sim={sim} />
      <ClusterRings sim={sim} />
      <Bee sim={sim} />
      <Particles />
      <GameLoop sim={sim} />
    </>
  );
}
