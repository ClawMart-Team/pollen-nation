import * as THREE from "three";
import { CONFIG, nectarGoalForLevel, type MapData, type FlowerDef } from "@pollen/shared";
import { makeHeightSampler, type HeightSampler } from "../lib/noise";
import type { InputState } from "./input";

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

export interface RuntimeFlower {
  def: FlowerDef;
  /** Head (perch) position, terrain-resolved. */
  pos: THREE.Vector3;
  nectarMax: number;
  nectarLeft: number;
  pollinated: boolean;
  /** Render dirty flag: instance matrix/color needs refresh. */
  dirty: boolean;
  clusterIdx: number;
}

export interface Cluster {
  center: THREE.Vector3;
  flowerIdxs: number[];
  nectarMax: number;
  /** Cached, refreshed by the sim when flowers drain. */
  nectarLeft: number;
}

export type SimEvent =
  | { type: "flap" }
  | { type: "landed"; flowerIdx: number }
  | { type: "tookOff" }
  | { type: "pollinated"; flowerIdx: number }
  | { type: "terrainSkim" }
  | { type: "ended"; reason: "time" | "energy" };

export type BeeMode = "flying" | "perched" | "dying" | "done";

export interface Sim {
  map: MapData;
  heightAt: HeightSampler;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** Yaw. heading 0 = +Z (away from the hive, toward the horizon). */
  heading: number;
  roll: number;
  /** Smoothed steering value in [-1, 1]. */
  steer: number;
  mode: BeeMode;
  energy: number;
  energyMax: number;
  timeLeft: number;
  dayLength: number;
  nectar: number;
  /** Minimum nectar required to complete this level. */
  nectarGoal: number;
  pollinatedThisRun: number;
  perchedFlower: number;
  sipRate: number;
  skimCooldown: number;
  takeoffGrace: number;
  dieT: number;
  /** Wing-flap animation trigger timestamp (sim time). */
  lastFlapAt: number;
  t: number;
  flowers: RuntimeFlower[];
  clusters: Cluster[];
  events: SimEvent[];
  bounds: { halfX: number; maxZ: number };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const F = CONFIG.flight;
const FL = CONFIG.flowers;

const GRID_CELL = 16;
const gkey = (cx: number, cz: number) => cx + "," + cz;

const flowerGrid = new Map<string, number[]>();

function buildFlowerGrid(flowers: RuntimeFlower[]): void {
  flowerGrid.clear();
  flowers.forEach((f, i) => {
    const k = gkey(Math.floor(f.pos.x / GRID_CELL), Math.floor(f.pos.z / GRID_CELL));
    let arr = flowerGrid.get(k);
    if (!arr) flowerGrid.set(k, (arr = []));
    arr.push(i);
  });
}

export function createSim(map: MapData, pollinatedIds: string[]): Sim {
  const heightAt = makeHeightSampler(map);
  const pollinatedSet = new Set(pollinatedIds);

  const flowers: RuntimeFlower[] = map.flowers.map((def) => {
    const sp = CONFIG.species[def.species] ?? CONFIG.species.daisy;
    const y = heightAt(def.x, def.z) + sp.stemHeight * def.size;
    return {
      def,
      pos: new THREE.Vector3(def.x, y, def.z),
      nectarMax: def.nectar,
      nectarLeft: def.nectar,
      pollinated: pollinatedSet.has(def.id),
      dirty: true,
      clusterIdx: -1,
    };
  });

  // Group flowers into clusters on a coarse grid (beacons + compass petals).
  const cell = CONFIG.world.clusterCell;
  const byCell = new Map<string, number[]>();
  flowers.forEach((f, i) => {
    const k = gkey(Math.floor(f.pos.x / cell), Math.floor(f.pos.z / cell));
    let arr = byCell.get(k);
    if (!arr) byCell.set(k, (arr = []));
    arr.push(i);
  });
  const clusters: Cluster[] = [];
  for (const idxs of byCell.values()) {
    const center = new THREE.Vector3();
    let max = 0;
    for (const i of idxs) {
      center.add(flowers[i].pos);
      max += flowers[i].nectarMax;
      flowers[i].clusterIdx = clusters.length;
    }
    center.divideScalar(idxs.length);
    clusters.push({ center, flowerIdxs: idxs, nectarMax: max, nectarLeft: max });
  }

  buildFlowerGrid(flowers);

  const hiveY = heightAt(map.hive.x, map.hive.z);
  const dayLength = map.difficulty.dayLengthSec || CONFIG.day.defaultLengthSec;
  const energyMax = map.difficulty.energyBudget || CONFIG.day.defaultEnergy;
  const nectarGoal = map.difficulty.nectarGoal ?? nectarGoalForLevel(map.difficulty.level);

  return {
    map,
    heightAt,
    pos: new THREE.Vector3(map.hive.x, hiveY + 3, map.hive.z),
    vel: new THREE.Vector3(0, 0, F.baseSpeed),
    heading: 0,
    roll: 0,
    steer: 0,
    mode: "flying",
    energy: energyMax,
    energyMax,
    timeLeft: dayLength,
    dayLength,
    nectar: 0,
    nectarGoal,
    pollinatedThisRun: 0,
    perchedFlower: -1,
    sipRate: 0,
    skimCooldown: 0,
    takeoffGrace: 0,
    dieT: 0,
    lastFlapAt: -10,
    t: 0,
    flowers,
    clusters,
    events: [],
    bounds: { halfX: map.terrain.sizeX / 2 - 4, maxZ: map.terrain.sizeZ - 4 },
  };
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

/** Steering response: dead zone in the middle, curved toward the edges. */
function steerCurve(x: number): number {
  const dz = F.steerDeadZone;
  const a = Math.abs(x);
  if (a <= dz) return 0;
  const t = Math.min(1, (a - dz) / (1 - dz));
  return Math.sign(x) * Math.pow(t, F.steerCurveExp);
}

function findLandableFlower(sim: Sim): number {
  const cx = Math.floor(sim.pos.x / GRID_CELL);
  const cz = Math.floor(sim.pos.z / GRID_CELL);
  let best = -1;
  let bestD2 = FL.landingRadius * FL.landingRadius;
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const arr = flowerGrid.get(gkey(cx + dx, cz + dz));
      if (!arr) continue;
      for (const i of arr) {
        const f = sim.flowers[i];
        if (f.nectarLeft / f.nectarMax <= FL.depletedFrac && f.pollinated) continue;
        const d2 = sim.pos.distanceToSquared(f.pos);
        if (d2 < bestD2) {
          bestD2 = d2;
          best = i;
        }
      }
    }
  return best;
}

function endFlight(sim: Sim, reason: "time" | "energy"): void {
  if (sim.mode === "dying" || sim.mode === "done") return;
  sim.mode = "dying";
  sim.perchedFlower = -1;
  sim.dieT = reason === "time" ? 0.6 : CONFIG.ending.driftSec;
  sim.events.push({ type: "ended", reason });
}

export function stepSim(sim: Sim, dt: number, inp: InputState): void {
  sim.t += dt;
  if (sim.mode === "done") return;

  // --- Day timer always runs (the central tradeoff of sipping). ---
  if (sim.mode !== "dying") {
    sim.timeLeft -= dt;
    if (sim.timeLeft <= 0) {
      sim.timeLeft = 0;
      endFlight(sim, "time");
    }
  }

  sim.skimCooldown = Math.max(0, sim.skimCooldown - dt);
  sim.takeoffGrace = Math.max(0, sim.takeoffGrace - dt);

  // --- Perched: sip nectar. ---
  if (sim.mode === "perched") {
    const f = sim.flowers[sim.perchedFlower];
    if (inp.flaps > 0) {
      // Takeoff.
      inp.flaps = 0;
      sim.mode = "flying";
      sim.perchedFlower = -1;
      sim.sipRate = 0;
      sim.vel.set(Math.sin(sim.heading), 0, Math.cos(sim.heading))
        .multiplyScalar(F.baseSpeed * 0.5);
      sim.vel.y = FL.takeoffImpulse;
      sim.takeoffGrace = FL.takeoffGraceSec;
      sim.lastFlapAt = sim.t;
      sim.events.push({ type: "tookOff" });
    } else if (f) {
      // Diminishing returns as the flower drains.
      const frac = Math.max(0, f.nectarLeft / f.nectarMax);
      const rate = FL.sipNectarPerSec * Math.pow(frac, FL.diminishExp);
      const sip = Math.min(rate * dt, f.nectarLeft);
      if (sip > 0) {
        f.nectarLeft -= sip;
        f.dirty = true;
        sim.nectar += sip;
        sim.energy = Math.min(sim.energyMax, sim.energy + sip * FL.energyPerNectar);
        if (f.clusterIdx >= 0) sim.clusters[f.clusterIdx].nectarLeft -= sip;
        sim.sipRate = rate;
      } else {
        sim.sipRate = 0;
      }
      sim.pos.copy(f.pos);
      sim.vel.set(0, 0, 0);
    }
    return;
  }

  // --- Flying / dying kinematics. ---
  const dying = sim.mode === "dying";

  // Steering: hold sustains, release decays.
  if (!dying) {
    const target = inp.down ? steerCurve(inp.steerX) : 0;
    const k = inp.down ? 10 : F.steerReleaseDecay;
    sim.steer += (target - sim.steer) * Math.min(1, k * dt);
  } else {
    sim.steer *= Math.max(0, 1 - 3 * dt);
  }
  // Screen-right tap (steer > 0) turns right: heading decreases (right of +Z is -X).
  sim.heading -= sim.steer * F.turnRateMax * dt;
  const rollTarget = sim.steer * F.bankMaxRoll;
  sim.roll += (rollTarget - sim.roll) * Math.min(1, 8 * dt);

  // Flaps.
  if (!dying && inp.flaps > 0) {
    const n = inp.flaps;
    inp.flaps = 0;
    for (let i = 0; i < n; i++) {
      if (sim.energy <= 0) break;
      sim.vel.y = Math.min(sim.vel.y + F.flapImpulse, F.maxRiseSpeed);
      sim.energy -= F.flapEnergyCost;
      sim.lastFlapAt = sim.t;
      sim.events.push({ type: "flap" });
    }
  } else {
    inp.flaps = 0;
  }

  // Gravity + glide: untapped, the bee settles into a slow descent.
  sim.vel.y += F.gravity * dt;
  if (!dying) sim.vel.y = Math.max(sim.vel.y, -F.glideFallSpeed);

  // Forward motion along heading.
  const speedMult = dying ? 0.3 : 1;
  const fwd = F.baseSpeed * speedMult;
  sim.vel.x = Math.sin(sim.heading) * fwd;
  sim.vel.z = Math.cos(sim.heading) * fwd;

  sim.pos.addScaledVector(sim.vel, dt);

  // World bounds: soft walls.
  const b = sim.bounds;
  if (sim.pos.x < -b.halfX) sim.pos.x = -b.halfX;
  if (sim.pos.x > b.halfX) sim.pos.x = b.halfX;
  if (sim.pos.z < 4) sim.pos.z = 4;
  if (sim.pos.z > b.maxZ) sim.pos.z = b.maxZ;

  // Terrain: soft floor — skim/bounce with a small penalty, never fatal.
  const ground = sim.heightAt(sim.pos.x, sim.pos.z) + F.minAltitude;
  if (sim.pos.y < ground) {
    sim.pos.y = ground;
    if (dying) {
      sim.dieT = Math.min(sim.dieT, 0.3);
    } else if (sim.vel.y < 0) {
      sim.vel.y = F.terrainSkimBounce;
      if (sim.skimCooldown <= 0) {
        sim.energy -= F.terrainSkimEnergyCost;
        sim.skimCooldown = F.terrainSkimCooldown;
        sim.events.push({ type: "terrainSkim" });
      }
    }
  }
  const ceiling = sim.heightAt(sim.pos.x, sim.pos.z) + F.maxAltitude;
  if (sim.pos.y > ceiling) {
    sim.pos.y = ceiling;
    sim.vel.y = Math.min(sim.vel.y, 0);
  }

  if (dying) {
    sim.dieT -= dt;
    if (sim.dieT <= 0) sim.mode = "done";
    return;
  }

  // Passive drain: hovering isn't free.
  sim.energy -= F.passiveDrainPerSec * dt;
  if (sim.energy <= 0) {
    sim.energy = 0;
    endFlight(sim, "energy");
    return;
  }

  // Landing: forgiving proximity snap (landingMaxSpeed defaults above cruise).
  const speed = sim.vel.length();
  if (sim.takeoffGrace <= 0 && speed < FL.landingMaxSpeed) {
    const idx = findLandableFlower(sim);
    if (idx >= 0) {
      const f = sim.flowers[idx];
      sim.mode = "perched";
      sim.perchedFlower = idx;
      sim.pos.copy(f.pos);
      sim.vel.set(0, 0, 0);
      sim.steer = 0;
      sim.events.push({ type: "landed", flowerIdx: idx });
      if (!f.pollinated) {
        f.pollinated = true;
        f.dirty = true;
        sim.pollinatedThisRun++;
        sim.events.push({ type: "pollinated", flowerIdx: idx });
      }
    }
  }
}
