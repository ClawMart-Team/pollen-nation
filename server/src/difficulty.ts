/**
 * Difficulty inputs computed from the level number. These condition both the
 * LLM prompt and the procedural fallback generator.
 */
export interface DifficultyInputs {
  level: number;
  dayLengthSec: number;
  energyBudget: number;
  /** Number of flower clusters. */
  clusterCount: number;
  /** Distance from hive to the nearest rich cluster (m). */
  minClusterDist: number;
  /** Distance from hive to the farthest cluster (m). */
  maxClusterDist: number;
  /** Average nectar per flower. */
  nectarPerFlower: number;
  /** Terrain vertical amplitude (m). */
  ruggedness: number;
  /** World depth (m). */
  sizeZ: number;
  sizeX: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function computeDifficulty(level: number): DifficultyInputs {
  const n = Math.max(1, Math.floor(level));
  return {
    level: n,
    // Fixed per design: world size, day length, and energy never scale.
    dayLengthSec: 150,
    energyBudget: 8,
    sizeX: 400,
    sizeZ: 700,
    // Difficulty comes from terrain and flower scarcity/distance instead:
    // much hillier world…
    ruggedness: clamp(3.5 + n * 2, 5, 20),
    // …with fewer clusters…
    clusterCount: clamp(12 - n, 4, 11),
    // …whose nearest one keeps retreating from the hive.
    minClusterDist: clamp(30 + n * 15, 45, 400),
    maxClusterDist: 600,
    nectarPerFlower: clamp(14 - n * 0.4, 8, 14),
  };
}
