/**
 * Difficulty inputs computed from the level number. These condition both the
 * LLM prompt and the procedural fallback generator.
 */
export interface DifficultyInputs {
  level: number;
  dayLengthSec: number;
  energyBudget: number;
  /** Approximate obstacle count. */
  obstacleCount: number;
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
    dayLengthSec: clamp(120 + n * 12, 120, 300),
    energyBudget: clamp(100 + n * 5, 100, 220),
    obstacleCount: clamp(30 + n * 14, 30, 400),
    clusterCount: clamp(7 + Math.floor(n * 1.2), 8, 26),
    minClusterDist: clamp(35 + n * 4, 35, 120),
    maxClusterDist: clamp(240 + n * 40, 280, 900),
    nectarPerFlower: clamp(14 - n * 0.4, 8, 14),
    ruggedness: clamp(3.5 + n * 0.5, 3.5, 12),
    sizeZ: clamp(420 + n * 50, 420, 1100),
    sizeX: clamp(300 + n * 15, 300, 500),
  };
}
