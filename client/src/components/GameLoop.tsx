import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import { stepSim, type Sim } from "../game/sim";
import { input } from "../game/input";
import { fxBus } from "../game/fx";
import { juiceBus, buzz } from "../game/juice";
import * as audio from "../game/audio";
import { postPollinate } from "../lib/api";
import { useGame } from "../state/store";

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const fwd = new THREE.Vector3();
const sipPos = new THREE.Vector3();

/**
 * Drives the whole game from a single useFrame: physics step, event handling,
 * chase camera, and throttled HUD updates (spec §12: no per-frame React).
 */
export function GameLoop({ sim }: { sim: Sim }) {
  const { camera } = useThree();
  const hudAccum = useRef(0);
  const started = useRef(false);
  const sipFx = useRef(0);
  const sipSnd = useRef(0);

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

    let ended: "time" | "energy" | "goal" | null = null;
    if (!frozen) {
      stepSim(sim, dt, input);
      audio.updateBuzz(dt, sim.mode === "flying");

      // --- Events ---
      for (const ev of sim.events) {
        switch (ev.type) {
          case "flap":
            audio.onFlap();
            break;
          case "pollinated": {
            const f = sim.flowers[ev.flowerIdx];
            audio.onPollinate();
            // Juice: a fat golden burst, a soft white sparkle core, a screen
            // flash and a haptic thump so every flower lands with a punch.
            fxBus.spawn(f.pos, 0xffe066, 44);
            fxBus.spawn(f.pos, 0xfff6c0, 20);
            juiceBus.flash("#ffe37a", 0.42);
            buzz(28);
            postPollinate(sim.map.levelId, f.def.id);
            useGame.getState().bumpPollinationTotal();
            break;
          }
          case "landed":
            audio.onLand();
            break;
          case "terrainSkim":
            fxBus.spawn(sim.pos, 0xc9b98a, 8);
            break;
          case "ended":
            ended = ev.reason;
            if (ev.reason === "goal") {
              // Quota met: celebratory fanfare, big burst, bright flash, buzz.
              audio.onGoal();
              fxBus.spawn(sim.pos, 0xffe066, 64);
              juiceBus.flash("#fff0a0", 0.75);
              buzz([0, 40, 40, 60]);
            }
            break;
        }
      }
      sim.events.length = 0;

      // --- Sip fountain: while drinking, spray a steady stream of pollen and
      // play a rising sparkle so collecting nectar feels alive. ---
      if (sim.mode === "perched" && sim.sipRate > 0) {
        sipFx.current += dt;
        sipSnd.current += dt;
        if (sipFx.current >= 0.045) {
          sipFx.current = 0;
          sipPos.copy(sim.pos);
          sipPos.y += 0.35;
          fxBus.spawn(sipPos, 0xffd24a, 3);
        }
        if (sipSnd.current >= 0.12) {
          sipSnd.current = 0;
          const progress = sim.nectarGoal > 0 ? sim.nectar / sim.nectarGoal : 0;
          audio.onSip(Math.min(1, progress));
        }
      } else {
        sipFx.current = 0;
        sipSnd.current = 0;
      }
    } else {
      audio.updateBuzz(dt, false); // let the wing buzz die out while frozen
    }

    // --- Chase camera: fixed offset & pitch; altitude = scouting information. ---
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
        energy: sim.energy,
        energyMax: sim.energyMax,
        timeLeft: sim.timeLeft,
        dayFrac: 1 - sim.timeLeft / sim.dayLength,
        nectar: sim.nectar,
        pollinatedSession: sim.pollinatedThisRun,
      });
    }

    if (sim.mode === "done" && ended === null) {
      // 'ended' event already fired on a previous frame; finish now.
      useGame.getState().endLevel(sim.endReason ?? (sim.timeLeft <= 0 ? "time" : "energy"));
    }
  });

  return null;
}
