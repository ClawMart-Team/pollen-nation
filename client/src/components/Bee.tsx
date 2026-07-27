import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Sim } from "../game/sim";

/**
 * Low-poly bee + flapping wings + blob shadow (no real-time shadow maps, §12).
 */
export function Bee({ sim }: { sim: Sim }) {
  const group = useRef<THREE.Group>(null!);
  const wingL = useRef<THREE.Group>(null!);
  const wingR = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    const g = group.current;
    g.position.copy(sim.pos);
    g.rotation.order = "YXZ";
    g.rotation.y = sim.heading;
    g.rotation.z = sim.roll;
    g.rotation.x = THREE.MathUtils.clamp(-sim.vel.y * 0.045, -0.5, 0.5);

    // Wings flutter constantly; a recent flap boosts the amplitude.
    const sinceFlap = sim.t - sim.lastFlapAt;
    const amp = sim.mode === "perched" ? 0.12 : 0.55 + Math.max(0, 1 - sinceFlap * 2.5) * 0.5;
    const w = Math.sin(sim.t * 55) * amp;
    wingL.current.rotation.z = 0.35 + w;
    wingR.current.rotation.z = -0.35 - w;

    // Blob shadow follows the terrain under the bee.
    const gy = sim.heightAt(sim.pos.x, sim.pos.z);
    shadow.current.position.set(sim.pos.x, gy + 0.06, sim.pos.z);
    const alt = Math.max(0.5, sim.pos.y - gy);
    const s = THREE.MathUtils.clamp(1.4 - alt * 0.02, 0.5, 1.4);
    shadow.current.scale.setScalar(s);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(
      0.34 - alt * 0.006,
      0.06,
      0.34
    );
  });

  return (
    <>
      <group ref={group}>
        {/* body */}
        <mesh scale={[0.28, 0.26, 0.42]}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshLambertMaterial color="#f2b31f" />
        </mesh>
        {/* rear stripe */}
        <mesh position={[0, 0, -0.2]} scale={[0.17, 0.16, 0.2]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshLambertMaterial color="#4a3a1c" />
        </mesh>
        {/* head */}
        <mesh position={[0, 0.05, 0.4]} scale={[0.16, 0.16, 0.16]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshLambertMaterial color="#2a2318" />
        </mesh>
        {/* wings: pivot groups at the shoulders, planes lying flat */}
        <group ref={wingL} position={[0.1, 0.18, 0]}>
          <mesh position={[0.3, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.55, 0.26]} />
            <meshBasicMaterial
              color="#dfeeff"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group ref={wingR} position={[-0.1, 0.18, 0]}>
          <mesh position={[-0.3, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.55, 0.26]} />
            <meshBasicMaterial
              color="#dfeeff"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </>
  );
}
