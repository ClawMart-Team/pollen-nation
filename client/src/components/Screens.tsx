import { useEffect, useState } from "react";
import { useGame } from "../state/store";

export function MenuScreen() {
  const { progress, levelNum, startLevel, error } = useGame();
  const unlocked = progress?.levelsUnlocked ?? 1;
  const [picked, setPicked] = useState(levelNum);
  useEffect(() => setPicked(Math.min(levelNum, unlocked)), [levelNum, unlocked]);

  return (
    <div className="screen">
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
  return (
    <div className="screen">
      <h1 className="title">{summary.reason === "time" ? "🌇 Dusk falls" : "😴 Out of energy"}</h1>
      <div className="summary-grid">
        <div>Nectar</div>
        <div>{summary.score}</div>
        <div>Pollinated</div>
        <div>{summary.pollinated}</div>
        <div>Best</div>
        <div>{summary.best}</div>
      </div>
      {nextUnlocked && (
        <button className="btn big" onClick={() => startLevel(levelNum + 1)}>
          Next day ▶
        </button>
      )}
      <button className="btn" onClick={() => startLevel(levelNum)}>
        Replay day {levelNum}
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
  if (seen) return null;
  return (
    <div
      className="tutorial"
      onPointerDown={() => {
        localStorage.setItem("pollinator_tut", "1");
        setSeen(true);
      }}
    >
      <div className="tutorial-card">
        <h2>How to bee</h2>
        <p>👆 <b>Tap</b> to flap — climb costs energy.</p>
        <p>↔️ Tap <b>left / right</b> of the screen to steer. Hold to keep turning.</p>
        <p>🌸 Fly close to a flower to <b>land</b>. Sipping restores energy and scores nectar — but daylight keeps burning.</p>
        <p>🌿 Avoid branches and leaves. Follow the light shafts to fresh flowers.</p>
        <p className="footnote">(tap to start)</p>
      </div>
    </div>
  );
}
