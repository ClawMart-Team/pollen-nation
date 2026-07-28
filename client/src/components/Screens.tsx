import { useState } from "react";
import { useGame } from "../state/store";

/** Persistent top-right identity: the player's name with their current day
 *  just beneath it. Stays visible across the menu, gameplay and summary.
 *  Clicking the name is a debug shortcut to wipe this user's data. */
export function PlayerBadge() {
  const userId = useGame((s) => s.userId);
  const levelNum = useGame((s) => s.levelNum);
  const unlocked = useGame((s) => s.progress?.levelsUnlocked ?? 1);
  const deleteAccount = useGame((s) => s.deleteAccount);
  const day = Math.min(levelNum, unlocked);

  const onDeleteAccount = () => {
    if (window.confirm(`Delete all data for "${userId}"? This can't be undone.`)) {
      void deleteAccount();
    }
  };

  return (
    <div className="player-badge">
      <button
        className="user-badge"
        onClick={onDeleteAccount}
        title="Debug: delete this user's data and start over"
      >
        {userId}
      </button>
      <span className="day-badge">Day {day}</span>
    </div>
  );
}

export function MenuScreen() {
  const { progress, levelNum, startLevel } = useGame();
  const unlocked = progress?.levelsUnlocked ?? 1;
  const day = Math.min(levelNum, unlocked);

  return (
    <div className="screen">
      <button className="btn big" onClick={() => startLevel(day)}>
        Play to win
      </button>
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
  const { summary, levelNum, startLevel } = useGame();
  if (!summary) return null;
  // Reaching the hive ("home") means the level was completed; otherwise the run
  // ended early (dusk or a crash) and the player retries the same level.
  const completed = summary.reason === "home";
  return (
    <div className="screen">
      {completed ? (
        <button className="btn big" onClick={() => startLevel(levelNum + 1)}>
          Next level
        </button>
      ) : (
        <button className="btn big" onClick={() => startLevel(levelNum)}>
          Play again
        </button>
      )}
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
