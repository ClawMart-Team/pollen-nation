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
  | { type: "turn" }
  | { type: "collect"; flowerIdx: number; matched: boolean; combo: number; points: number }
  | { type: "ended"; reason: "time" | "grass" | "home" };

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
  /** Why the run ended, once it has. "home" = made it back (a win). */
  endReason: "time" | "grass" | "home" | null;
  /** Travel direction along Z: +1 outbound from the hive, -1 returning home. */
  travelDir: 1 | -1;
  /** Next row to reach on the return leg (decreasing), or -1 while outbound. */
  retRow: number;
  /** Active mid-day turn-around (the cinematic arc), or null. `x0`/`xLane` glide
   *  the bee laterally into a lane that has flowers on the first return rows so
   *  it never drops into a gap the instant the turn completes. */
  turn: { t: number; y0: number; x0: number; xLane: number } | null;
  /** Active jump (leap over a row), or null while grounded-hopping. */
  jump: { dir: 1 | -1; startZ: number; endZ: number; startY: number; skipRow: number } | null;

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
    travelDir: 1,
    retRow: -1,
    turn: null,
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

/** Reset the bee to its opening-cruise state without regenerating the map.
 *  Used by the menu's attract loop to replay the fly-by endlessly. */
export function resetToStart(sim: Sim): void {
  const hiveY = sim.heightAt(sim.map.hive.x, sim.map.hive.z);
  sim.pos.set(0, hiveY + SW.hoverHeight, sim.map.hive.z);
  sim.vel.set(0, 0, SW.speed);
  sim.heading = 0;
  sim.roll = 0;
  sim.mode = "running";
  sim.timeLeft = sim.dayLength;
  sim.targetLane = 1;
  sim.laneX = 0;
  sim.nextRow = 0;
  sim.lastSpecies = null;
  sim.combo = 0;
  sim.travelDir = 1;
  sim.retRow = -1;
  sim.turn = null;
  sim.jump = null;
  sim.endReason = null;
  sim.events.length = 0;
}

/** Nearest lane index to the bee's current lateral position, clamped. */
function nearestLane(laneX: number): number {
  return THREE.MathUtils.clamp(Math.round(laneX / SW.laneGap) + 1, 0, SW.lanes - 1);
}

/** True if the given row has a flower (not a gap) in the given lane. */
function laneFilled(sim: Sim, rowIdx: number, lane: number): boolean {
  const r = THREE.MathUtils.clamp(rowIdx, 0, sim.rows.length - 1);
  return sim.rows[r].lanes[lane] >= 0;
}

/** Choose the lane the bee should be in when it finishes the turn-around, so it
 *  lands on a flower rather than falling into a gap right out of the maneuver.
 *  Prefers the bee's current lane; otherwise the nearest lane that has a flower
 *  on both of the first two return rows. Each row has at most one empty lane, so
 *  a safe common lane always exists. */
