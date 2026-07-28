import { useEffect, useRef } from "react";
import { useGame } from "./state/store";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/HUD";
import { ScoreFlow } from "./components/ScoreFlow";
import { MenuScreen, LoadingScreen, SummaryScreen, PauseScreen, PlayerBadge } from "./components/Screens";
import { JuiceFlash } from "./components/JuiceFlash";
import { bindInput } from "./game/input";
import { ensureAudio } from "./game/audio";

export default function App() {
  const phase = useGame((s) => s.phase);
  const sim = useGame((s) => s.sim);
  const paused = useGame((s) => s.paused);
  const intro = useGame((s) => s.intro);
  const boot = useGame((s) => s.boot);
  const inputRef = useRef<HTMLDivElement>(null);
  const booted = useRef(false);

  useEffect(() => {
    // Guard against React 18 StrictMode's double-invoked mount effect, which
    // would otherwise run the first-visit logic twice.
    if (booted.current) return;
    booted.current = true;
    boot();
  }, [boot]);

  // Touch input layer: bound to the container, active only while playing and
  // not during the opening cinematic (the bee flies itself until then).
  useEffect(() => {
    if (phase !== "playing" || intro || !inputRef.current) return;
    const unbind = bindInput(inputRef.current);
    const el = inputRef.current;
    // Focus the layer so arrow keys work immediately, without a first click.
    el.focus();
    const audioKick = () => ensureAudio();
    el.addEventListener("pointerdown", audioKick);
    return () => {
      unbind();
      el.removeEventListener("pointerdown", audioKick);
    };
  }, [phase, intro]);

  return (
    <div className="app">
      {/* World stays mounted whenever a sim exists so it remains visible
          (frozen) behind the summary / menu screens between levels. */}
      {sim && <GameCanvas sim={sim} />}
      {/* Player identity + current day: pinned top-right in every phase. */}
      <PlayerBadge />
      {phase === "playing" && sim && (
        <>
          {/* transparent input layer above the canvas, below the HUD */}
          <div ref={inputRef} className="input-layer" tabIndex={-1} />
          <JuiceFlash />
          <ScoreFlow />
          <HUD />
          {paused && <PauseScreen />}
        </>
      )}
      {(phase === "menu" || phase === "boot") && <MenuScreen />}
      {phase === "loading" && <LoadingScreen />}
      {phase === "summary" && <SummaryScreen />}
    </div>
  );
}
