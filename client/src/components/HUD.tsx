import { useGame } from "../state/store";

/** Sun-arc day timer: an SVG semicircle with the sun dot riding along it. */
function SunArc({ dayFrac }: { dayFrac: number }) {
  const ang = Math.PI * (1 - dayFrac);
  const cx = 40 + 32 * Math.cos(ang);
  const cy = 38 - 30 * Math.sin(ang);
  return (
    <svg width="80" height="44" viewBox="0 0 80 44" className="sun-arc">
      <path d="M 8 38 A 32 32 0 0 1 72 38" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2" strokeDasharray="3 4" />
      <line x1="4" y1="38" x2="76" y2="38" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r="5" fill={dayFrac > 0.65 ? "#ff9a3d" : "#ffd94d"} />
    </svg>
  );
}

/**
 * Small World HUD: score (big), the live combo multiplier, and the sun-arc day
 * timer. Thumb-safe: everything hugs the top; lower corners stay empty.
 */
export function HUD() {
  const hud = useGame((s) => s.hud);
  const levelNum = useGame((s) => s.levelNum);
  const pause = useGame((s) => s.pause);

  const t = Math.max(0, hud.timeLeft);
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60).toString().padStart(2, "0");

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <div className="hud-level">Day {levelNum}</div>
          <div className="hud-score" key={hud.score}>
            {hud.score.toLocaleString()}
          </div>
          {hud.combo > 1 && (
            <div className="hud-combo" key={hud.combo}>
              ×{hud.combo}
            </div>
          )}
        </div>
        <div className="hud-mid">
          <SunArc dayFrac={hud.dayFrac} />
          <div className="hud-time">{mm}:{ss}</div>
        </div>
        <button className="pause-btn" aria-label="Pause" onPointerDown={pause}>
          ❘❘
        </button>
      </div>
    </div>
  );
}
