import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Sim } from "../game/sim";

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/**
 * Static obstacles: branches (capsule colliders in the sim, cylinders here)
 * and leaf clusters (blobby icosahedra). One instanced mesh per type.
 */
export function Obstacles({ sim }: { sim: Sim }) {
  const branchRef = useRef<THREE.InstancedMesh>(null!);
  const leafRef = useRef<THREE.InstancedMesh>(null!);

  const { branches, leaves } = useMemo(() => {
    const branches = sim.obstacles.filter((o) => o.def.type === "branch");
    const leaves = sim.obstacles.filter((o) => o.def.type === "leafCluster");
    return { branches, leaves };
  }, [sim]);

  const geos = useMemo(() => {
    // X-aligned cylinder matching the sim's capsule axis.
    const branch = new THREE.CylinderGeometry(0.35, 0.3, 8, 6);
    branch.rotateZ(Math.PI / 2);
    const leaf = new THREE.IcosahedronGeometry(1.3, 0);
    return { branch, leaf };
  }, []);
  useEffect(() => () => {
    geos.branch.dispose();
    geos.leaf.dispose();
  }, [geos]);

  useEffect(() => {
    branches.forEach((o, i) => {
      dummy.position.copy(o.pos);
      dummy.rotation.set(0, o.def.rotY, 0);
      dummy.scale.setScalar(o.def.scale);
      dummy.updateMatrix();
      branchRef.current.setMatrixAt(i, dummy.matrix);
      branchRef.current.setColorAt(i, color.setHSL(0.07, 0.4, 0.34 + (i % 5) * 0.02));
    });
    branchRef.current.count = branches.length;
    branchRef.current.instanceMatrix.needsUpdate = true;
    if (branchRef.current.instanceColor) branchRef.current.instanceColor.needsUpdate = true;

    leaves.forEach((o, i) => {
      dummy.position.copy(o.pos);
      dummy.rotation.set((i % 7) * 0.4, o.def.rotY, (i % 5) * 0.3);
      dummy.scale.setScalar(o.def.scale);
      dummy.updateMatrix();
      leafRef.current.setMatrixAt(i, dummy.matrix);
      leafRef.current.setColorAt(i, color.setHSL(0.3, 0.45, 0.3 + (i % 6) * 0.025));
    });
    leafRef.current.count = leaves.length;
    leafRef.current.instanceMatrix.needsUpdate = true;
    if (leafRef.current.instanceColor) leafRef.current.instanceColor.needsUpdate = true;
  }, [branches, leaves]);

  return (
    <>
      <instancedMesh ref={branchRef} args={[geos.branch, undefined, Math.max(1, branches.length)]}>
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={leafRef} args={[geos.leaf, undefined, Math.max(1, leaves.length)]}>
        <meshLambertMaterial />
      </instancedMesh>
    </>
  );
}
