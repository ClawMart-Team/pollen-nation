import type { LevelResponse, ProgressResponse, LevelCompleteResponse } from "@pollen/shared";

const ADJECTIVES = [
  "gentle", "sunny", "brave", "clever", "merry", "swift", "cozy", "witty",
  "dapper", "bubbly", "plucky", "jolly", "nimble", "fuzzy", "chirpy", "breezy",
  "golden", "spry", "cheeky", "snug", "dandy", "peppy", "zippy", "mellow",
];
const ANIMALS = [
  "otter", "sparrow", "hedgehog", "badger", "robin", "fox", "newt", "finch",
  "vole", "marten", "wren", "beetle", "dragonfly", "moth", "firefly", "cricket",
  "hare", "dormouse", "swift", "lark", "puffin", "shrew", "weasel", "quail",
];

/** Legacy debug ids the old on-page switcher assigned. Regenerated on sight. */
const LEGACY_ID = /^player-\d+$/;
const VALID_ID = /^[A-Za-z0-9_-]{4,64}$/;

function generateName(): string {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${a}-${b}`;
}

/** Current user id (persisted). Anonymous and per-device: a two-word name is
 *  generated on first run and kept thereafter. Legacy "player-N" ids are
 *  migrated to a fresh generated name. */
export function getUserId(): string {
  let id = localStorage.getItem("pollinator_uid");
  if (!id || !VALID_ID.test(id) || LEGACY_ID.test(id)) {
    id = generateName();
    localStorage.setItem("pollinator_uid", id);
  }
  return id;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function fetchLevel(n: number): Promise<LevelResponse> {
  return json(await fetch(`/api/level/${n}?userId=${encodeURIComponent(getUserId())}`));
}

export async function fetchProgress(): Promise<ProgressResponse> {
  return json(await fetch(`/api/progress?userId=${encodeURIComponent(getUserId())}`));
}

/** Fire-and-forget, idempotent. Pollination must survive reloads/replays. */
export function postPollinate(levelId: string, flowerId: string): void {
  fetch("/api/pollinate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId: getUserId(), levelId, flowerId }),
  }).catch(() => {});
}

export async function postLevelComplete(
  levelId: string,
  levelNum: number,
  score: number,
  nectar: number
): Promise<LevelCompleteResponse | null> {
  try {
    const res = await fetch("/api/level-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: getUserId(), levelId, levelNum, score, nectar }),
    });
    return await json<LevelCompleteResponse>(res);
  } catch {
    return null;
  }
}

/** DEBUG: delete the current user's data on the server, then forget the local
 *  identity so a fresh name is generated on next load. */
export async function deleteCurrentUser(): Promise<void> {
  const userId = getUserId();
  try {
    await fetch("/api/user/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  } catch {
    // Best-effort: still clear the local identity below.
  }
  localStorage.removeItem("pollinator_uid");
  localStorage.removeItem("smallworld_best_score");
}
