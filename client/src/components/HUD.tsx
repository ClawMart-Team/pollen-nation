import { useGame } from "../state/store";

/**
 * Small World HUD: just the pause control. The live score total and combo are
 * rendered by ScoreFlow (top-left), and time remaining is shown in-world by the
 * position of the sun, so there is no on-screen timer.
 * Thumb-safe: everything hugs the edges; the lower-left corner stays empty.
 */
export function HUD() {
  const pause = useGame((s) => s.pause);

  return (
    <div className="hud">
      <div className="hud-top">
        <button className="pause-btn" aria-label="Pause" onPointerDown={pause}>
          ❘❘
        </button>
      </div>
    </div>
  );
}
