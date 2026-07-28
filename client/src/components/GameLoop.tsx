import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import { stepSim, type Sim } from "../game/sim";
import { input } from "../game/input";
import { fxBus } from "../game/fx";
import { juiceBus, buzz } from "../game/juice";
import * as audio from "../game/audio";
import { useGame } from "../state/store";

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const fwd = new THREE.Vector3();

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
  const { camera } = useThree();
  const hudAccum = useRef(0);
  const started = useRef(false);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const { phase, paused, ready } = useGame.getState();
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
          case "jump":
            // Leaping over a row: a brighter flap and a punchier buzz.
            audio.onFlap();
            juiceBus.flash("#bfe6ff", 0.22);
            buzz(24);
            break;
          case "collect": {
            const f = sim.flowers[ev.flowerIdx];
            const col = speciesColor(f.def.species);
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
          case "miss": {
            // Landed in an empty gap: the score resets. Harsh red flash, a dull
            // grey puff and a strong double-buzz sell the whiff.
            fxBus.spawn(sim.pos, 0x555555, 20);
            juiceBus.flash("#ff3b3b", 0.6);
            audio.onLand();
            buzz([0, 60, 40, 60]);
            break;
          }
          case "ended":
            ended = true;
            audio.onGoal();
            fxBus.spawn(sim.pos, 0xffe066, 64);
            juiceBus.flash("#fff0a0", 0.7);
            buzz([0, 40, 40, 60]);
            break;
        }
      }
      sim.events.length = 0;
    } else {
      audio.updateBuzz(dt, false); // let the wing buzz die out while frozen
    }

    // --- Chase camera: fixed offset & pitch behind the bee (heading is 0). ---
    fwd.set(Math.sin(sim.heading), 0, Math.cos(sim.heading));
    camPos.copy(sim.pos).addScaledVector(fwd, -CONFIG.camera.back);
    camPos.y += CONFIG.camera.up;
    // Keep the camera itself out of the ground.
    const camGround = sim.heightAt(camPos.x, camPos.z) + 1.2;
    if (camPos.y < camGround) camPos.y = camGround;
    if (!started.current) {
      camera.position.copy(camPos);
      started.current = true;
    } else {
      camera.position.lerp(camPos, 1 - Math.exp(-CONFIG.camera.lerp * dt));
    }
    camTarget.copy(sim.pos).addScaledVector(fwd, CONFIG.camera.lookAhead);
    camTarget.y = sim.pos.y - CONFIG.camera.lookDown;
    camera.lookAt(camTarget);

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

    if (sim.mode === "done") {
      // The run has finished (timer elapsed or all rows collected) — show it.
      if (ended || useGame.getState().phase === "playing") {
        useGame.getState().endLevel();
      }
    }
  });

  return null;
}
