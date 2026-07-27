import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import { stepSim, type Sim } from "../game/sim";
import { input } from "../game/input";
import { fxBus } from "../game/fx";
import * as audio from "../game/audio";
import { postPollinate } from "../lib/api";
import { useGame } from "../state/store";

const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();
const fwd = new THREE.Vector3();

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
    const { phase, paused } = useGame.getState();
    if (phase !== "playing" || paused) {
      audio.updateBuzz(dt, false); // let the wing buzz die out while frozen
      return;
    }

    stepSim(sim, dt, input);
    audio.updateBuzz(dt, sim.mode === "flying");

    // --- Events ---
    let ended: "time" | "energy" | null = null;
    for (const ev of sim.events) {
      switch (ev.type) {
        case "flap":
          audio.onFlap();
          break;
        case "pollinated": {
          const f = sim.flowers[ev.flowerIdx];
          audio.onPollinate();
          fxBus.spawn(f.pos, 0xffe066, 26);
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
          break;
      }
    }
    sim.events.length = 0;

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
      useGame.getState().endLevel(sim.timeLeft <= 0 ? "time" : "energy");
    }
  });

  return null;
}
