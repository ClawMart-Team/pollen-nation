import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";
import { fbm } from "../lib/noise";

const SIZE = CONFIG.world.chunkSize;
const SEG = CONFIG.world.chunkSegments;
const RADIUS = CONFIG.world.chunkRadius;

/**
 * Chunk-streamed heightmap terrain. Chunks are generated ahead of the bee and
 * recycled behind it — purely a rendering strategy; the map defines the whole
 * finite layout. Vertex-colored (no textures), fog-limited draw distance.
 */
export function Terrain({ sim }: { sim: Sim }) {
  const group = useRef<THREE.Group>(null!);
  const chunks = useRef(new Map<string, THREE.Mesh>());
  const lastCheck = useRef(-1);

  const material = useMemo(
    () => new THREE.MeshLambertMaterial({ vertexColors: true }),
    []
  );

  const palette = useMemo(() => {
    const base = new THREE.Color(sim.map.theme.palette);
    const low = base.clone().multiplyScalar(0.55).lerp(new THREE.Color("#3c5a33"), 0.3);
    const high = base.clone().lerp(new THREE.Color("#e8e0b0"), 0.45);
    return { base, low, high };
  }, [sim.map]);

  const buildChunk = (cx: number, cz: number): THREE.Mesh => {
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(posAttr.count * 3);
    const ox = cx * SIZE + SIZE / 2;
    const oz = cz * SIZE + SIZE / 2;
    const c = new THREE.Color();
    const r = sim.map.terrain.ruggedness * 1.6;
    for (let i = 0; i < posAttr.count; i++) {
      const wx = posAttr.getX(i) + ox;
      const wz = posAttr.getZ(i) + oz;
      const h = sim.heightAt(wx, wz);
      posAttr.setY(i, h);
      // Height-banded color with a little noise variation (fake AO in valleys).
      const t = THREE.MathUtils.clamp(h / r + 0.5, 0, 1);
      const n = fbm(wx * 0.15, wz * 0.15, sim.map.seed + 999, 2);
      c.copy(palette.low).lerp(palette.high, t).offsetHSL(0, 0, (n - 0.5) * 0.08);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(ox, 0, oz);
    return mesh;
  };

  useFrame(() => {
    // Re-evaluate the chunk set a few times per second, not every frame.
    const now = performance.now();
    if (now - lastCheck.current < 300) return;
    lastCheck.current = now;

    const { sizeX, sizeZ } = sim.map.terrain;
    const minCX = Math.floor(-sizeX / 2 / SIZE) - 1;
    const maxCX = Math.floor(sizeX / 2 / SIZE);
    const minCZ = -1;
    const maxCZ = Math.floor(sizeZ / SIZE);

    const bcx = Math.floor(sim.pos.x / SIZE);
    const bcz = Math.floor(sim.pos.z / SIZE);
    const wanted = new Set<string>();
    for (let dx = -RADIUS; dx <= RADIUS; dx++)
      for (let dz = -RADIUS; dz <= RADIUS; dz++) {
        if (dx * dx + dz * dz > RADIUS * RADIUS + 2) continue;
        const cx = bcx + dx;
        const cz = bcz + dz;
        if (cx < minCX || cx > maxCX || cz < minCZ || cz > maxCZ) continue;
        wanted.add(cx + "," + cz);
      }

    // Recycle chunks behind / out of range.
    for (const [key, mesh] of chunks.current) {
      if (!wanted.has(key)) {
        group.current.remove(mesh);
        mesh.geometry.dispose();
        chunks.current.delete(key);
      }
    }
    // Create missing chunks.
    for (const key of wanted) {
      if (chunks.current.has(key)) continue;
      const [cx, cz] = key.split(",").map(Number);
      const mesh = buildChunk(cx, cz);
      chunks.current.set(key, mesh);
      group.current.add(mesh);
    }
  });

  useEffect(() => {
    const map = chunks.current;
    return () => {
      for (const mesh of map.values()) mesh.geometry.dispose();
      map.clear();
      material.dispose();
    };
  }, [material]);

  return <group ref={group} />;
}
