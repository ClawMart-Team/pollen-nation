import { create } from "zustand";
import type { MapData, ProgressResponse } from "@pollen/shared";
import { fetchProgress, getUserId, setUserId } from "../lib/api";
import { createSim, type Sim } from "../game/sim";
import { generateSmallWorldMap } from "../game/smallworld";
import { resetInput } from "../game/input";

export type Phase = "boot" | "menu" | "loading" | "playing" | "summary";

/** Throttled HUD snapshot — the only per-frame data that touches React. */
export interface HudData {
  score: number;
  combo: number;
  bestCombo: number;
  timeLeft: number;
  dayFrac: number;
}

export interface Summary {
  score: number;
  /** Longest same-type chain reached this run. */
  bestCombo: number;
  /** Best score ever (persisted locally). */
  best: number;
}

const BEST_KEY = "smallworld_best_score";

interface GameStore {
  phase: Phase;
  userId: string;
  levelNum: number;
  map: MapData | null;
  sim: Sim | null;
  hud: HudData;
  progress: ProgressResponse | null;
  summary: Summary | null;
  error: string | null;
  paused: boolean;
  /** Sim advances only once the player is ready (tutorial dismissed). */
  ready: boolean;

  boot(): Promise<void>;
  switchUser(id: string): Promise<void>;
  startLevel(n: number): Promise<void>;
  endLevel(): void;
  setHud(h: HudData): void;
  toMenu(): void;
  pause(): void;
  resume(): void;
  beginPlay(): void;
}

const emptyHud: HudData = {
  score: 0,
  combo: 0,
  bestCombo: 0,
  timeLeft: 0,
  dayFrac: 0,
};

export const useGame = create<GameStore>((set, get) => ({
  phase: "boot",
  userId: getUserId(),
  levelNum: 1,
  map: null,
  sim: null,
  hud: emptyHud,
  progress: null,
  summary: null,
  error: null,
  paused: false,
  ready: true,

  async boot() {
    try {
      const progress = await fetchProgress();
      set({ progress, levelNum: progress.levelsUnlocked, phase: "menu" });
    } catch {
      set({ progress: { levelsUnlocked: 1, pollinationTotal: 0, bestScores: {} }, phase: "menu" });
    }
  },

  // Debug: become a different user. Each user has their own generated levels
  // and progress, so a brand-new user starts back at day 1.
  async switchUser(id: string) {
    setUserId(id);
    set({
      userId: id,
      phase: "boot",
      map: null,
      sim: null,
      summary: null,
      error: null,
      paused: false,
      progress: null,
    });
    await get().boot();
  },

  async startLevel(n: number) {
    set({ phase: "loading", levelNum: n, error: null, summary: null, paused: false });
    // Small World generates its run entirely on the client — no server fetch.
    const map = generateSmallWorldMap(n);
    const sim = createSim(map);
    resetInput();
    // New players read the controls first: the tutorial overlay freezes the
    // sim until dismissed. Returning players (tutorial seen) start moving now.
    const ready = localStorage.getItem("pollinator_tut") === "1";
    set({
      map,
      sim,
      phase: "playing",
      ready,
      hud: {
        ...emptyHud,
        timeLeft: sim.timeLeft,
      },
    });
  },

  endLevel() {
    const { sim } = get();
    if (!sim) return;
    const prevBest = Number(localStorage.getItem(BEST_KEY) ?? 0);
    const best = Math.max(prevBest, sim.score);
    localStorage.setItem(BEST_KEY, String(best));
    set({
      phase: "summary",
      summary: {
        score: sim.score,
        bestCombo: sim.bestCombo,
        best,
      },
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
    resetInput(); // drop any taps queued while the overlay was up
    set({ paused: false });
  },

  beginPlay() {
    resetInput(); // don't let the dismissing tap trigger a hop
    set({ ready: true });
  },
}));
