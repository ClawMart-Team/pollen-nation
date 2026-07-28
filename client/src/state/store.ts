import { create } from "zustand";
import type { MapData, ProgressResponse } from "@pollen/shared";
import { fetchProgress, getUserId, deleteCurrentUser } from "../lib/api";
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
  /** How the run ended. "home" = made it back to the hive (a win). */
  reason: "time" | "grass" | "home";
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
  /** First-visit cinematic: the camera tracks the bee from the side until it
   *  reaches the first flower, then swings behind for gameplay. */
  intro: boolean;
  /** Menu attract mode: a bee flies a gentle looping fly-by behind the menu. */
  attract: boolean;

  boot(): Promise<void>;
  startLevel(n: number, opts?: { intro?: boolean }): Promise<void>;
  /** Show the menu over a looping background fly-by. */
  startAttract(): void;
  endLevel(): void;
  setHud(h: HudData): void;
  toMenu(): void;
  pause(): void;
  resume(): void;
  beginPlay(): void;
  /** End the first-visit cinematic and hand control to the player. */
  endIntro(): void;
  /** DEBUG: delete this user's server data and start over as a new name. */
  deleteAccount(): Promise<void>;
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
  intro: false,
  attract: false,

  async boot() {
    let progress;
    try {
      progress = await fetchProgress();
    } catch {
      progress = { levelsUnlocked: 1, pollinationTotal: 0, bestScores: {} };
    }
    set({ progress, levelNum: progress.levelsUnlocked });
    // First-ever visit: drop the player straight into their latest day with a
    // cinematic camera intro instead of showing the menu. Later visits see the
    // menu.
    if (!localStorage.getItem("pollinator_seen")) {
      localStorage.setItem("pollinator_seen", "1");
      await get().startLevel(progress.levelsUnlocked, { intro: true });
      return;
    }
    get().startAttract();
  },

  async startLevel(n: number, opts?: { intro?: boolean }) {
    set({ phase: "loading", levelNum: n, error: null, summary: null, paused: false });
    // Small World generates its run entirely on the client — no server fetch.
    const map = generateSmallWorldMap(n);
    const sim = createSim(map);
    resetInput();
    set({
      map,
      sim,
      phase: "playing",
      ready: true,
      attract: false,
      // The bee starts moving immediately; the intro only changes the camera.
      intro: !!opts?.intro,
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
        reason: sim.endReason ?? "time",
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
    // Show the menu over a fresh looping attract fly-by (the world stays
    // visible and alive behind the transparent menu overlay).
    get().startAttract();
  },

  startAttract() {
    const n = get().levelNum || get().progress?.levelsUnlocked || 1;
    const map = generateSmallWorldMap(n);
    const sim = createSim(map);
    resetInput();
    set({
      map,
      sim,
      phase: "menu",
      attract: true,
      intro: false,
      summary: null,
      paused: false,
    });
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

  endIntro() {
    if (!get().intro) return;
    resetInput(); // start the run clean, without any stray queued hop
    set({ intro: false });
  },

  async deleteAccount() {
    await deleteCurrentUser();
    // getUserId() regenerates and persists a fresh two-word name.
    set({
      userId: getUserId(),
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
}));
