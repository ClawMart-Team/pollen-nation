import type * as THREE from "three";

/**
 * Imperative FX bus: the Particles component registers its spawn function here
 * so game logic can fire bursts without React round-trips.
 */
export const fxBus: {
  spawn: (pos: THREE.Vector3, color: number, count?: number) => void;
} = {
  spawn: () => {},
};
