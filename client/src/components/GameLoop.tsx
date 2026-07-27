import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CONFIG } from "@pollen/shared";
import { stepSim, type Sim } from "../game/sim";
import { input } from "../game/input";
import { fxBus } from "../game/fx";
import * as audio from "../game/audio";
import { postPollinate } from "../lib/api";
import { useGame, type HudData } from "../state/store";

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
    if (phase !== "playing") return;
    if (paused) {
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
        case "collision":
          audio.onCollision();
          fxBus.spawn(sim.pos, ev.obstacle === "branch" ? 0x8a6a42 : 0x5f9c48, 14);
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
    camTarget.y = sim.pos.y + 0.5;
    camera.lookAt(camTarget);

    // --- Throttled HUD + compass petals. ---
    hudAccum.current += dt;
    if (hudAccum.current >= 1 / CONFIG.hud.updateHz) {
      hudAccum.current = 0;
      // Bearing-based petals: with the curved world, screen projection can't
      // tell that a cluster dead ahead is hidden below the horizon, so we use
      // distance + bearing relative to the bee's heading instead.
      const petals: HudData["petals"] = [];
      const fwdX = Math.sin(sim.heading);
      const fwdZ = Math.cos(sim.heading);
      const ranked = sim.clusters
        .filter((c) => c.nectarLeft > 4 && c.center.distanceTo(sim.pos) > CONFIG.hud.petalMinDist)
        .sort((a, b) => b.nectarLeft - a.nectarLeft)
        .slice(0, CONFIG.hud.maxPetals);
      for (const c of ranked) {
        const dx = c.center.x - sim.pos.x;
        const dz = c.center.z - sim.pos.z;
        const dist = Math.hypot(dx, dz);
        const ux = dx / dist;
        const uz = dz / dist;
        // Signed angle from heading to cluster; negative = screen-left.
        const ang = Math.atan2(fwdX * uz - fwdZ * ux, fwdX * ux + fwdZ * uz);
        const onScreen = dist < CONFIG.hud.petalHorizonDist && Math.abs(ang) < 0.45;
        if (onScreen) continue; // visible over the horizon — beacon carries it
        // Place the petal on an ellipse around screen centre, pointing outward.
        const px = 50 + Math.sin(ang) * 42;
        const py = THREE.MathUtils.clamp(44 - Math.cos(ang) * 34, 8, 70);
        petals.push({
          x: px,
          y: py,
          angle: Math.atan2(-Math.cos(ang), Math.sin(ang)),
          strength: Math.min(1, c.nectarLeft / Math.max(1, c.nectarMax)),
        });
      }
      useGame.getState().setHud({
        energy: sim.energy,
        energyMax: sim.energyMax,
        timeLeft: sim.timeLeft,
        dayFrac: 1 - sim.timeLeft / sim.dayLength,
        nectar: sim.nectar,
        pollinatedSession: sim.pollinatedThisRun,
        petals,
      });
    }

    if (sim.mode === "done" && ended === null) {
      // 'ended' event already fired on a previous frame; finish now.
      useGame.getState().endLevel(sim.timeLeft <= 0 ? "time" : "energy");
    }
  });

  return null;
}
