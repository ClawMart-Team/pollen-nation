import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";
import { GameLoop } from "./GameLoop";
import { Terrain } from "./Terrain";
import { Bee } from "./Bee";
import { Flowers } from "./Flowers";
import { Grass } from "./Grass";
import { SunSky } from "./SunSky";
import { Particles } from "./Particles";

/** Target height (world units) of the hive model. */
const HIVE_SIZE = 3.2;

/**
 * Responsive camera FOV. The chase cam is locked to the centre lane, so all
 * three lanes must fit horizontally. CONFIG.camera.fov is a *vertical* FOV,
 * which on a narrow (portrait) phone shrinks the horizontal field until the
 * outer lanes — and the bee on them — get clipped. This widens the vertical FOV
 * as needed so the horizontal field never drops below what a 16:9 screen shows;
 * on landscape/desktop it leaves the configured FOV untouched.
 */
function ResponsiveCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useEffect(() => {
    const REF_ASPECT = 16 / 9;
    const baseV = THREE.MathUtils.degToRad(CONFIG.camera.fov);
    // Horizontal FOV a 16:9 screen gets at the configured vertical FOV.
    const minH = 2 * Math.atan(Math.tan(baseV / 2) * REF_ASPECT);
    const aspect = width / Math.max(1, height);
    // Vertical FOV needed to keep that horizontal field at this aspect.
    const neededV = 2 * Math.atan(Math.tan(minH / 2) / aspect);
    camera.fov = THREE.MathUtils.radToDeg(Math.max(baseV, neededV));
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

/** The hive: home marker, rendered from bee_hive.glb. The sim knows its
 *  position via sim.map.hive (returning here before dusk is a win). */
function Hive({ sim }: { sim: Sim }) {
  const { x, z } = sim.map.hive;
  const y = sim.heightAt(x, z);
  const gltf = useGLTF("/models/bee_hive.glb");

  const model = useMemo(() => {
    const root = skeletonClone(gltf.scene) as THREE.Object3D;

    // Normalize: scale so the tallest axis is HIVE_SIZE, center on x/z, and
    // rest the base on the ground (y = 0 at the model's bottom).
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = HIVE_SIZE / Math.max(size.x, size.y, size.z || 1);
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -box.min.y * s, -center.z * s);

    // Curve each material so the hive bends with the planet. Clone first so we
    // don't mutate the cached GLTF materials shared by useGLTF. The GLB ships
    // with no color data, so shade the whole hive a warm, matte cartoon-beehive
    // yellow and drop metalness so it lights correctly without an env map.
    const owned: THREE.Material[] = [];
    const curve = (m: THREE.Material) => {
      const src = m.clone();
      const std = src as THREE.MeshStandardMaterial;
      if (std.isMeshStandardMaterial) {
        std.metalness = 0;
        std.roughness = 0.85;
        std.color.set("#e8a72c");
      }
      const c = curveMaterial(src);
      owned.push(c);
      return c;
    };
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(curve)
        : curve(mesh.material as THREE.Material);
    });
    return { root, owned };
  }, [gltf]);

  useEffect(
    () => () => {
      for (const m of model.owned) m.dispose();
    },
    [model]
  );

  return (
    <group position={[x, y, z]}>
      <primitive object={model.root} />
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
      <Bee sim={sim} />
      <Particles />
      <ResponsiveCamera />
      <GameLoop sim={sim} />
    </>
  );
}

useGLTF.preload("/models/bee_hive.glb");
