import * as THREE from "three";
import { CONFIG, type MapData, type FlowerDef, type SpeciesId } from "@pollen/shared";
import { makeHeightSampler, type HeightSampler } from "../lib/noise";
import { SW, laneToX } from "./smallworld";
import type { InputState } from "./input";

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

export interface RuntimeFlower {
  def: FlowerDef;
  /** Head position, terrain-resolved. */
  pos: THREE.Vector3;
  nectarMax: number;
  nectarLeft: number;
  /** True once collected (drives the wilt/darken render feedback). */
  pollinated: boolean;
  /** Render dirty flag: instance matrix/color needs refresh. */
  dirty: boolean;
  clusterIdx: number;
}

/** A row of three flowers (one per lane), sorted left→right. */
export interface Row {
  z: number;
  /** Flower indices by lane: [left, center, right]. */
  lanes: number[];
}

/** Cluster locator data (unused by Small World; kept so the beacon/ring
 *  components still compile). */
export interface Cluster {
  center: THREE.Vector3;
  flowerIdxs: number[];
  nectarMax: number;
  nectarLeft: number;
}

export type SimEvent =
  | { type: "hop"; dir: number }
  | { type: "jump" }
  | { type: "collect"; flowerIdx: number; matched: boolean; combo: number }
  | { type: "miss" }
  | { type: "ended"; reason: "time" };

export type BeeMode = "running" | "done";

export interface Sim {
  map: MapData;
  heightAt: HeightSampler;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Yaw. heading 0 = +Z (forward, toward the horizon). Fixed in Small World. */
  heading: number;
  /** Roll used for the hop lean. */
  roll: number;
  mode: BeeMode;
  timeLeft: number;
  dayLength: number;
  t: number;

  // --- Lane runner state ---
  /** Committed lane the bee is hopping toward (0=left, 1=center, 2=right). */
  targetLane: number;
  /** Smoothed lateral X of the bee (tweened toward the target lane). */
  laneX: number;
  /** Index of the next row the bee will reach/collect. */
  nextRow: number;
  /** Species of the most recently collected flower (for chaining). */
  lastSpecies: SpeciesId | null;
  score: number;
  /** Current chain length of same-type collects. */
  combo: number;
  bestCombo: number;
  /** Why the run ended, once it has. */
  endReason: "time" | null;
  /** Active forward jump (leap over a row), or null while grounded-hopping. */
  jump: { startZ: number; endZ: number; startY: number; skipRow: number } | null;

