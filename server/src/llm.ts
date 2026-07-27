import { MapDataSchema, type MapData } from "@pollen/shared";
import type { DifficultyInputs } from "./difficulty.js";

const SCHEMA_DESCRIPTION = `{
  "levelId": string,
  "seed": integer,
  "theme": { "palette": "#rrggbb", "skyTint": "#rrggbb", "timeOfDayStart": number 0..0.5 },
  "terrain": { "sizeX": number, "sizeZ": number, "ruggedness": number 0.5..20, "noiseScale": number 0.002..0.08 },
  "hive": { "x": number, "z": number },
  "flowers": [ { "id": string, "x": number, "z": number, "species": "daisy"|"tulip"|"bellflower"|"sunflower", "nectar": number 1..100, "size": number 0.5..2.5 } ],
  "difficulty": { "level": integer, "dayLengthSec": number, "energyBudget": number }
}`;

function buildPrompt(d: DifficultyInputs): string {
  return `You are the level designer for "Pollinator", a 3D bee foraging game.
Design level ${d.level} as MAP PARAMETERS AND PLACEMENTS ONLY — never geometry.

World coordinates: x in [-${d.sizeX / 2}, ${d.sizeX / 2}], z in [0, ${d.sizeZ}]. The bee starts at the hive and flies toward +z. Terrain height is derived client-side from seed + ruggedness + noiseScale; all placements are x/z only.

Difficulty inputs you MUST honor:
- terrain: sizeX=${d.sizeX}, sizeZ=${d.sizeZ}, ruggedness≈${d.ruggedness}
- hive near z=24, x=0 (keep |x|<30)
- ~${d.clusterCount} flower clusters totaling 60-200 flowers. Clusters are tight groups (radius 6-14). Place the nearest cluster ≈${d.minClusterDist}m from the hive and spread the rest progressively out to ≈${d.maxClusterDist}m, making FARTHER clusters RICHER (higher nectar). Average nectar per flower ≈${d.nectarPerFlower}.
- difficulty: { "level": ${d.level}, "dayLengthSec": ${d.dayLengthSec}, "energyBudget": ${d.energyBudget} }
- levelId: "level-${d.level}", pick any integer seed.

Choose an evocative theme (palette = terrain base hex, skyTint = sky hex) and give the level character: vary cluster shapes, sizes, and species mixes per cluster.

Respond with ONLY a JSON object matching exactly this schema:
${SCHEMA_DESCRIPTION}`;
}

async function callLLM(prompt: string): Promise<string> {
  const base = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  // Local OpenAI-compatible servers (Ollama, LM Studio, llama.cpp) need no key.
  const key = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data: any = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("LLM returned no content");
  return content;
}

/** LLM generation is enabled by EITHER an API key (hosted) or a custom base
 *  URL (local server such as Ollama — no key required). */
export function llmConfigured(): boolean {
  return Boolean(
    process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.LLM_BASE_URL
  );
}

/**
 * LLM map generation with strict zod validation. On validation failure, retry
 * once with the error fed back; on second failure, throw (caller falls back to
 * the procedural generator).
 */
export async function generateLLMMap(d: DifficultyInputs): Promise<MapData> {
  if (!llmConfigured()) throw new Error("no LLM configured");
  let prompt = buildPrompt(d);
  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callLLM(prompt);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      lastErr = `Response was not valid JSON: ${String(e)}`;
      prompt = `${buildPrompt(d)}\n\nYour previous response failed: ${lastErr}\nReturn corrected JSON only.`;
      continue;
    }
    const result = MapDataSchema.safeParse(parsed);
    if (result.success) return result.data;
    lastErr = JSON.stringify(result.error.issues.slice(0, 8));
    prompt = `${buildPrompt(d)}\n\nYour previous response failed schema validation with these errors: ${lastErr}\nReturn corrected JSON only.`;
  }
  throw new Error(`LLM map failed validation twice: ${lastErr}`);
}
