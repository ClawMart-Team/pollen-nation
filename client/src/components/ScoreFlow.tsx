import { useEffect, useRef } from "react";
import { useGame } from "../state/store";
import { scoreFx } from "../game/scorefx";

/** Seconds a chip takes to fly from its flower into the running total. */
const FLY = 0.55;
/** Max chips animating at once; extras are delivered instantly (no fly). */
const MAX = 40;

interface Chip {
  el: HTMLDivElement;
  sx: number;
  sy: number;
  points: number;
  born: number;
}

/**
 * Score presentation: instead of large numbers popping over each flower (which
 * blocked the view), every collect launches a small "×N" multiplier chip from
 * the flower's on-screen position that flies into a single large total in the
 * top-left. That total counts up live as chips arrive, so the score visibly
 * adds up while the chip shows the multiplier earned.
 */
export function ScoreFlow() {
  const combo = useGame((s) => s.hud.combo);
  const layerRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current!;
    const total = totalRef.current!;
    const chips: Chip[] = [];
    let delivered = 0; // points that have reached the total
    let shown = 0; // number currently displayed
    let raf = 0;

    scoreFx.pop = (x, y, points, combo) => {
      if (chips.length >= MAX) {
        // Overloaded: credit the points immediately without a flying chip.
        delivered += points;
        return;
      }
      const el = document.createElement("div");
      el.className = "score-chip" + (combo > 1 ? " gold" : "");
      el.textContent = "×" + combo;
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      layer.appendChild(el);
      chips.push({ el, sx: x, sy: y, points, born: performance.now() });
    };

    const loop = () => {
      const now = performance.now();
      // Fly the total's centre point (measured live so it survives resizes).
      const lr = layer.getBoundingClientRect();
      const tr = total.getBoundingClientRect();
      const tx = tr.left - lr.left + tr.width * 0.5;
      const ty = tr.top - lr.top + tr.height * 0.5;

      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        const t = Math.min((now - c.born) / 1000 / FLY, 1);
        const e = t * t; // ease-in: accelerate into the total
        const cx = c.sx + (tx - c.sx) * e;
        const cy = c.sy + (ty - c.sy) * e;
        const scale = 1 - 0.4 * t;
        const op = t < 0.15 ? t / 0.15 : t > 0.8 ? Math.max(0, (1 - t) / 0.2) : 1;
        c.el.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%) scale(${scale})`;
        c.el.style.opacity = String(op);
        if (t >= 1) {
          delivered += c.points;
          c.el.remove();
          chips.splice(i, 1);
          // Kick the total so it pulses as points land.
          total.classList.remove("bump");
          void total.offsetWidth; // force reflow to restart the animation
          total.classList.add("bump");
        }
      }

      // Ease the displayed number up toward the delivered total.
      if (shown < delivered) {
        shown = Math.min(delivered, shown + Math.max(1, Math.ceil((delivered - shown) * 0.2)));
        total.textContent = shown.toLocaleString();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      scoreFx.pop = () => {};
      for (const c of chips) c.el.remove();
    };
  }, []);

  return (
    <div className="score-flow" ref={layerRef}>
      <div className="score-anchor">
        <div className="score-total" ref={totalRef}>
          0
        </div>
        {combo > 1 && <div className="score-combo">×{combo}</div>}
      </div>
    </div>
  );
}