function pickReturnLane(sim: Sim, retRow: number, current: number): number {
  const rows = [retRow, retRow - 1];
  const safe = (lane: number) => rows.every((r) => r < 0 || laneFilled(sim, r, lane));
  if (safe(current)) return current;
  for (let d = 1; d < SW.lanes; d++) {
    for (const lane of [current - d, current + d]) {
      if (lane >= 0 && lane < SW.lanes && safe(lane)) return lane;
    }
  }
  return current;
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

  // --- Timer: dusk. If the bee is still out when it hits zero, it dies. The
  // day clock pauses during the scripted turn-around loop so the flourish never
  // eats into the bee's time to fly home. ---
  if (!sim.turn) {
    sim.timeLeft -= dt;
    if (sim.timeLeft <= 0) {
      sim.timeLeft = 0;
      endRun(sim, "time");
      return;
    }
  }

  // --- Mid-day turn-around: at the half-way mark the bee spins 180° and heads
  // back toward the hive. ---
  if (sim.travelDir === 1 && !sim.turn && sim.timeLeft <= sim.dayLength / 2) {
    sim.retRow = sim.nextRow - 1; // the most recent row, re-crossed first
    // Aim the bee at a lane that has flowers on the first return rows so it does
    // not fall into a gap the moment the cinematic arc completes.
    const safeLane = pickReturnLane(sim, sim.retRow, nearestLane(sim.laneX));
    sim.targetLane = safeLane;
    sim.turn = { t: 0, y0: sim.pos.y, x0: sim.laneX, xLane: laneToX(safeLane) };
    sim.jump = null;
    sim.events.push({ type: "turn" });
  }

  if (sim.turn) {
    // One large arc turn-around, forward progress frozen throughout:
    //  • First half (turnDuration s): fly up and over the arc while spinning
    //    180° to face back toward the hive.
    //  • Second half (turnDuration s): hold that heading and glide back down,
    //    giving the player a full turnDuration seconds looking at the oncoming
    //    rows before the bee sets off and needs steering.
    sim.turn.t += dt;
    const total = SW.turnDuration * 2;
    const p = THREE.MathUtils.clamp(sim.turn.t / total, 0, 1);
    // Heading sweeps 180° across the first half, then holds facing home.
    const turnP = THREE.MathUtils.clamp(sim.turn.t / SW.turnDuration, 0, 1);
    sim.heading = Math.PI * THREE.MathUtils.smoothstep(turnP, 0, 1);
    // One large arc up and back down over the whole maneuver (no flip).
    sim.pos.y = sim.turn.y0 + Math.sin(p * Math.PI) * SW.turnHopHeight;
    // Glide sideways into the chosen safe lane over the course of the arc, so the
    // bee comes out of the turn lined up with a flower rather than a gap.
    sim.laneX = sim.turn.x0 + (sim.turn.xLane - sim.turn.x0) * THREE.MathUtils.smoothstep(p, 0, 1);
    sim.pos.x = sim.laneX;
    sim.vel.set(0, 0, 0);
    if (sim.turn.t >= total) {
      sim.turn = null;
      sim.heading = Math.PI;
      sim.travelDir = -1;
    }
    return;
  }

  // --- Hop input: one tap = one lane, clamped at the edges. On the return leg
  // the camera faces the other way, so flip the input to keep left/right
  // relative to the bee's current travel direction. ---
  if (inp.hop !== 0) {
    const dir = Math.sign(inp.hop) * sim.travelDir;
    const next = THREE.MathUtils.clamp(sim.targetLane + dir, 0, SW.lanes - 1);
    if (next !== sim.targetLane) {
      sim.targetLane = next;
      sim.events.push({ type: "hop", dir });
    }
    inp.hop = 0;
  }

  // --- Jump input: leap up and over the next row in the travel direction. ---
  if (inp.jump) {
    inp.jump = false;
    if (!sim.jump) {
      if (sim.travelDir === 1) {
        const land = sim.nextRow + 1;
        if (land < sim.rows.length) {
          sim.jump = { dir: 1, startZ: sim.pos.z, endZ: sim.rows[land].z, startY: sim.pos.y, skipRow: sim.nextRow };
          sim.events.push({ type: "jump" });
        }
      } else {
        const land = sim.retRow - 1;
        if (land >= 0) {
          sim.jump = { dir: -1, startZ: sim.pos.z, endZ: sim.rows[land].z, startY: sim.pos.y, skipRow: sim.retRow };
          sim.events.push({ type: "jump" });
        }
      }
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

  // --- Constant motion along the travel direction (faster on the way home). ---
  const prevY = sim.pos.y;
  const prevZ = sim.pos.z;
  const moveSpeed = SW.speed * (sim.travelDir === -1 ? SW.returnSpeedMult : 1);
  sim.pos.z += moveSpeed * sim.travelDir * dt;
  const lane = nearestLane(sim.laneX);
  const firstRowZ = sim.rows.length ? sim.rows[0].z : SW.startZ;

  const jumpDone = sim.jump && (sim.jump.dir === 1 ? sim.pos.z >= sim.jump.endZ : sim.pos.z <= sim.jump.endZ);
  if (jumpDone) sim.jump = null;

  if (sim.jump) {
    // A single tall arc that carries the bee over the skipped row and lands on
    // the one beyond it (in the travel direction).
    const j = sim.jump;
    const span = j.endZ - j.startZ;
    const frac = THREE.MathUtils.clamp((sim.pos.z - j.startZ) / (span || 1e-4), 0, 1);
    const endY = landingY(sim, j.skipRow + j.dir, lane);
    sim.pos.y = j.startY + (endY - j.startY) * frac + Math.sin(frac * Math.PI) * SW.jumpArcHeight;
  } else if (sim.pos.z < firstRowZ) {
    // Between the hive and the first row: cruise at a constant height. Outbound
    // this is the launch; on the return it is the final glide home.
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
    (sim.pos.z - prevZ) / Math.max(dt, 1e-4)
  );

  // --- Collection / hazard check. ---
  if (sim.travelDir === 1) {
    // Outbound: collect each row as its z-plane passes under the bee.
    while (sim.nextRow < sim.rows.length && sim.pos.z >= sim.rows[sim.nextRow].z) {
      const ri = sim.nextRow;
      const row = sim.rows[ri];
      sim.nextRow++;
      const lane = nearestLane(sim.laneX);

      // Jumped clean over this row: no collect, no gap penalty.
      if (sim.jump && ri === sim.jump.skipRow) continue;

      const fIdx = row.lanes[lane];

      // Empty lane: the bee drops into the gap and touches the grass — over.
      if (fIdx < 0) {
        endRun(sim, "grass");
        return;
      }

      const f = sim.flowers[fIdx];
      const sp = f.def.species;

      const matched = sim.lastSpecies !== null && sp === sim.lastSpecies;
      let gained: number;
      if (matched) {
        sim.combo++;
        gained = SW.matchPoints * sim.combo;
      } else {
        sim.combo = 1;
        gained = SW.basePoints;
      }
      sim.score += gained;
      sim.bestCombo = Math.max(sim.bestCombo, sim.combo);
      sim.lastSpecies = sp;

      // Mark collected for the wilt/darken render feedback.
      f.pollinated = true;
      f.nectarLeft = 0;
      f.dirty = true;

      sim.events.push({ type: "collect", flowerIdx: fIdx, matched, combo: sim.combo, points: gained });
    }
  } else {
    // Return leg: re-cross the rows heading home. Flowers the bee already
    // landed on outbound are spent (no score), but any it skipped can still be
    // pollinated for points. A gap is still a fatal fall into the grass.
    while (sim.retRow >= 0 && sim.pos.z <= sim.rows[sim.retRow].z) {
      const ri = sim.retRow;
      const row = sim.rows[ri];
      sim.retRow--;
      const lane = nearestLane(sim.laneX);

      if (sim.jump && ri === sim.jump.skipRow) continue;

      const fIdx = row.lanes[lane];

      if (fIdx < 0) {
        endRun(sim, "grass");
        return;
      }

      const f = sim.flowers[fIdx];

      // Already landed on this one outbound — a valid perch, but no score.
      if (f.pollinated) continue;

      const sp = f.def.species;
      const matched = sim.lastSpecies !== null && sp === sim.lastSpecies;
      let gained: number;
      if (matched) {
        sim.combo++;
        gained = SW.matchPoints * sim.combo;
      } else {
        sim.combo = 1;
        gained = SW.basePoints;
      }
      sim.score += gained;
      sim.bestCombo = Math.max(sim.bestCombo, sim.combo);
      sim.lastSpecies = sp;

      f.pollinated = true;
      f.nectarLeft = 0;
      f.dirty = true;

      sim.events.push({ type: "collect", flowerIdx: fIdx, matched, combo: sim.combo, points: gained });
    }

    // Made it back to the hive before dusk — a win.
    if (sim.pos.z <= sim.map.hive.z) {
      endRun(sim, "home");
      return;
    }
  }
}

function endRun(sim: Sim, reason: "time" | "grass" | "home"): void {
  if (sim.mode === "done") return;
  sim.mode = "done";
  sim.endReason = reason;
  sim.events.push({ type: "ended", reason });
}
