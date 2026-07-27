# 🐝 Pollinator (pollen-nation)

A mobile-web 3D bee flight game. Tap to flap, steer with tap position, forage
nectar from flowers before dusk, and pollinate the meadow — permanently.

## Stack

- **Client** — React + React Three Fiber + drei, zustand, custom kinematics
  (no physics engine), chunk-streamed heightmap terrain, instanced meshes.
- **Server** — Node + Express + SQLite (better-sqlite3). LLM-driven level
  generation (any OpenAI-compatible API) with zod validation, one retry with
  error feedback, and a deterministic procedural fallback emitting the same
  schema. Level N+1 is prefetched in the background while you play N.
- **Shared** — [shared/src/schema.ts](shared/src/schema.ts) (map contract) and
  [shared/src/config.ts](shared/src/config.ts) (**every gameplay tunable**).

## Run

```bash
npm install
npm run dev          # server :3001 + client :5173 (LAN-exposed for phones)
```

Optional LLM generation — copy [server/.env.example](server/.env.example) to
`server/.env` and set `OPENAI_API_KEY` (else the procedural generator is used;
the client can't tell the difference).

```bash
npm run build && npm start   # production: server serves client/dist on :3001
```

## Controls

- **Tap** — wing flap (costs energy). Rapid taps climb; no taps glide down.
- **Tap left/right** — bank and turn; hold to sustain the turn; centre is a
  dead zone that flies straight.
- **Near a flower** — auto-perch. While perched, nectar (score) and energy
  flow in while daylight burns. **Tap** to take off.

## Tuning guide (what to adjust first, and why)

All in [shared/src/config.ts](shared/src/config.ts):

1. `flight.flapImpulse` / `flight.gravity` / `flight.glideFallSpeed` — the
   whole feel of flight lives here; get tap rhythm ≈ 1–2 taps/sec for level
   flight before touching anything else.
2. `flight.turnRateMax` / `steerDeadZone` / `steerCurveExp` — steering
   authority vs. stability on a narrow phone screen.
3. `flowers.sipNectarPerSec` / `energyPerNectar` / `diminishExp` — the core
   sip-longer-vs-burn-daylight tradeoff; `diminishExp` controls how quickly a
   flower stops being worth sitting on.
4. `flight.flapEnergyCost` + `day.defaultLengthSec` + map `energyBudget` —
   how far the frontier of fresh nectar can recede before the day is lost.
5. `flowers.landingRadius` — bigger = more forgiving phone landings.
6. `camera.up` / `camera.back` + `world.planetRadius` — how much scouting
   reward extra altitude buys (a deliberate design mechanic: climb to see
   farther over the horizon).

## Notes

- Pollination records persist server-side per anonymous user and survive
  reloads/replays (`POST /api/pollinate` is idempotent).
- Stretch hook (§4): the hive position is in the sim; a "return to bank
  nectar" rule can be added in `stepSim` without schema changes.
- v1 non-goals honored: no multiplayer, weather, monetization, or camera
  controls.
