import { MapDataSchema, type MapData } from "@pollen/shared";
import { stmts } from "./db";
import { computeDifficulty } from "./difficulty";
import { generateProceduralMap } from "./procedural";
import { generateLLMMap, llmConfigured } from "./llm";

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

const inflight = new Map<string, Promise<MapData>>();

/** FNV-1a hash of the user id, used as a per-player seed salt so each player
 *  gets their own layout for a given level. */
function userSalt(userId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

async function generate(userId: string, levelNum: number): Promise<MapData> {
  const d = computeDifficulty(levelNum);
  const salt = userSalt(userId);
  let map: MapData;
  let source = "llm";
  try {
    map = await generateLLMMap(d, salt);
  } catch (err) {
    // Fallback: deterministic procedural generator emitting the same schema.
    if (llmConfigured()) {
      console.warn(`[levels] LLM generation failed for level ${levelNum}, using procedural:`, err);
    }
    map = generateProceduralMap(d, salt);
    source = "procedural";
  }
  map.levelId = `level-${levelNum}`; // canonical, used as the pollination key
  map.difficulty.level = levelNum;
  map = sanitize(MapDataSchema.parse(map));
  stmts.putCachedLevel.run(userId, levelNum, JSON.stringify(map), source, Date.now());
  return map;
}

/** Get a level for a user, cached per (user, level): a replayed level is
 *  stable, and different players get different levels at the same number. */
export async function getLevel(userId: string, levelNum: number): Promise<MapData> {
  const cached = stmts.getCachedLevel.get(userId, levelNum) as { json: string } | undefined;
  if (cached) return JSON.parse(cached.json) as MapData;
  const key = `${userId}\u0000${levelNum}`;
  let p = inflight.get(key);
  if (!p) {
    p = generate(userId, levelNum).finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Fire-and-forget background prefetch of level N+1 while N is played. */
export function prefetch(userId: string, levelNum: number): void {
  const cached = stmts.getCachedLevel.get(userId, levelNum) as { json: string } | undefined;
  if (cached || inflight.has(`${userId}\u0000${levelNum}`)) return;
  getLevel(userId, levelNum).catch((e) => console.warn(`[levels] prefetch ${levelNum} failed:`, e));
}
