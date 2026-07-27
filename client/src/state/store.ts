import { create } from "zustand";
import type { MapData, ProgressResponse } from "@pollen/shared";
import { fetchLevel, fetchProgress, postLevelComplete } from "../lib/api";
import { createSim, type Sim } from "../game/sim";
import { resetInput } from "../game/input";

export type Phase = "boot" | "menu" | "loading" | "playing" | "summary";

/** Throttled HUD snapshot — the only per-frame data that touches React. */
export interface HudData {
  energy: number;
  energyMax: number;
  timeLeft: number;
  dayFrac: number;
  nectar: number;
  pollinatedSession: number;
  petals: { x: number; y: number; angle: number; strength: number }[];
}

export interface Summary {
  reason: "time" | "energy";
  score: number;
  pollinated: number;
  best: number;
}

interface GameStore {
  phase: Phase;
  levelNum: number;
  map: MapData | null;
  sim: Sim | null;
  hud: HudData;
  progress: ProgressResponse | null;
  summary: Summary | null;
  error: string | null;
  paused: boolean;

  boot(): Promise<void>;
  startLevel(n: number): Promise<void>;
  endLevel(reason: "time" | "energy"): void;
  setHud(h: HudData): void;
  toMenu(): void;
  bumpPollinationTotal(): void;
  pause(): void;
  resume(): void;
}

const emptyHud: HudData = {
  energy: 0,
  energyMax: 1,
  timeLeft: 0,
  dayFrac: 0,
  nectar: 0,
  pollinatedSession: 0,
  petals: [],
};

export const useGame = create<GameStore>((set, get) => ({
  phase: "boot",
  levelNum: 1,
  map: null,
  sim: null,
  hud: emptyHud,
  progress: null,
  summary: null,
  error: null,
  paused: false,

  async boot() {
    try {
      const progress = await fetchProgress();
      set({ progress, levelNum: progress.levelsUnlocked, phase: "menu" });
    } catch {
      set({ progress: { levelsUnlocked: 1, pollinationTotal: 0, bestScores: {} }, phase: "menu" });
    }
  },

  async startLevel(n: number) {
    set({ phase: "loading", levelNum: n, error: null, summary: null, paused: false });
    try {
      const { map, pollinatedFlowerIds } = await fetchLevel(n);
      const sim = createSim(map, pollinatedFlowerIds);
      resetInput();
      set({
        map,
        sim,
        phase: "playing",
        hud: {
          ...emptyHud,
          energy: sim.energy,
          energyMax: sim.energyMax,
          timeLeft: sim.timeLeft,
        },
      });
    } catch (e) {
      set({ phase: "menu", error: "Couldn't load the level. Is the server running?" });
    }
  },

  endLevel(reason) {
    const { sim, map, levelNum, progress } = get();
    if (!sim || !map) return;
    const score = Math.round(sim.nectar);
    const prevBest = progress?.bestScores?.[levelNum] ?? 0;
    set({
      phase: "summary",
      summary: { reason, score, pollinated: sim.pollinatedThisRun, best: Math.max(prevBest, score) },
    });
    postLevelComplete(map.levelId, levelNum, score, sim.nectar).then((p) => {
      if (p) set({ progress: p });
    });
  },

  setHud(hud) {
    set({ hud });
  },

  toMenu() {
    // Keep sim/map so the frozen world stays visible behind the menu.
    set({ phase: "menu", summary: null, paused: false });
  },

  pause() {
    if (get().phase === "playing") set({ paused: true });
  },

  resume() {
    resetInput(); // drop any taps/steering queued while the overlay was up
    set({ paused: false });
  },

  bumpPollinationTotal() {
    const p = get().progress;
    if (p) set({ progress: { ...p, pollinationTotal: p.pollinationTotal + 1 } });
  },
}));
