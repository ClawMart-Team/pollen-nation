import { useEffect, useRef, useState } from "react";
import { juiceBus } from "../game/juice";

/**
 * Full-screen juice flash: a soft radial glow that punches to `strength` then
 * fades out via CSS transition. Driven imperatively through the juice bus so
 * game logic can fire it without per-frame React work.
 */
export function JuiceFlash() {
  const ref = useRef<HTMLDivElement>(null);
  const [color, setColor] = useState("#ffe066");

  useEffect(() => {
    juiceBus.flash = (c = "#ffe066", strength = 0.5) => {
      const el = ref.current;
      if (!el) return;
      setColor(c);
      // Snap to full strength, then let the CSS transition fade it out.
      el.style.transition = "none";
      el.style.opacity = String(Math.min(1, strength));
      // Force a reflow so the next opacity change animates.
      void el.offsetWidth;
      el.style.transition = "opacity 550ms ease-out";
      el.style.opacity = "0";
    };
    return () => {
      juiceBus.flash = () => {};
    };
  }, []);

  return (
    <div
      ref={ref}
      className="juice-flash"
      style={{
        background: `radial-gradient(circle at 50% 62%, ${color}00 38%, ${color} 140%)`,
      }}
    />
  );
}
