import type { LevelResponse, ProgressResponse } from "@pollen/shared";

/** Anonymous per-device user id (v1). */
export function getUserId(): string {
  let id = localStorage.getItem("pollinator_uid");
  if (!id) {
    id = "u_" + crypto.randomUUID().replace(/-/g, "").slice(0, 20);
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
): Promise<ProgressResponse | null> {
  try {
    const res = await fetch("/api/level-complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: getUserId(), levelId, levelNum, score, nectar }),
    });
    const data = await json<{ progress: ProgressResponse }>(res);
    return data.progress;
  } catch {
    return null;
  }
}