  flowers: RuntimeFlower[];
  rows: Row[];
  /** Kept for compatibility with cluster-based visuals (unused here). */
  clusters: Cluster[];
  events: SimEvent[];
  /** Soft world bounds (kept for camera/terrain helpers). */
  bounds: { halfX: number; maxZ: number };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function createSim(map: MapData): Sim {
  const heightAt = makeHeightSampler(map);

  const flowers: RuntimeFlower[] = map.flowers.map((def: FlowerDef) => {
    const sp = CONFIG.species[def.species] ?? CONFIG.species.daisy;
    const y = heightAt(def.x, def.z) + sp.stemHeight * def.size;
    return {
      def,
      pos: new THREE.Vector3(def.x, y, def.z),
      nectarMax: def.nectar,
      nectarLeft: def.nectar,
      pollinated: false,
      dirty: true,
      clusterIdx: -1,
    };
  });

  // Reconstruct rows by row index (from z) and lane (from x). Empty lanes are
  // marked -1 — a gap the bee must avoid.
  const byRow = new Map<number, Row>();
  for (let i = 0; i < flowers.length; i++) {
    const f = flowers[i];
    const rIdx = Math.round((f.pos.z - SW.startZ) / SW.rowGap);
    const lane = THREE.MathUtils.clamp(Math.round(f.pos.x / SW.laneGap) + 1, 0, SW.lanes - 1);
    let row = byRow.get(rIdx);
    if (!row) {
      row = { z: SW.startZ + rIdx * SW.rowGap, lanes: new Array(SW.lanes).fill(-1) };
      byRow.set(rIdx, row);
    }
    row.lanes[lane] = i;
  }
  const rows: Row[] = [...byRow.values()].sort((a, b) => a.z - b.z);

  const hiveY = heightAt(map.hive.x, map.hive.z);
  const dayLength = map.difficulty.dayLengthSec || SW.runSeconds;

  return {
    map,
    heightAt,
    pos: new THREE.Vector3(0, hiveY + SW.hoverHeight, map.hive.z),
    vel: new THREE.Vector3(0, 0, SW.speed),
    heading: 0,
    roll: 0,
    mode: "running",
    timeLeft: dayLength,
    dayLength,
    t: 0,
    targetLane: 1,
    laneX: 0,
    nextRow: 0,
    lastSpecies: null,
    score: 0,
    combo: 0,
    bestCombo: 0,
    endReason: null,
    jump: null,
    flowers,
    rows,
    clusters: [],
    events: [],
    bounds: { halfX: map.terrain.sizeX / 2 - 4, maxZ: map.terrain.sizeZ - 4 },
  };
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

/** Nearest lane index to the bee's current lateral position, clamped. */
function nearestLane(laneX: number): number {
  return THREE.MathUtils.clamp(Math.round(laneX / SW.laneGap) + 1, 0, SW.lanes - 1);
}

/** Landing height for a given row/lane. For a flower: its species-specific top
 *  (head center + head radius) plus a small clearance. For an empty lane: just
 *  above the ground, so the bee visibly dips into the gap. Clamps to valid rows. */
function landingY(sim: Sim, rowIdx: number, lane: number): number {
  const r = THREE.MathUtils.clamp(rowIdx, 0, sim.rows.length - 1);
  const row = sim.rows[r];
  const idx = row.lanes[lane];
  if (idx < 0) {
    return sim.heightAt(laneToX(lane), row.z) + SW.emptyLandHeight;
  }
  const f = sim.flowers[idx];
  const sp = CONFIG.species[f.def.species] ?? CONFIG.species.daisy;
  const headTop = 0.5 * sp.headScale * f.def.size;
  return f.pos.y + headTop + SW.landClearance;
}

export function stepSim(sim: Sim, dt: number, inp: InputState): void {
  sim.t += dt;
  if (sim.mode === "done") return;

  // --- Timer: the run ends at dusk. ---
  sim.timeLeft -= dt;
  if (sim.timeLeft <= 0) {
    sim.timeLeft = 0;
    endRun(sim);
    return;
  }

  // --- Hop input: one tap = one lane, clamped at the edges. ---
  if (inp.hop !== 0) {
    const dir = Math.sign(inp.hop);
    const next = THREE.MathUtils.clamp(sim.targetLane + dir, 0, SW.lanes - 1);
    if (next !== sim.targetLane) {
      sim.targetLane = next;
      sim.events.push({ type: "hop", dir });
    }
    inp.hop = 0;
  }

  // --- Jump input: leap forward, up and over the next row. ---
  if (inp.jump) {
    inp.jump = false;
    if (!sim.jump && sim.nextRow + 1 < sim.rows.length) {
      sim.jump = {
        startZ: sim.pos.z,
        endZ: sim.rows[sim.nextRow + 1].z,
        startY: sim.pos.y,
        skipRow: sim.nextRow,
      };
      sim.events.push({ type: "jump" });
    }
  }

  // --- Lateral tween toward the target lane. ---
  const targetX = laneToX(sim.targetLane);
  const prevX = sim.laneX;
  sim.laneX += (targetX - sim.laneX) * Math.min(1, SW.hopLerp * dt);
  sim.pos.x = sim.laneX;

  // Bank into the hop; ease back to level once settled.
  const rollTarget = THREE.MathUtils.clamp((targetX - sim.laneX) * 1.4, -SW.leanMax, SW.leanMax);
  sim.roll += (rollTarget - sim.roll) * Math.min(1, 9 * dt);

  // --- Constant forward motion. ---
  const prevY = sim.pos.y;
  sim.pos.z += SW.speed * dt;
  const lane = nearestLane(sim.laneX);
  const firstRowZ = sim.rows.length ? sim.rows[0].z : SW.startZ;

  if (sim.jump && sim.pos.z >= sim.jump.endZ) sim.jump = null;

  if (sim.jump) {
    // A single tall arc that carries the bee over the skipped row and lands on
    // the one beyond it.
    const j = sim.jump;
    const span = Math.max(1e-4, j.endZ - j.startZ);
    const frac = THREE.MathUtils.clamp((sim.pos.z - j.startZ) / span, 0, 1);
    const endY = landingY(sim, j.skipRow + 1, lane);
    sim.pos.y = j.startY + (endY - j.startY) * frac + Math.sin(frac * Math.PI) * SW.jumpArcHeight;
  } else if (sim.pos.z < firstRowZ) {
    // Opening: cruise at a constant height out from the hive, then hop up onto
    // the first flower over the final row-gap.
    const cruiseY = sim.heightAt(sim.map.hive.x, sim.map.hive.z) + SW.hoverHeight;
    const hopStartZ = firstRowZ - SW.rowGap;
    if (sim.pos.z <= hopStartZ) {
      sim.pos.y = cruiseY;
    } else {
      const frac = (sim.pos.z - hopStartZ) / SW.rowGap; // 0 at cruise, 1 at first flower
      const land0 = landingY(sim, 0, lane);
      sim.pos.y = cruiseY + (land0 - cruiseY) * frac + Math.sin(frac * Math.PI) * SW.hopArcHeight;
    }
  } else {
    // Hop in an arc that lands on each flower's top (which varies by species)
    // and peaks between rows.
    const hopPhase = (sim.pos.z - SW.startZ) / SW.rowGap;
    const rowIdx = Math.floor(hopPhase);
    const frac = hopPhase - rowIdx; // 0 at the row just landed, 1 at the next
    // Baseline glides from this row's flower top to the next, so touchdowns meet
    // the tops exactly; the arc lifts the bee between them.
    const landHere = landingY(sim, rowIdx, lane);
    const landNext = landingY(sim, rowIdx + 1, lane);
    const base = landHere + (landNext - landHere) * frac;
    sim.pos.y = base + Math.sin(frac * Math.PI) * SW.hopArcHeight;
  }

  // Velocity feeds the Bee's pitch/lean visuals.
  sim.vel.set(
    (sim.pos.x - prevX) / Math.max(dt, 1e-4),
    (sim.pos.y - prevY) / Math.max(dt, 1e-4),
    SW.speed
  );

  // --- Collection: as each row's z-plane passes under the bee, collect the
  // flower in the bee's current lane and score the chain. ---
  while (sim.nextRow < sim.rows.length && sim.pos.z >= sim.rows[sim.nextRow].z) {
    const row = sim.rows[sim.nextRow];
    sim.nextRow++;
    const lane = nearestLane(sim.laneX);

    // Jumped clean over this row: no collect, no gap penalty.
    if (sim.jump && sim.nextRow - 1 === sim.jump.skipRow) {
      continue;
    }

    const fIdx = row.lanes[lane];

    // Empty lane: the bee lands in a gap — the score resets, the chain breaks,
    // and a chunk of the day is lost.
    if (fIdx < 0) {
      sim.score = 0;
      sim.combo = 0;
      sim.lastSpecies = null;
      sim.timeLeft -= SW.missTimePenalty;
      sim.events.push({ type: "miss" });
      if (sim.timeLeft <= 0) {
        sim.timeLeft = 0;
        endRun(sim);
        return;
      }
      continue;
    }

    const f = sim.flowers[fIdx];
    const sp = f.def.species;

    const matched = sim.lastSpecies !== null && sp === sim.lastSpecies;
    if (matched) {
      sim.combo++;
      sim.score += SW.matchPoints * sim.combo;
    } else {
      sim.combo = 1;
      sim.score += SW.basePoints;
    }
    sim.bestCombo = Math.max(sim.bestCombo, sim.combo);
    sim.lastSpecies = sp;

    // Mark collected for the wilt/darken render feedback.
    f.pollinated = true;
    f.nectarLeft = 0;
    f.dirty = true;

    sim.events.push({ type: "collect", flowerIdx: fIdx, matched, combo: sim.combo });
  }

  // Ran out of rows before the timer — end the run.
  if (sim.nextRow >= sim.rows.length) endRun(sim);
}

function endRun(sim: Sim): void {
  if (sim.mode === "done") return;
  sim.mode = "done";
  sim.endReason = "time";
  sim.events.push({ type: "ended", reason: "time" });
}
