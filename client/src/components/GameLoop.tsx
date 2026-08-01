import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import { stepSim, resetToStart, type Sim } from "../game/sim";
import { input } from "../game/input";
import { fxBus } from "../game/fx";
import { scoreFx } from "../game/scorefx";
import { juiceBus, buzz } from "../game/juice";
import * as audio from "../game/audio";
import { useGame } from "../state/store";

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const fwd = new THREE.Vector3();
const proj = new THREE.Vector3();

/** Intro camera: how far to the bee's side, and how high, the perpendicular
 *  tracking shot sits. */
const INTRO_SIDE = 8.5;
const INTRO_LIFT = 3.2;
/** Seconds to keep smoothing the look direction after the intro ends, so the
 *  camera glides from the side view to the behind-the-bee gameplay view. */
const INTRO_SWING = 0.7;

/** Flower head color as a THREE-friendly hex number. */
function speciesColor(species: string): number {
  const hex = (CONFIG.species as Record<string, { color: string }>)[species]?.color ?? "#ffffff";
  return parseInt(hex.replace("#", ""), 16);
}

/**
 * Drives the whole game from a single useFrame: physics step, event handling,
 * chase camera, and throttled HUD updates (spec §12: no per-frame React).
 */
export function GameLoop({ sim }: { sim: Sim }) {
  const { camera, size } = useThree();
  const hudAccum = useRef(0);
  const started = useRef(false);
  const wasIntro = useRef(false);
  const swing = useRef(0);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const { phase, paused, ready, intro, attract } = useGame.getState();

    // Menu attract mode: fly the bee on a gentle looping fly-by behind the
    // (transparent) menu overlay, so the menu always floats over a live world.
    if (phase === "menu" && attract) {
      stepSim(sim, dt, input); // input is unbound on the menu, so effectively zero
      sim.events.length = 0; // keep the menu quiet — discard flap/collect events
      audio.updateBuzz(dt, false);
      // Loop before the bee reaches the flowers (and any gaps), cutting the
      // camera cleanly back to the start.
      const firstRowZ = sim.rows.length ? sim.rows[0].z : 30;
      if (sim.pos.z >= firstRowZ - 2 || sim.mode !== "running") {
        resetToStart(sim);
        started.current = false; // snap the camera to the fresh start (clean loop cut)
      }
      // Perpendicular side-tracking shot (same framing as the opening intro).
      camPos.set(sim.pos.x - INTRO_SIDE, sim.pos.y + INTRO_LIFT, sim.pos.z);
      const g = sim.heightAt(camPos.x, camPos.z) + 1.2;
      if (camPos.y < g) camPos.y = g;
      camTarget.copy(sim.pos);
      if (!started.current) {
        camera.position.copy(camPos);
        camLook.copy(camTarget);
        started.current = true;
      } else {
        const a = 1 - Math.exp(-CONFIG.camera.lerp * dt);
        camera.position.lerp(camPos, a);
        camLook.lerp(camTarget, a);
      }
      camera.lookAt(camLook);
      return;
    }

    if (phase !== "playing") {
      audio.updateBuzz(dt, false);
      return;
    }
    // Frozen (paused, or waiting for the player to read the controls): keep the
    // start view framed but don't advance the sim so the bee holds still.
    const frozen = paused || !ready;

    let ended = false;
    if (!frozen) {
      stepSim(sim, dt, input);
      audio.updateBuzz(dt, sim.mode === "running");

      // --- Events ---
      for (const ev of sim.events) {
        switch (ev.type) {
          case "hop":
            audio.onFlap();
            buzz(10);
            break;
          case "dive":
            // Dropping onto a flower: a quick flap and a soft buzz.
            audio.onFlap();
            buzz(14);
            break;
          case "miss":
            // Dived into a gap: a dull thud, a red flash and a hard buzz as the
            // chain breaks and a little daylight is lost.
            audio.onLand();
            juiceBus.flash("#ff5a5a", 0.3);
            buzz(30);
            break;
          case "turn":
            // Mid-day turn-around: the bee spins for home. Bright flash + buzz.
            audio.onGoal();
            juiceBus.flash("#ffe6a0", 0.4);
            buzz([0, 30, 20, 30]);
            break;
          case "collect": {
            const f = sim.flowers[ev.flowerIdx];
            const col = speciesColor(f.def.species);
            // Launch a small "+N" chip from the flower's on-screen position; it
            // flies into the single live-counting total (see ScoreFlow).
            proj.copy(f.pos).project(camera);
            if (proj.z < 1) {
              const sx = (proj.x * 0.5 + 0.5) * size.width;
              const sy = (-proj.y * 0.5 + 0.5) * size.height;
              scoreFx.pop(sx, sy, ev.points, ev.combo);
            }
            if (ev.matched) {
              // Chaining the same type: a fat burst in the flower's own color,
              // a white sparkle core, a flash that grows with the combo, a
              // rising chime and a satisfying haptic pop.
              const strength = Math.min(0.85, 0.35 + ev.combo * 0.12);
              fxBus.spawn(f.pos, col, 34 + Math.min(ev.combo, 6) * 6);
              fxBus.spawn(f.pos, 0xffffff, 14);
              juiceBus.flash("#fff0a0", strength);
              audio.onSip(Math.min(1, (ev.combo - 1) / 8));
              buzz(20 + Math.min(ev.combo, 6) * 6);
            } else {
              // Chain broken / started: a small colored puff and a soft thud.
              fxBus.spawn(f.pos, col, 16);
              audio.onLand();
              buzz(12);
            }
            break;
          }
          case "ended":
            ended = true;
            if (ev.reason === "home") {
              // Made it home before dusk: celebratory fanfare, gold burst.
              audio.onGoal();
              fxBus.spawn(sim.pos, 0xffe066, 64);
              juiceBus.flash("#fff0a0", 0.7);
              buzz([0, 40, 40, 60]);
            } else {
              // Died — crashed into the grass, or ran out of daylight short of
              // the hive: a dull thud, red flash and a hard buzz.
              audio.onLand();
              fxBus.spawn(sim.pos, 0x6a8f3c, 46);
              juiceBus.flash("#ff3b3b", 0.7);
              buzz([0, 60, 40, 80]);
            }
            break;
        }
      }
      sim.events.length = 0;
    } else {
      audio.updateBuzz(dt, false); // let the wing buzz die out while frozen
    }

    // --- Camera. ---
    const introActive = intro && sim.mode === "running";
    if (introActive) {
      // Opening cinematic: a perpendicular (side-on) tracking shot. The camera
      // sits off to the bee's side and looks straight at it, so the hive, bee
      // and flowers keep their orientation and the bee visibly cruises forward
      // (+Z) across the frame. It ends when the bee reaches the first flower.
      camPos.set(sim.pos.x - INTRO_SIDE, sim.pos.y + INTRO_LIFT, sim.pos.z);
      const g = sim.heightAt(camPos.x, camPos.z) + 1.2;
      if (camPos.y < g) camPos.y = g;
      camTarget.copy(sim.pos);
      const firstRowZ = sim.rows.length ? sim.rows[0].z : 30;
      if (sim.pos.z >= firstRowZ - 4) useGame.getState().endIntro();
    } else {
      // Gameplay chase cam: locked to the center lane (x=0) and only tracking
      // forward, so both edge lanes and the far rows stay visible; only the bee
      // moves side to side.
      fwd.set(Math.sin(sim.heading), 0, Math.cos(sim.heading));
      camPos.set(0, sim.pos.y, sim.pos.z).addScaledVector(fwd, -CONFIG.camera.back);
      camPos.y += CONFIG.camera.up;
      // Keep the camera itself out of the ground.
      const camGround = sim.heightAt(camPos.x, camPos.z) + 1.2;
      if (camPos.y < camGround) camPos.y = camGround;
      camTarget.set(0, sim.pos.y, sim.pos.z).addScaledVector(fwd, CONFIG.camera.lookAhead);
      camTarget.y = sim.pos.y - CONFIG.camera.lookDown;
    }

    // Keep smoothing the look for a moment after the intro ends so the camera
    // gently swings from the side view to behind the bee.
    if (wasIntro.current && !introActive) swing.current = INTRO_SWING;
    wasIntro.current = introActive;
    if (swing.current > 0) swing.current -= dt;
    const smoothLook = introActive || swing.current > 0;

    if (!started.current) {
      camera.position.copy(camPos);
      camLook.copy(camTarget);
      started.current = true;
    } else {
      const a = 1 - Math.exp(-CONFIG.camera.lerp * dt);
      camera.position.lerp(camPos, a);
      // Gameplay keeps an instant, exact aim (preserving the tuned framing);
      // only the intro/swing smooths the look direction.
      if (smoothLook) camLook.lerp(camTarget, a);
      else camLook.copy(camTarget);
    }
    camera.lookAt(camLook);

    // --- Throttled HUD update. ---
    hudAccum.current += dt;
    if (hudAccum.current >= 1 / CONFIG.hud.updateHz) {
      hudAccum.current = 0;
      useGame.getState().setHud({
        score: sim.score,
        combo: sim.combo,
        bestCombo: sim.bestCombo,
        timeLeft: sim.timeLeft,
        dayFrac: 1 - sim.timeLeft / sim.dayLength,
      });
    }

    // Show the summary exactly once, on the frame the run actually ends. Keying
    // off the one-shot `ended` event (rather than a live phase check) prevents a
    // just-restarted run's stale GameLoop from immediately re-ending it — which
    // otherwise forced a second "Play again" tap.
    if (ended) {
      useGame.getState().endLevel();
    }
  });

  return null;
}
