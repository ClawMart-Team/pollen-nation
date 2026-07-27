import type { LevelResponse, ProgressResponse, LevelCompleteResponse } from "@pollen/shared";

/** Named debug users for the on-page user switcher. Each is an independent
 *  player with their own generated levels and progress. */
export const DEBUG_USERS = ["player-1", "player-2", "player-3", "player-4"];

/** Current user id (persisted). Anonymous, per-device by default; the debug
 *  switcher can point it at any of DEBUG_USERS. */
export function getUserId(): string {
  let id = localStorage.getItem("pollinator_uid");
  if (!id || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    id = DEBUG_USERS[0];
    localStorage.setItem("pollinator_uid", id);
  }
  return id;
}

/** Switch the active user (debug switcher). */
export function setUserId(id: string): void {
  localStorage.setItem("pollinator_uid", id);
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
