import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import type { Sim } from "../game/sim";
import { curveMaterial } from "../lib/curvature";

/** Target length (longest axis) of the bee in world units. */
const TARGET_SIZE = 1.0;
/** Extra yaw to face the model's nose toward +Z (flight forward). Adjust if
 *  the imported model points the wrong way. */
const MODEL_YAW = 0;

// --- Wing flap (bee.glb has no animation clips, so we drive it procedurally).
// The GLB splits geometry by material; the light-blue wings are their own
// material group, so we can rotate that sub-mesh. Both wings share one mesh and
// pivot at the body origin, so they flap together.
/** Material name of the wing group inside bee.glb. */
const WING_MAT_NAME = "Material.004";
/** Local axis the wings rotate about to flap. Tune if the flap looks wrong. */
const WING_FLAP_AXIS = new THREE.Vector3(0, 0, 1);
/** Flap speed (radians/sec multiplier on sim.t). */
const WING_FLAP_FREQ = 55;
/** Peak flap angle (radians). */
const WING_FLAP_AMP = 0.5;

/**
 * The player's bee, rendered from bee.glb. The simulation stays flat; the
 * model is curved with the planet like everything else, and rides a blob
 * shadow (no real-time shadow maps, §12). If the GLB ships an animation clip
 * (e.g. a wing flap) it is played on a loop.
 */
export function Bee({ sim }: { sim: Sim }) {
  const group = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const gltf = useGLTF("/models/bee.glb");

  // Clone the loaded scene (SkeletonUtils supports skinned meshes), normalize
  // its size/position, and curve its materials.
  const model = useMemo(() => {
    const root = skeletonClone(gltf.scene) as THREE.Object3D;

    // Center at the origin and scale so the longest axis is TARGET_SIZE.
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = TARGET_SIZE / Math.max(size.x, size.y, size.z || 1);
    root.scale.setScalar(s);
    root.position.set(-center.x * s, -center.y * s, -center.z * s);
    root.rotation.y = MODEL_YAW;

    // Curve each material so the bee bends with the planet. Clone first so we
    // don't mutate the cached GLTF materials shared by useGLTF.
    const owned: THREE.Material[] = [];
    const curve = (m: THREE.Material) => {
      const c = curveMaterial(m.clone());
      owned.push(c);
      return c;
    };
    // Wing meshes we can flap procedurally, with their rest orientation.
    const wings: { mesh: THREE.Mesh; rest: THREE.Quaternion }[] = [];
    const isWingMat = (m: THREE.Material) => m.name === WING_MAT_NAME;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      if (mats.some(isWingMat)) wings.push({ mesh, rest: mesh.quaternion.clone() });
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(curve)
        : curve(mesh.material as THREE.Material);
    });
    return { root, owned, wings };
  }, [gltf]);

  // Play the model's own animation (wing flap etc.) if present.
  const { actions } = useAnimations(gltf.animations, model.root);
  useEffect(() => {
    const first = Object.values(actions)[0];
    first?.reset().play();
  }, [actions]);

  useEffect(
    () => () => {
      for (const m of model.owned) m.dispose();
    },
    [model]
  );

  const flapQuat = useRef(new THREE.Quaternion()).current;

  useFrame(() => {
    const g = group.current;
    g.position.copy(sim.pos);
    g.rotation.order = "YXZ";
    g.rotation.y = sim.heading;
    g.rotation.z = sim.roll;
    g.rotation.x = THREE.MathUtils.clamp(-sim.vel.y * 0.045, -0.5, 0.5);

    // Flap the wings around their rest pose.
    const angle = Math.sin(sim.t * WING_FLAP_FREQ) * WING_FLAP_AMP;
    flapQuat.setFromAxisAngle(WING_FLAP_AXIS, angle);
    for (const w of model.wings) w.mesh.quaternion.copy(w.rest).multiply(flapQuat);

    // Blob shadow follows the terrain under the bee.
    const gy = sim.heightAt(sim.pos.x, sim.pos.z);
    shadow.current.position.set(sim.pos.x, gy + 0.06, sim.pos.z);
    const alt = Math.max(0.5, sim.pos.y - gy);
    const sc = THREE.MathUtils.clamp(1.4 - alt * 0.02, 0.5, 1.4);
    shadow.current.scale.setScalar(sc);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity = THREE.MathUtils.clamp(
      0.34 - alt * 0.006,
      0.06,
      0.34
    );
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model.root} />
      </group>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 12]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </>
  );
}

useGLTF.preload("/models/bee.glb");
