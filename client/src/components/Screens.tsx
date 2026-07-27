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
      <h1 className="title">🐝 Pollinator</h1>
      <p className="subtitle">Forage far. Fly home rich.</p>
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
      {progress && progress.bestScores[picked] != null && (
        <p className="subtitle">Best: {Math.round(progress.bestScores[picked])} nectar</p>
      )}
      <button className="btn big" onClick={() => startLevel(picked)}>
        Take flight
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
  const { summary, levelNum, progress, startLevel, toMenu } = useGame();
  if (!summary) return null;
  const nextUnlocked = (progress?.levelsUnlocked ?? 1) > levelNum;
  const title = summary.passed
    ? "🏅 Quota met!"
    : summary.reason === "time"
      ? "🌇 Dusk falls"
      : "😴 Out of energy";
  return (
    <div className="screen">
      <h1 className="title">{title}</h1>
      <div className="summary-grid">
        <div>Nectar</div>
        <div className={summary.passed ? "pass" : "fail"}>
          {summary.score} / {summary.goal}
        </div>
        <div>Pollinated</div>
        <div>{summary.pollinated}</div>
        <div>Best</div>
        <div>{summary.best}</div>
      </div>
      {!summary.passed && (
        <p className="error">
          Collect at least {summary.goal} nectar to complete day {levelNum}.
        </p>
      )}
      {summary.passed && nextUnlocked && (
        <button className="btn big" onClick={() => startLevel(levelNum + 1)}>
          Next day ▶
        </button>
      )}
      <button className="btn" onClick={() => startLevel(levelNum)}>
        {summary.passed ? `Replay day ${levelNum}` : `Try day ${levelNum} again`}
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
        <p>👆 <b>Tap</b> to flap — climb costs energy.</p>
        <p>↔️ Tap <b>left / right</b> of the screen to steer. Hold to keep turning.</p>
        <p>🌸 Fly close to a flower to <b>land</b>. Sipping restores energy and scores nectar — but daylight keeps burning.</p>
        <p>� Follow the light shafts over the horizon to fresh flowers.</p>
        <p className="footnote">(tap to start)</p>
      </div>
    </div>
  );
}
