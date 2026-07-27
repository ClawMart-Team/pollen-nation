import { MapDataSchema, type MapData } from "@pollen/shared";
import { stmts } from "./db.js";
import { computeDifficulty } from "./difficulty.js";
import { generateProceduralMap } from "./procedural.js";
import { generateLLMMap } from "./llm.js";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Post-validation sanity constraints (spec §10): repair what we can, so the
 * client always receives a playable map regardless of the generator.
 */
export function sanitize(map: MapData): MapData {
  const { sizeX, sizeZ } = map.terrain;
  const halfX = sizeX / 2 - 10;

  // Hive within bounds, near the z=0 edge.
  map.hive.x = clamp(map.hive.x, -60, 60);
  map.hive.z = clamp(map.hive.z, 10, sizeZ * 0.2);

  // Clamp all placements into terrain bounds.
  for (const f of map.flowers) {
    f.x = clamp(f.x, -halfX, halfX);
    f.z = clamp(f.z, 8, sizeZ - 8);
  }
  for (const o of map.obstacles) {
    o.x = clamp(o.x, -halfX, halfX);
    o.z = clamp(o.z, 8, sizeZ - 8);
  }

  // No obstacles near the hive or inside its +z launch corridor.
  const hx = map.hive.x, hz = map.hive.z;
  map.obstacles = map.obstacles.filter((o) => {
    const d2 = (o.x - hx) ** 2 + (o.z - hz) ** 2;
    if (d2 < 25 * 25) return false;
    const inCorridor = Math.abs(o.x - hx) < 7 && o.z > hz && o.z < hz + 40;
    return !inCorridor;
  });

  // Deduplicate ids.
  const seen = new Set<string>();
  for (const f of map.flowers) while (seen.has(f.id)) f.id += "x";
  map.flowers.forEach((f) => seen.add(f.id));

  // Minimum flower count: top up from the procedural generator if the LLM was
  // stingy, so a level is always completable.
  if (map.flowers.length < 40) {
    const filler = generateProceduralMap(computeDifficulty(map.difficulty.level));
    for (const f of filler.flowers) {
      if (map.flowers.length >= 60) break;
      map.flowers.push({ ...f, id: `pf_${f.id}` });
    }
  }
  return map;
}

const inflight = new Map<number, Promise<MapData>>();

async function generate(levelNum: number): Promise<MapData> {
  const d = computeDifficulty(levelNum);
  let map: MapData;
  let source = "llm";
  try {
    map = await generateLLMMap(d);
  } catch (err) {
    // Fallback: deterministic procedural generator emitting the same schema.
    if (process.env.OPENAI_API_KEY) {
      console.warn(`[levels] LLM generation failed for level ${levelNum}, using procedural:`, err);
    }
    map = generateProceduralMap(d);
    source = "procedural";
  }
  map.levelId = `level-${levelNum}`; // canonical, used as the pollination key
  map.difficulty.level = levelNum;
  map = sanitize(MapDataSchema.parse(map));
  stmts.putCachedLevel.run(levelNum, JSON.stringify(map), source, Date.now());
  return map;
}

/** Get a level, cached by level number: a replayed level is stable. */
export async function getLevel(levelNum: number): Promise<MapData> {
  const cached = stmts.getCachedLevel.get(levelNum) as { json: string } | undefined;
  if (cached) return JSON.parse(cached.json) as MapData;
  let p = inflight.get(levelNum);
  if (!p) {
    p = generate(levelNum).finally(() => inflight.delete(levelNum));
    inflight.set(levelNum, p);
  }
  return p;
}

/** Fire-and-forget background prefetch of level N+1 while N is played. */
export function prefetch(levelNum: number): void {
  const cached = stmts.getCachedLevel.get(levelNum) as { json: string } | undefined;
  if (cached || inflight.has(levelNum)) return;
  getLevel(levelNum).catch((e) => console.warn(`[levels] prefetch ${levelNum} failed:`, e));
}
