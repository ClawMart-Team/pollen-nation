import { useEffect, useState } from "react";
import { useGame } from "../state/store";
import { DEBUG_USERS } from "../lib/api";

export function MenuScreen() {
  const { progress, levelNum, startLevel, error, userId, switchUser } = useGame();
  const unlocked = progress?.levelsUnlocked ?? 1;
  const [picked, setPicked] = useState(levelNum);
  useEffect(() => setPicked(Math.min(levelNum, unlocked)), [levelNum, unlocked]);

  const users = DEBUG_USERS.includes(userId) ? DEBUG_USERS : [userId, ...DEBUG_USERS];

  return (
    <div className="screen">
      <div className="user-switch">
        <label htmlFor="user-select">User</label>
        <select
          id="user-select"
          value={userId}
          onChange={(e) => switchUser(e.target.value)}
        >
          {users.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      <h1 className="title">🐝 Small World</h1>
      <p className="subtitle">Hop the lanes. Chain the blooms.</p>
      {error && <p className="error">{error}</p>}
      <div className="level-picker">
        <button
          className="btn small"
          disabled={picked <= 1}
          onClick={() => setPicked((p) => Math.max(1, p - 1))}
        >
          ◀
        </button>
        <span className="level-label">Day {picked}</span>
        <button
          className="btn small"
          disabled={picked >= unlocked}
          onClick={() => setPicked((p) => Math.min(unlocked, p + 1))}
        >
          ▶
        </button>
      </div>
      <p className="subtitle">Best: {Number(localStorage.getItem("smallworld_best_score") ?? 0).toLocaleString()}</p>
      <button className="btn big" onClick={() => startLevel(picked)}>
        Start run
      </button>
      {progress && (
        <p className="footnote">🌸 {progress.pollinationTotal} flowers pollinated all-time</p>
      )}
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="screen">
      <div className="title">🐝</div>
      <p className="subtitle">Scouting the meadow…</p>
    </div>
  );
}

export function SummaryScreen() {
  const { summary, levelNum, startLevel, toMenu } = useGame();
  if (!summary) return null;
  const newBest = summary.score >= summary.best && summary.score > 0;
  return (
    <div className="screen">
      <h1 className="title">🌇 Dusk falls</h1>
      <div className="summary-grid">
        <div>Score</div>
        <div className="pass">{summary.score.toLocaleString()}</div>
        <div>Best combo</div>
        <div>×{summary.bestCombo}</div>
        <div>Best</div>
        <div>{summary.best.toLocaleString()}</div>
      </div>
      {newBest && <p className="subtitle">🏅 New high score!</p>}
      <button className="btn big" onClick={() => startLevel(levelNum + 1)}>
        Next day ▶
      </button>
      <button className="btn" onClick={() => startLevel(levelNum)}>
        Replay day {levelNum}
      </button>
      <button className="btn" onClick={toMenu}>
        Hive menu
      </button>
    </div>
  );
}

/** Pause overlay: freezes the sim (GameLoop skips stepping while paused). */
export function PauseScreen() {
  const resume = useGame((s) => s.resume);
  const toMenu = useGame((s) => s.toMenu);
  return (
    <div className="screen pause-screen">
      <h1 className="title">⏸️ Resting</h1>
      <p className="subtitle">The meadow waits. Daylight is on hold.</p>
      <button className="btn big" onClick={resume}>
        Keep flying
      </button>
      <button className="btn" onClick={toMenu}>
        Hive menu
      </button>
    </div>
  );
}

/** First-run tutorial overlay; dismissed once, remembered in localStorage. */
export function TutorialOverlay() {
  const [seen, setSeen] = useState(() => localStorage.getItem("pollinator_tut") === "1");
  const beginPlay = useGame((s) => s.beginPlay);
  if (seen) return null;
  return (
    <div
      className="tutorial"
      onPointerDown={() => {
        localStorage.setItem("pollinator_tut", "1");
        setSeen(true);
        beginPlay(); // release the frozen bee now that the controls were read
      }}
    >
      <div className="tutorial-card">
        <h2>How to bee</h2>
        <p>� The world turns toward you — the bee flies forward on its own.</p>
        <p>👈 Tap the <b>left</b> side to hop one lane left.</p>
        <p>👉 Tap the <b>right</b> side to hop one lane right.</p>
        <p>🌸 Land on the <b>same flower type</b> in a row to build a <b>combo</b> and score big.</p>
        <p className="footnote">(tap to start)</p>
      </div>
    </div>
  );
}
