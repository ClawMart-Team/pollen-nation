import { z } from "zod";

/** Flower species. Visuals are defined client-side in config.ts (SPECIES). */
export const SPECIES_IDS = ["daisy", "tulip", "bellflower", "sunflower"] as const;
export type SpeciesId = (typeof SPECIES_IDS)[number];

export const ThemeSchema = z.object({
  /** Base terrain color as a hex string, e.g. "#5da24a". */
  palette: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Sky / fog base color as a hex string. */
  skyTint: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** 0..1 fraction of the day at which the level starts (0 = sunrise). */
  timeOfDayStart: z.number().min(0).max(0.5),
});

export const TerrainSchema = z.object({
  sizeX: z.number().min(120).max(1200),
  sizeZ: z.number().min(200).max(2000),
  /** Vertical amplitude of the heightmap in metres. */
  ruggedness: z.number().min(0.5).max(20),
  /** Spatial frequency of the primary noise octave. */
  noiseScale: z.number().min(0.002).max(0.08),
});

export const FlowerSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  z: z.number(),
  species: z.enum(SPECIES_IDS),
  /** Total nectar reserve of this flower (score units). */
  nectar: z.number().min(1).max(100),
  /** Visual + landing size multiplier. */
  size: z.number().min(0.5).max(2.5),
});

export const DifficultySchema = z.object({
  level: z.number().int().min(1),
  dayLengthSec: z.number().min(30).max(600),
  energyBudget: z.number().min(5).max(500),
});

export const MapDataSchema = z.object({
  levelId: z.string().min(1),
  seed: z.number().int(),
  theme: ThemeSchema,
  terrain: TerrainSchema,
  hive: z.object({ x: z.number(), z: z.number() }),
  flowers: z.array(FlowerSchema).min(1).max(1000),
  difficulty: DifficultySchema,
});

export type Theme = z.infer<typeof ThemeSchema>;
export type TerrainParams = z.infer<typeof TerrainSchema>;
export type FlowerDef = z.infer<typeof FlowerSchema>;
export type Difficulty = z.infer<typeof DifficultySchema>;
export type MapData = z.infer<typeof MapDataSchema>;

/** Response of GET /api/level/:n */
export interface LevelResponse {
  map: MapData;
  /** Flower ids this user has already pollinated on this level (survives reloads). */
  pollinatedFlowerIds: string[];
}

/** Response of GET /api/progress */
export interface ProgressResponse {
  levelsUnlocked: number;
  pollinationTotal: number;
  bestScores: Record<number, number>;
}
