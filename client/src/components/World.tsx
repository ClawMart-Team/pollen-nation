import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { GameLoop } from "./GameLoop";
import { Terrain } from "./Terrain";
import { Bee } from "./Bee";
import { Flowers } from "./Flowers";
import { Obstacles } from "./Obstacles";
import { SunSky } from "./SunSky";
import { Beacons } from "./Beacons";
import { Particles } from "./Particles";

/** The hive: home marker. Stretch hook (§4): returning here could "bank"
 *  nectar before dusk — the sim knows the hive position via sim.map.hive. */
function Hive({ sim }: { sim: Sim }) {
  const { x, z } = sim.map.hive;
  const y = sim.heightAt(x, z);
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 1.1, 0]} scale={[1.2, 1.5, 1.2]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshLambertMaterial color="#c98f2e" />
      </mesh>
      <mesh position={[0, 0.7, 1.05]}>
        <circleGeometry args={[0.32, 10]} />
        <meshBasicMaterial color="#3a2a10" />
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
      <Obstacles sim={sim} />
      <Beacons sim={sim} />
      <Bee sim={sim} />
      <Particles />
      <GameLoop sim={sim} />
    </>
  );
}
