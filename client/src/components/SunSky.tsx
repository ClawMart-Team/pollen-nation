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
    // Time remaining maps to a sunrise → sunset arc along the TRAVEL axis (Z):
    // the sun rises over the +Z horizon the bee heads toward on the way out,
    // passes overhead at the mid-day turn, and sets over the −Z horizon the bee
    // heads toward on the way home. Its position IS the timer.
    const progress = THREE.MathUtils.clamp(1 - sim.timeLeft / sim.dayLength, 0, 1);
    const phi = Math.PI * progress; // 0 = dawn (+Z), π/2 = noon (overhead), π = dusk (−Z)
    const horiz = Math.cos(phi); // +1 (+Z) → −1 (−Z)
    const height = Math.sin(phi); // 0 at either horizon → 1 at the zenith

    // Visible sun disc: rides the +Z→−Z arc but is kept LOW and flattened so it
    // lingers near the horizon the camera faces — clearly rising over the +Z
    // horizon early, and setting over the −Z horizon late — instead of shooting
    // up out of the thin visible sky band. Around noon it drifts overhead and
    // off the top of frame (while the bee is turning), which is expected.
    const discDir = new THREE.Vector3(0, height * 0.55 - 0.38, horiz).normalize();

    // Warm the light and sky whenever the sun rides low — at both dawn and dusk.
    const warm = THREE.MathUtils.clamp(1 - height / 0.5, 0, 1);
    tmpSun.copy(DAY_SUN).lerp(DUSK_SUN, warm);
    tmpSky.copy(skyBase).lerp(DUSK_SKY, warm * 0.85);

    // Lighting: keep the sun above the scene for sane shading; its azimuth still
    // tracks the travel axis so shadows sweep along Z as the day passes.
    const lightDir = new THREE.Vector3(0, Math.max(height, 0.25), horiz * 0.7).normalize();
    dirLight.current.position.copy(sim.pos).addScaledVector(lightDir, 60);
    dirLight.current.target.position.copy(sim.pos);
    dirLight.current.target.updateMatrixWorld();
    dirLight.current.color.copy(tmpSun);
    dirLight.current.intensity = 1.15 - warm * 0.35;

    sunMesh.current.position.copy(sim.pos).addScaledVector(discDir, CONFIG.fog.far * 0.85);
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
        <sphereGeometry args={[10, 16, 12]} />
        <meshBasicMaterial color="#fff3dd" fog={false} toneMapped={false} />
      </mesh>
    </>
  );
}
