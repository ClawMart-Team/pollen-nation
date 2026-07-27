import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import type { Sim } from "../game/sim";

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const WILT = new THREE.Color("#6b5a3a");

/**
 * All flowers as two instanced meshes (stems + heads) — one draw call each
 * (spec §12). Wilt/dim is per-instance scale + color; only dirty instances are
 * rewritten each frame.
 */
export function Flowers({ sim }: { sim: Sim }) {
  const heads = useRef<THREE.InstancedMesh>(null!);
  const stems = useRef<THREE.InstancedMesh>(null!);
  const count = sim.flowers.length;

  const geos = useMemo(() => {
    const head = new THREE.IcosahedronGeometry(0.5, 0);
    const stem = new THREE.CylinderGeometry(0.05, 0.08, 1, 5);
    stem.translate(0, 0.5, 0); // base at origin so scaling stretches upward
    return { head, stem };
  }, []);
  useEffect(() => () => {
    geos.head.dispose();
    geos.stem.dispose();
  }, [geos]);

  // Static stems: written once.
  useEffect(() => {
    for (let i = 0; i < count; i++) {
      const f = sim.flowers[i];
      const sp = CONFIG.species[f.def.species] ?? CONFIG.species.daisy;
      const groundY = f.pos.y - sp.stemHeight * f.def.size;
      dummy.position.set(f.pos.x, groundY, f.pos.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(f.def.size, sp.stemHeight * f.def.size, f.def.size);
      dummy.updateMatrix();
      stems.current.setMatrixAt(i, dummy.matrix);
      stems.current.setColorAt(i, color.set("#3f7d36"));
      f.dirty = true; // force initial head write
    }
    stems.current.instanceMatrix.needsUpdate = true;
    if (stems.current.instanceColor) stems.current.instanceColor.needsUpdate = true;
  }, [sim, count]);

  useFrame(() => {
    let touched = false;
    for (let i = 0; i < count; i++) {
      const f = sim.flowers[i];
      if (!f.dirty) continue;
      f.dirty = false;
      touched = true;
      const sp = CONFIG.species[f.def.species] ?? CONFIG.species.daisy;
      const frac = Math.max(0, f.nectarLeft / f.nectarMax);
      // Visited flowers visibly wilt/dim as nectar drops.
      const s = sp.headScale * f.def.size * (0.55 + 0.45 * frac);
      dummy.position.copy(f.pos);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0.08, s));
      dummy.updateMatrix();
      heads.current.setMatrixAt(i, dummy.matrix);
      color.set(sp.color).lerp(WILT, 1 - Math.pow(frac, 0.6));
      if (f.pollinated) color.lerp(new THREE.Color("#ffffff"), 0.18 * frac); // brightened
      heads.current.setColorAt(i, color);
    }
    if (touched) {
      heads.current.instanceMatrix.needsUpdate = true;
      if (heads.current.instanceColor) heads.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={stems} args={[geos.stem, undefined, count]} frustumCulled={false}>
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[geos.head, undefined, count]} frustumCulled={false}>
        <meshLambertMaterial />
      </instancedMesh>
    </>
  );
}
