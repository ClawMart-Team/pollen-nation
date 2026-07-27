import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nectarGoalForLevel, type LevelResponse, type ProgressResponse } from "@pollen/shared";
import { stmts } from "./db";
import { getLevel, prefetch } from "./levels";

const app = express();
app.use(express.json());

// Lightweight health check so the deployed function can be verified directly
// (e.g. GET /api/health) independent of level generation.
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, serverless: !!process.env.VERCEL });
});

const asUserId = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return /^[A-Za-z0-9_-]{4,64}$/.test(s) ? s : null;
};

function progressFor(userId: string): ProgressResponse {
  const total = (stmts.pollinationTotal.get(userId) as { n: number }).n;
  const maxDone = (stmts.maxLevelDone.get(userId) as { n: number | null }).n ?? 0;
  const rows = stmts.bestScores.all(userId) as { level_num: number; best: number }[];
  const bestScores: Record<number, number> = {};
  for (const r of rows) bestScores[r.level_num] = r.best;
  return { levelsUnlocked: maxDone + 1, pollinationTotal: total, bestScores };
}

// GET /api/level/:n?userId=... — validated MapData generated & cached per
// user (each player gets their own levels), plus this user's pollination
// records for the level (pollination survives reloads and replays).
app.get("/api/level/:n", async (req, res) => {
  const n = parseInt(req.params.n, 10);
  if (!Number.isFinite(n) || n < 1 || n > 9999) return res.status(400).json({ error: "bad level" });
  const userId = asUserId(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId required" });
  try {
    const map = await getLevel(userId, n);
    prefetch(userId, n + 1); // background-generate the next level for instant transitions
    const pollinatedFlowerIds = (
      stmts.pollinatedForLevel.all(userId, map.levelId) as { flower_id: string }[]
    ).map((r) => r.flower_id);
    const body: LevelResponse = { map, pollinatedFlowerIds };
    res.json(body);
  } catch (e) {
    console.error("[api] level failed:", e);
    res.status(500).json({ error: "level generation failed" });
  }
});

// POST /api/pollinate — idempotent record of {userId, levelId, flowerId}.
app.post("/api/pollinate", (req, res) => {
  const userId = asUserId(req.body?.userId);
  const { levelId, flowerId } = req.body ?? {};
  if (!userId || typeof levelId !== "string" || typeof flowerId !== "string") {
    return res.status(400).json({ error: "userId, levelId, flowerId required" });
  }
  stmts.insertPollination.run(userId, levelId.slice(0, 64), flowerId.slice(0, 64), Date.now());
  const total = (stmts.pollinationTotal.get(userId) as { n: number }).n;
  res.json({ ok: true, pollinationTotal: total });
});

// GET /api/progress?userId= — levels unlocked, cumulative pollination, bests.
app.get("/api/progress", (req, res) => {
  const userId = asUserId(req.query.userId);
  if (!userId) return res.status(400).json({ error: "userId required" });
  res.json(progressFor(userId));
});

// POST /api/level-complete — a run only counts if it met the level's nectar
// quota (authoritative here); only then is the result recorded and the next
// level unlocked. Returns pass/fail, the quota, and fresh progress.
app.post("/api/level-complete", (req, res) => {
  const userId = asUserId(req.body?.userId);
  const { levelId, levelNum, score, nectar } = req.body ?? {};
  if (
    !userId || typeof levelId !== "string" ||
    !Number.isFinite(levelNum) || !Number.isFinite(score) || !Number.isFinite(nectar)
  ) {
    return res.status(400).json({ error: "userId, levelId, levelNum, score, nectar required" });
  }
  const lvl = Math.floor(levelNum);
  const nectarGoal = nectarGoalForLevel(lvl);
  const passed = score >= nectarGoal;
  if (passed) {
    stmts.insertResult.run(userId, levelId.slice(0, 64), lvl, score, nectar, Date.now());
  }
  res.json({ ok: true, passed, nectarGoal, progress: progressFor(userId) });
});

// Serve the built client only when running as a normal long-lived process
// (local `npm start`). On Vercel the static build is served by the CDN and
// only /api/* reaches this function, so we must NOT touch import.meta.url /
// the filesystem at module load there (it can throw and crash the function).
if (!process.env.VERCEL) {
  const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "client", "dist");
  app.use(express.static(clientDist));
  const port = Number(process.env.PORT) || 3001;
  app.listen(port, () => console.log(`Pollinator server on http://localhost:${port}`));
}

export default app;
