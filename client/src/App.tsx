import { useEffect, useRef } from "react";
import { useGame } from "./state/store";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/HUD";
import { MenuScreen, LoadingScreen, SummaryScreen, TutorialOverlay, PauseScreen } from "./components/Screens";
import { JuiceFlash } from "./components/JuiceFlash";
import { bindInput } from "./game/input";
import { ensureAudio } from "./game/audio";

export default function App() {
  const phase = useGame((s) => s.phase);
  const sim = useGame((s) => s.sim);
  const paused = useGame((s) => s.paused);
  const boot = useGame((s) => s.boot);
  const inputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    boot();
  }, [boot]);

  // Touch input layer: bound to the container, active only while playing.
  useEffect(() => {
    if (phase !== "playing" || !inputRef.current) return;
    const unbind = bindInput(inputRef.current);
    const el = inputRef.current;
    const audioKick = () => ensureAudio();
    el.addEventListener("pointerdown", audioKick);
    return () => {
      unbind();
      el.removeEventListener("pointerdown", audioKick);
    };
  }, [phase]);

  return (
    <div className="app">
      {/* World stays mounted whenever a sim exists so it remains visible
          (frozen) behind the summary / menu screens between levels. */}
      {sim && <GameCanvas sim={sim} />}
      {phase === "playing" && sim && (
        <>
          {/* transparent input layer above the canvas, below the HUD */}
          <div ref={inputRef} className="input-layer" />
          <JuiceFlash />
          <HUD />
          <TutorialOverlay />
          {paused && <PauseScreen />}
        </>
      )}
      {(phase === "menu" || phase === "boot") && <MenuScreen />}
      {phase === "loading" && <LoadingScreen />}
      {phase === "summary" && <SummaryScreen />}
    </div>
  );
}
