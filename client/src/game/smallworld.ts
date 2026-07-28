import type { MapData, FlowerDef, SpeciesId } from "@pollen/shared";

/**
 * "Small World" — a 3-lane matching runner. The bee auto-advances forward at a
 * constant speed while the tiny-planet curvature reveals rows of flowers over
 * the horizon (that IS the "world rotating toward the user"). Each row holds the
 * three flower types shuffled across the lanes; the player taps left/right to
 * hop lanes and chains the same flower type to build a combo.
 *
 * This module generates the run entirely on the client (same MapData schema as
 * the server), so iteration needs no api rebuild.
 */

/** The three flower types used by Small World (visually distinct colors). */
export const SW_SPECIES: SpeciesId[] = ["daisy", "tulip", "sunflower"];

/** Small World tunables (client-only; no shared/config change → no api rebuild). */
export const SW = {
  /** Number of lanes across. */
  lanes: 3,
  /** Horizontal spacing between lane centers (m). */
  laneGap: 2.6,
  /** Forward spacing between rows (m). */
  rowGap: 6.5,
  /** How many rows the run contains. */
  rows: 260,
  /** Z of the first row (ahead of the hive at z=8). */
  startZ: 30,
  /** Constant forward speed (m/s). */
  speed: 12,
  /** Hover clearance kept above the terrain (m). */
  hoverHeight: 2.2,
  /** Peak extra height of the hop arc between rows (m). */
  hopArcHeight: 1.6,
  /** Peak extra height of a forward jump arc over a row (m). */
  jumpArcHeight: 3.4,
  /** Gap kept between the bee and the flower top at each landing (m). */
  landClearance: 0.35,
  /** Chance a row has one empty lane (a gap the bee must avoid). */
  emptyChance: 0.3,
  /** Landing height above the ground for an empty lane (bee dips into the gap). */
  emptyLandHeight: 0.5,
  /** Seconds knocked off the day when the bee lands in an empty gap. */
  missTimePenalty: 5,
  /** Lateral hop tween stiffness (1/s). */
  hopLerp: 13,
  /** Peak roll lean while hopping (radians). */
  leanMax: 0.5,
  /** Length of a run (s). */
  runSeconds: 40,
  /** How much faster the bee travels on the return leg home (the rush back to
   *  the hive before dusk). >1 gives a clean run a little margin. */
  returnSpeedMult: 1.12,
  /** Seconds each half of the mid-day turn-around takes. The bee flies a full
   *  loop "out" while spinning 180° to face home, then a second loop "back"
   *  while holding that heading — giving the player a full 2s to read the
   *  oncoming rows before setting off. Total maneuver = 2 × this. The day clock
   *  is paused throughout so the flourish never costs time to fly home. */
  turnDuration: 2,
  /** Peak height of the turn-around arc (m) — the bee flies one large sweeping
   *  arc as it comes about, rather than spinning on the spot. */
  turnHopHeight: 4,
  /** Points for collecting a flower that breaks/starts a chain. */
  basePoints: 10,
  /** Per-combo points awarded on a matching collect (× current combo). */
  matchPoints: 15,
} as const;

/** World-space X of a lane index (0=left, 1=center, 2=right). */
export function laneToX(lane: number): number {
  return (lane - 1) * SW.laneGap;
}

/** Small deterministic PRNG so a given level seed always lays out the same run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle in place using the supplied RNG. */
function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Build a Small World run as a standard MapData: 3 lanes × SW.rows rows, each
 * row a shuffled permutation of the three flower types (one per lane), on flat
 * ground. Rendering (Flowers/Terrain/Grass) is reused unchanged.
 */
export function generateSmallWorldMap(level: number): MapData {
  const n = Math.max(1, Math.floor(level));
  const seed = (n * 7919 + 13) | 0;
  const rnd = mulberry32(seed);

  const flowers: FlowerDef[] = [];
  for (let r = 0; r < SW.rows; r++) {
    const z = SW.startZ + r * SW.rowGap;
    const perm = shuffle([...SW_SPECIES], rnd);
    // Sometimes leave one lane empty: a gap the bee must hop around, since
    // landing in it resets the score.
    const emptyLane = rnd() < SW.emptyChance ? Math.floor(rnd() * SW.lanes) : -1;
    for (let l = 0; l < SW.lanes; l++) {
      if (l === emptyLane) continue;
      flowers.push({
        id: `r${r}_l${l}`,
        x: laneToX(l),
        z,
        species: perm[l],
        nectar: 10,
        size: 1,
      });
    }
  }

  return {
    levelId: `small-${n}`,
    seed,
    theme: { palette: "#5da24a", skyTint: "#9fd0ff", timeOfDayStart: 0.12 },
    terrain: { sizeX: 120, sizeZ: 2000, ruggedness: 0.5, noiseScale: 0.01 },
    hive: { x: 0, z: 8 },
    flowers,
    difficulty: { level: n, dayLengthSec: SW.runSeconds, energyBudget: 8 },
  };
}
