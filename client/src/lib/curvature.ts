import * as THREE from "three";
import { CONFIG } from "@pollen/shared";

/**
 * Spherical-world rendering. The simulation stays in flat map coordinates,
 * but every material bends geometry down by d²/2R (the first-order drop of a
 * sphere of radius R) with distance from the camera. Distant terrain and
 * flowers sink below the horizon; flying forward "rotates the planet",
 * lifting them into view. R is CONFIG.world.planetRadius.
 */
const CURVED_PROJECT_VERTEX = /* glsl */ `
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
vec4 pnWorld = modelMatrix * mvPosition;
float pnDx = pnWorld.x - cameraPosition.x;
float pnDz = pnWorld.z - cameraPosition.z;
pnWorld.y -= ( pnDx * pnDx + pnDz * pnDz ) / ( 2.0 * uPlanetRadius );
mvPosition = viewMatrix * pnWorld;
gl_Position = projectionMatrix * mvPosition;
`;

/** Wrap a material so its geometry follows the planet's curvature. */
export function curveMaterial<T extends THREE.Material>(mat: T): T {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPlanetRadius = { value: CONFIG.world.planetRadius };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uPlanetRadius;")
      .replace("#include <project_vertex>", CURVED_PROJECT_VERTEX);
  };
  mat.customProgramCacheKey = () => "planet-curved";
  return mat;
}
