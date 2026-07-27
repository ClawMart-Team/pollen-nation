import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";

const SIZE = CONFIG.world.chunkSize;
const RADIUS = CONFIG.world.chunkRadius;
const PER_CHUNK = CONFIG.world.grassPerChunk;
const CAP = (RADIUS * 2 + 1) ** 2 * PER_CHUNK;

const dummy = new THREE.Object3D();
/** Deterministic per-(chunk, index) hash so tufts sit still between visits. */
const hash = (x: number, z: number, s: number) =>
  ((((Math.sin(x * 127.1 + z * 311.7 + s * 74.7) * 43758.5453) % 1) + 1) % 1);

/**
 * Grass tufts tiled across the terrain: one instanced draw of the grass.glb
 * mesh, scattered deterministically per chunk and streamed with the bee,
 * exactly like Terrain chunks. Curved so grass sinks below the horizon.
 */
export function Grass({ sim }: { sim: Sim }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  const lastChunk = useRef("");
  const gltf = useGLTF("/models/grass.glb");

  const { geo, mat } = useMemo(() => {
    let src: THREE.Mesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!src && (o as THREE.Mesh).isMesh) src = o as THREE.Mesh;
    });
    const mesh = src as unknown as THREE.Mesh;
    // Bake the GLB node transform into the geometry so instances scale sanely.
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    // The GLB material is unlit (KHR_materials_unlit) — it ignores scene
    // lighting and reads as black silhouettes against fog. Swap in a lit,
    // fog-respecting Lambert keeping the GLB's tint.
    const srcMat = mesh.material as THREE.MeshBasicMaterial;
    const mat = curveMaterial(new THREE.MeshLambertMaterial({ color: srcMat.color }));
    return { geo, mat };
  }, [gltf]);
  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);

  useFrame(() => {
    const ccx = Math.floor(sim.pos.x / SIZE);
    const ccz = Math.floor(sim.pos.z / SIZE);
    const key = ccx + "," + ccz;
    if (key === lastChunk.current) return; // rebuild only on chunk crossings
    lastChunk.current = key;

    const halfX = sim.map.terrain.sizeX / 2;
    const maxZ = sim.map.terrain.sizeZ;
    let n = 0;
    for (let cx = ccx - RADIUS; cx <= ccx + RADIUS; cx++)
      for (let cz = ccz - RADIUS; cz <= ccz + RADIUS; cz++) {
        // Match Terrain's circular chunk set so grass never floats where
        // no ground chunk is drawn.
        const dx = cx - ccx;
        const dz = cz - ccz;
        if (dx * dx + dz * dz > RADIUS * RADIUS + 2) continue;
        for (let i = 0; i < PER_CHUNK; i++) {
          const x = (cx + hash(cx, cz, i)) * SIZE;
          const z = (cz + hash(cx, cz, i + 999)) * SIZE;
          if (Math.abs(x) > halfX || z < 0 || z > maxZ) continue;
          dummy.position.set(x, sim.heightAt(x, z), z);
          dummy.rotation.y = hash(cx, cz, i + 10000) * Math.PI * 2;
          dummy.scale.setScalar(0.7 + hash(cx, cz, i + 20000) * 0.6);
          dummy.updateMatrix();
          ref.current.setMatrixAt(n++, dummy.matrix);
        }
      }
    ref.current.count = n;
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mat, CAP]} frustumCulled={false} />;
}

useGLTF.preload("/models/grass.glb");
