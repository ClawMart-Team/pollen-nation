import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
fs.mkdirSync(dir, { recursive: true });

export const db = new Database(path.join(dir, "pollen.sqlite"));
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

export const stmts = {
  insertPollination: db.prepare(
    `INSERT OR IGNORE INTO pollinations (user_id, level_id, flower_id, ts) VALUES (?, ?, ?, ?)`
  ),
  pollinationTotal: db.prepare(
    `SELECT COUNT(*) AS n FROM pollinations WHERE user_id = ?`
  ),
  pollinatedForLevel: db.prepare(
    `SELECT flower_id FROM pollinations WHERE user_id = ? AND level_id = ?`
  ),
  insertResult: db.prepare(
    `INSERT INTO level_results (user_id, level_id, level_num, score, nectar, ts) VALUES (?, ?, ?, ?, ?, ?)`
  ),
  bestScores: db.prepare(
    `SELECT level_num, MAX(score) AS best FROM level_results WHERE user_id = ? GROUP BY level_num`
  ),
  maxLevelDone: db.prepare(
    `SELECT MAX(level_num) AS n FROM level_results WHERE user_id = ?`
  ),
  getCachedLevel: db.prepare(`SELECT json FROM level_cache WHERE level_num = ?`),
  putCachedLevel: db.prepare(
    `INSERT OR REPLACE INTO level_cache (level_num, json, source, ts) VALUES (?, ?, ?, ?)`
  ),
};
