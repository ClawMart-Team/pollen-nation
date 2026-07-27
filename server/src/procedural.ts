import type { MapData, FlowerDef, ObstacleDef, SpeciesId } from "@pollen/shared";
import { SPECIES_IDS } from "@pollen/shared";
import type { DifficultyInputs } from "./difficulty.js";

/** Deterministic PRNG so a replayed level is identical. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTES = [
  { palette: "#5da24a", skyTint: "#9fd4f5" },
  { palette: "#6aa84f", skyTint: "#aee0ff" },
  { palette: "#7fae52", skyTint: "#ffd9a8" },
  { palette: "#4f9d5f", skyTint: "#c9e8ff" },
];

/**
 * Deterministic procedural map generator. Emits the exact same schema as the
 * LLM path — the client never knows which one produced a map.
 */
export function generateProceduralMap(d: DifficultyInputs): MapData {
  const seed = (d.level * 7919 + 13) | 0;
  const rnd = mulberry32(seed);
  const pal = PALETTES[(d.level - 1) % PALETTES.length];

  const hive = { x: 0, z: 24 };
  const flowers: FlowerDef[] = [];
  const obstacles: ObstacleDef[] = [];
  const halfX = d.sizeX / 2 - 20;

  // Flower clusters: richer and progressively farther from the hive so the
  // frontier of fresh nectar recedes over the level.
  for (let c = 0; c < d.clusterCount; c++) {
    const t = d.clusterCount === 1 ? 0 : c / (d.clusterCount - 1);
    const dist =
      d.minClusterDist +
      (Math.min(d.maxClusterDist, d.sizeZ - 70) - d.minClusterDist) * t * (0.85 + rnd() * 0.3);
    const ang = (rnd() - 0.5) * (Math.PI * 0.66); // fan out ahead of the hive (+Z)
    const cx = Math.max(-halfX, Math.min(halfX, hive.x + Math.sin(ang) * dist * 0.7));
    const cz = Math.min(d.sizeZ - 40, hive.z + Math.cos(ang) * dist);
    const count = 6 + Math.floor(rnd() * 7);
    const spread = 6 + rnd() * 8;
    const richness = 1 + (dist / d.maxClusterDist) * 1.4; // farther = richer
    const dominant = SPECIES_IDS[Math.floor(rnd() * SPECIES_IDS.length)] as SpeciesId;
    for (let f = 0; f < count; f++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * spread;
      const species = rnd() < 0.7 ? dominant : (SPECIES_IDS[Math.floor(rnd() * SPECIES_IDS.length)] as SpeciesId);
      flowers.push({
        id: `f${c}_${f}`,
        x: Math.max(-halfX, Math.min(halfX, cx + Math.cos(a) * r)),
        z: Math.max(10, Math.min(d.sizeZ - 10, cz + Math.sin(a) * r)),
        species,
        nectar: Math.min(100, Math.max(1, d.nectarPerFlower * richness * (0.7 + rnd() * 0.6))),
        size: 0.8 + rnd() * 0.8,
      });
    }
  }

  // Obstacles: branches with leaf clusters hanging nearby. Skip the hive's
  // launch corridor (enforced again in sanity repair).
  for (let i = 0; i < d.obstacleCount; i++) {
    const x = (rnd() * 2 - 1) * halfX;
    const z = 30 + rnd() * (d.sizeZ - 60);
    const branch = rnd() < 0.6;
    obstacles.push({
      id: `o${i}`,
      type: branch ? "branch" : "leafCluster",
      x,
      z,
      yOffset: branch ? 2.5 + rnd() * 9 : 2 + rnd() * 10,
      rotY: rnd() * Math.PI,
      scale: 0.7 + rnd() * 1.3,
    });
  }

  return {
    levelId: `level-${d.level}`,
    seed,
    theme: { ...pal, timeOfDayStart: 0.05 + rnd() * 0.1 },
    terrain: {
      sizeX: d.sizeX,
      sizeZ: d.sizeZ,
      ruggedness: d.ruggedness,
      noiseScale: 0.012 + rnd() * 0.008,
    },
    hive,
    flowers,
    obstacles,
    difficulty: {
      level: d.level,
      dayLengthSec: d.dayLengthSec,
      energyBudget: d.energyBudget,
    },
  };
}
