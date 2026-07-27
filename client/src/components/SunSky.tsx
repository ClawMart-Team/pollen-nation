import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";

const DUSK_SKY = new THREE.Color("#f2924d");
const DUSK_SUN = new THREE.Color("#ff8a3d");
const DAY_SUN = new THREE.Color("#fff3dd");
const tmpSky = new THREE.Color();
const tmpSun = new THREE.Color();

/**
 * The day timer visualized: the sun arcs across the sky and doubles as the
 * ambient lighting, shifting warm toward dusk. Fog + background track it.
 */
export function SunSky({ sim }: { sim: Sim }) {
  const dirLight = useRef<THREE.DirectionalLight>(null!);
  const sunMesh = useRef<THREE.Mesh>(null!);
  const { scene } = useThree();

  const skyBase = useMemo(() => new THREE.Color(sim.map.theme.skyTint), [sim.map]);

  useFrame(() => {
    const progress = 1 - sim.timeLeft / sim.dayLength;
    const start = sim.map.theme.timeOfDayStart;
    const dayFrac = start + (1 - start) * progress; // 1 = sunset

    // East → west arc.
    const ang = Math.PI * (1 - dayFrac);
    const dir = new THREE.Vector3(Math.cos(ang), Math.max(0.06, Math.sin(ang)) * 0.9 + 0.08, 0.3).normalize();

    const duskT = THREE.MathUtils.clamp(
      (dayFrac - CONFIG.day.duskStart) / (1 - CONFIG.day.duskStart),
      0,
      1
    );
    tmpSun.copy(DAY_SUN).lerp(DUSK_SUN, duskT);
    tmpSky.copy(skyBase).lerp(DUSK_SKY, duskT * 0.85);

    dirLight.current.position.copy(sim.pos).addScaledVector(dir, 60);
    dirLight.current.target.position.copy(sim.pos);
    dirLight.current.target.updateMatrixWorld();
    dirLight.current.color.copy(tmpSun);
    dirLight.current.intensity = 1.15 - duskT * 0.35;

    sunMesh.current.position.copy(sim.pos).addScaledVector(dir, CONFIG.fog.far * 0.85);
    (sunMesh.current.material as THREE.MeshBasicMaterial).color.copy(tmpSun);

    if (scene.fog instanceof THREE.Fog) scene.fog.color.copy(tmpSky);
    if (scene.background instanceof THREE.Color) scene.background.copy(tmpSky);
    else scene.background = tmpSky.clone();
  });

  return (
    <>
      <hemisphereLight args={["#cfe8ff", "#5a6b3f", 0.75]} />
      <directionalLight ref={dirLight} intensity={1.1} />
      <mesh ref={sunMesh}>
        <sphereGeometry args={[7, 12, 10]} />
        <meshBasicMaterial color="#fff3dd" fog={false} toneMapped={false} />
      </mesh>
    </>
  );
}
