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
 * HUD (§11): energy, sun-arc timer, nectar, pollination count, level, compass
 * petals. Thumb-safe: everything hugs the top; lower corners stay empty.
 */
export function HUD() {
  const hud = useGame((s) => s.hud);
  const levelNum = useGame((s) => s.levelNum);
  const progress = useGame((s) => s.progress);
  const pause = useGame((s) => s.pause);

  const energyFrac = Math.max(0, hud.energy / hud.energyMax);
  const t = Math.max(0, hud.timeLeft);
  const mm = Math.floor(t / 60);
  const ss = Math.floor(t % 60).toString().padStart(2, "0");

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="hud-left">
          <div className="hud-level">Day {levelNum}</div>
          <div className="energy-bar">
            <div
              className="energy-fill"
              style={{
                width: `${energyFrac * 100}%`,
                background: energyFrac < 0.25 ? "#ff5450" : "#ffd94d",
              }}
            />
          </div>
        </div>
        <div className="hud-mid">
          <SunArc dayFrac={hud.dayFrac} />
          <div className="hud-time">{mm}:{ss}</div>
        </div>
        <div className="hud-right">
          <div className="hud-stat">🍯 {Math.floor(hud.nectar)}</div>
          <div className="hud-stat">
            🌸 {hud.pollinatedSession}
            {progress ? ` · ${progress.pollinationTotal}` : ""}
          </div>
        </div>
        <button className="pause-btn" aria-label="Pause" onPointerDown={pause}>
          ❘❘
        </button>
      </div>

      {/* Compass petals (§8): edge markers pointing at off-screen rich clusters. */}
      {hud.petals.map((p, i) => (
        <div
          key={i}
          className="petal"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            opacity: 0.35 + p.strength * 0.65,
            transform: `translate(-50%, -50%) rotate(${p.angle}rad)`,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 26 26">
            <path d="M 24 13 C 16 5, 6 7, 2 13 C 6 19, 16 21, 24 13 Z" fill="#ff7fc0" stroke="#fff" strokeWidth="1" />
          </svg>
        </div>
      ))}
    </div>
  );
}
