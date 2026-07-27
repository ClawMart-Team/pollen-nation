import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// The subset of prepared-statement shapes the API relies on. Both the SQLite
// and the in-memory backends implement this identical surface.
export interface Stmts {
  insertPollination: { run(userId: string, levelId: string, flowerId: string, ts: number): void };
  pollinationTotal: { get(userId: string): { n: number } };
  pollinatedForLevel: { all(userId: string, levelId: string): { flower_id: string }[] };
  insertResult: {
    run(userId: string, levelId: string, levelNum: number, score: number, nectar: number, ts: number): void;
  };
  bestScores: { all(userId: string): { level_num: number; best: number }[] };
  maxLevelDone: { get(userId: string): { n: number | null } };
  getCachedLevel: { get(levelNum: number): { json: string } | undefined };
  putCachedLevel: { run(levelNum: number, json: string, source: string, ts: number): void };
}

// In-memory backend used on serverless (Vercel). The filesystem there is
// read-only apart from an ephemeral /tmp, so SQLite would buy no real
// persistence anyway — state already resets on cold starts. Avoiding the
// native better-sqlite3 binding here keeps the function from crashing on load.
function memoryStmts(): Stmts {
  const SEP = "\u0000";
  const pollinations = new Set<string>();
  const results: { userId: string; levelNum: number; score: number }[] = [];
  const cache = new Map<number, string>();
  return {
    insertPollination: {
      run(userId, levelId, flowerId) {
        pollinations.add(`${userId}${SEP}${levelId}${SEP}${flowerId}`);
      },
    },
    pollinationTotal: {
      get(userId) {
        const pre = `${userId}${SEP}`;
        let n = 0;
        for (const k of pollinations) if (k.startsWith(pre)) n++;
        return { n };
      },
    },
    pollinatedForLevel: {
      all(userId, levelId) {
        const pre = `${userId}${SEP}${levelId}${SEP}`;
        const out: { flower_id: string }[] = [];
        for (const k of pollinations) if (k.startsWith(pre)) out.push({ flower_id: k.slice(pre.length) });
        return out;
      },
    },
    insertResult: {
      run(userId, _levelId, levelNum, score) {
        results.push({ userId, levelNum, score });
      },
    },
    bestScores: {
      all(userId) {
        const best = new Map<number, number>();
        for (const r of results) {
          if (r.userId !== userId) continue;
          best.set(r.levelNum, Math.max(best.get(r.levelNum) ?? -Infinity, r.score));
        }
        return [...best].map(([level_num, best]) => ({ level_num, best }));
      },
    },
    maxLevelDone: {
      get(userId) {
        let n: number | null = null;
        for (const r of results) if (r.userId === userId) n = Math.max(n ?? 0, r.levelNum);
        return { n };
      },
    },
    getCachedLevel: {
      get(levelNum) {
        const json = cache.get(levelNum);
        return json === undefined ? undefined : { json };
      },
    },
    putCachedLevel: {
      run(levelNum, json) {
        cache.set(levelNum, json);
      },
    },
  };
}

// SQLite backend for local/long-lived runs. better-sqlite3 is required lazily
// via createRequire so the native binding is only loaded off serverless.
function sqliteStmts(): Stmts {
  const require = createRequire(import.meta.url);
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "pollen.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
CREATE TABLE IF NOT EXISTS pollinations (
  user_id   TEXT NOT NULL,
  level_id  TEXT NOT NULL,
  flower_id TEXT NOT NULL,
  ts        INTEGER NOT NULL,
  PRIMARY KEY (user_id, level_id, flower_id)
);
CREATE TABLE IF NOT EXISTS level_results (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL,
  level_id  TEXT NOT NULL,
  level_num INTEGER NOT NULL,
  score     REAL NOT NULL,
  nectar    REAL NOT NULL,
  ts        INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_results_user ON level_results(user_id, level_num);
CREATE TABLE IF NOT EXISTS level_cache (
  level_num INTEGER PRIMARY KEY,
  json      TEXT NOT NULL,
  source    TEXT NOT NULL,
  ts        INTEGER NOT NULL
);
`);
  return {
    insertPollination: db.prepare(
      `INSERT OR IGNORE INTO pollinations (user_id, level_id, flower_id, ts) VALUES (?, ?, ?, ?)`
    ),
    pollinationTotal: db.prepare(`SELECT COUNT(*) AS n FROM pollinations WHERE user_id = ?`),
    pollinatedForLevel: db.prepare(
      `SELECT flower_id FROM pollinations WHERE user_id = ? AND level_id = ?`
    ),
    insertResult: db.prepare(
      `INSERT INTO level_results (user_id, level_id, level_num, score, nectar, ts) VALUES (?, ?, ?, ?, ?, ?)`
    ),
    bestScores: db.prepare(
      `SELECT level_num, MAX(score) AS best FROM level_results WHERE user_id = ? GROUP BY level_num`
    ),
    maxLevelDone: db.prepare(`SELECT MAX(level_num) AS n FROM level_results WHERE user_id = ?`),
    getCachedLevel: db.prepare(`SELECT json FROM level_cache WHERE level_num = ?`),
    putCachedLevel: db.prepare(
      `INSERT OR REPLACE INTO level_cache (level_num, json, source, ts) VALUES (?, ?, ?, ?)`
    ),
  } as unknown as Stmts;
}

export const stmts: Stmts = process.env.VERCEL ? memoryStmts() : sqliteStmts();
