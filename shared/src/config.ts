/**
 * ALL gameplay tunables live here (spec §16). Every [tunable] from the design
 * doc is a named constant with a comment. Balance the game from this one file.
 */
export const CONFIG = {
  flight: {
    /** Constant forward cruise speed (m/s). The bee always moves ahead. */
    baseSpeed: 12,
    /** Downward acceleration (m/s^2). */
    gravity: -16,
    /** Terminal descent speed while gliding (m/s). Lower = floatier glide.
     *  This IS the glide ratio: baseSpeed / glideFallSpeed ≈ 3.4:1. */
    glideFallSpeed: 3.5,
    /** Upward velocity added per wing flap (m/s). */
    flapImpulse: 4.6,
    /** Max upward speed reachable by rapid tapping (m/s). */
    maxRiseSpeed: 7,
    /** How long the tap must be held (after the initial flap) before the bee
     *  tucks into a dive (s). Roughly one wing-flap beat. */
    diveDelaySec: 0.1,
    /** Downward acceleration while diving (m/s^2), on top of gravity. */
    diveAccel: 36,
    /** Max downward speed while diving (m/s). Overrides the glide cap. */
    maxDiveSpeed: 18,
    /** Energy cost per flap. */
    flapEnergyCost: 0.35,
    /** Passive energy drain per second (may be 0). Hovering isn't free. */
    passiveDrainPerSec: 0.1,
    /** Max turn rate at a full-edge tap (rad/s). */
    turnRateMax: 2.6,
    /** Fraction of half-screen-width around centre that steers straight. */
    steerDeadZone: 0.1,
    /** Steering response exponent: >1 softens small offsets, sharpens edges.
     *  Near 1 makes the turn track tap position almost proportionally. */
    steerCurveExp: 1.05,
    /** How fast steering input decays back to 0 after the finger lifts (1/s). */
    steerReleaseDecay: 3.0,
    /** Visual bank roll at max turn (radians). */
    bankMaxRoll: 0.85,
    /** Hover clearance kept above the terrain surface (m). */
    minAltitude: 0.45,
    /** Energy penalty when the bee skims the terrain (soft floor, not fatal). */
    terrainSkimEnergyCost: 1.5,
    /** Upward bounce velocity applied on a terrain skim (m/s). */
    terrainSkimBounce: 3.0,
    /** Cooldown between terrain-skim penalties (s) so a long skid isn't ruinous. */
    terrainSkimCooldown: 0.6,
    /** Altitude ceiling above terrain (soft clamp). Also bounds how far past
     *  the horizon a climbing bee can scout on the curved world. */
    maxAltitude: 30,
  },

  flowers: {
    /** Distance from a flower head within which the bee snaps to a perch (m).
     *  Deliberately generous: landing must feel good on a phone. */
    landingRadius: 1.9,
    /** Max speed at which landing engages (m/s). Set above cruise speed to make
     *  landing purely proximity-based (forgiving); lower it to demand slowing. */
    landingMaxSpeed: 30,
    /** Seconds after takeoff during which re-landing is suppressed. */
    takeoffGraceSec: 0.8,
    /** Nectar transferred per second from a FULL flower (score units/s). */
    sipNectarPerSec: 6,
    /** Energy restored per unit of nectar sipped. */
    energyPerNectar: 0.9,
    /** Diminishing returns: sip rate scales with (remaining/initial)^exp. */
    diminishExp: 0.7,
    /** Fraction of reserve below which a flower counts as depleted/wilted. */
    depletedFrac: 0.05,
    /** Upward velocity on takeoff from a perch (m/s). */
    takeoffImpulse: 4.5,
  },

  /** Per-species visuals + nectar multiplier. Keys must match SPECIES_IDS. */
  species: {
    daisy: { color: "#f7f7ff", stemHeight: 1.1, headScale: 0.45, nectarMult: 1.0 },
    tulip: { color: "#ff5470", stemHeight: 1.0, headScale: 0.5, nectarMult: 1.1 },
    bellflower: { color: "#7f7bff", stemHeight: 1.4, headScale: 0.4, nectarMult: 1.2 },
    sunflower: { color: "#ffc233", stemHeight: 2.0, headScale: 0.7, nectarMult: 1.5 },
  } as Record<string, { color: string; stemHeight: number; headScale: number; nectarMult: number }>,

  camera: {
    /** Vertical field of view (degrees). Narrow = telephoto, less world on screen. */
    fov: 42,
    /** Chase distance behind the bee (m). Near-first-person, bee stays visible. */
    back: 3.6,
    /** Height above the bee (m). Fixed pitch: altitude = scouting information. */
    up: 1.2,
    /** Look-at point ahead of the bee (m) — keeps horizon high on screen. */
    lookAhead: 9,
    /** How far BELOW the bee the look-at point sits (m). Pitches the view
     *  down, framing the bee high on screen with more map visible below it. */
    lookDown: 4.0,
    /** Position lerp stiffness (1/s). Higher = snappier follow. */
    lerp: 4.5,
  },

  fog: {
    /** Fog is only a faint atmospheric haze now — the planet's HORIZON hides
     *  distant content (see world.planetRadius), not the fog. */
    near: 55,
    far: 150,
  },

  world: {
    /** Radius (m) of the rendered planet. Geometry drops by d²/2R with
     *  distance, so this sets how close the horizon feels: smaller = rounder
     *  world, earlier reveal as the bee advances. Horizon ≈ √(2·R·eyeHeight):
     *  at R=180 the horizon sits ~30 m away at cruise height and climbing to
     *  the ceiling scouts ~100 m — a dramatic "small planet" feel. */
    planetRadius: 40,
    /** Terrain chunk edge length (m). */
    chunkSize: 32,
    /** Plane subdivisions per chunk (verts = (n+1)^2). */
    chunkSegments: 16,
    /** Chunk streaming radius in chunks around the bee. Must reach past the
     *  horizon so terrain rises into view instead of popping. */
    chunkRadius: 5,
    /** Grid cell size used to group flowers into clusters (m). */
    clusterCell: 30,
    /** Grass tufts scattered per terrain chunk (public/models/grass.glb).
     *  Total instances ≈ (2·chunkRadius+1)² · grassPerChunk in ONE draw call. */
    grassPerChunk: 40,
  },

  day: {
    /** Fallback day length if a map omits difficulty (s). */
    defaultLengthSec: 150,
    /** Fallback starting energy budget (tight: ~8 units keeps runs short). */
    defaultEnergy: 8,
    /** Day fraction after which light shifts warm toward dusk. */
    duskStart: 0.65,
  },

  hud: {
    /** HUD store update frequency (Hz) — throttled to avoid React re-renders. */
    updateHz: 8,
  },

  fx: {
    /** In-world beacon shaft max opacity (scaled by remaining nectar). */
    beaconMaxOpacity: 0.06,
    beaconHeight: 34,
    beaconRadius: 1.1,
    /** Beacons fade out within this distance of the bee (they guide from afar;
     *  up close they'd fill the near-first-person camera). */
    beaconFadeNear: 35,

    /** In-world annular arc "ribbon" markers that hover over each cluster and
     *  grow as the bee approaches. They replace the old 2D compass petals. */
    ring: {
      /** Inner/outer radius of the ring band at unit scale (m). */
      innerRadius: 1.5,
      outerRadius: 2.1,
      /** Sweep of the arc ribbon (radians). < 2π = partial ring. */
      arc: Math.PI * 1.35,
      /** Height the ribbon floats above the cluster ground (m). */
      height: 7,
      /** Max curvature compensation added to the height (m). Beyond the matching
       *  distance the ribbon sinks with the horizon and the beacon takes over. */
      maxLift: 16,
      /** At/under nearDist the ribbon is maxScale; at/over farDist it's minScale. */
      nearDist: 8,
      farDist: 70,
      minScale: 0.6,
      maxScale: 3.0,
      /** Peak opacity (scaled by remaining nectar). */
      maxOpacity: 0.85,
    },
  },

  perf: {
    /** devicePixelRatio clamp. */
    maxDPR: 2,
  },

  ending: {
    /** Seconds the bee drifts down after energy hits zero before summary. */
    driftSec: 1.8,
  },

  goal: {
    /** Nectar quota to complete level 1. */
    baseQuota: 30,
    /** Extra nectar quota added per level beyond level 1. */
    quotaPerLevel: 6,
  },
} as const;

export type GameConfig = typeof CONFIG;

/** Minimum nectar required to complete a level. Single source of truth shared
 *  by the client (HUD/summary) and the server (authoritative unlock gate). */
export function nectarGoalForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return CONFIG.goal.baseQuota + CONFIG.goal.quotaPerLevel * (n - 1);
}
