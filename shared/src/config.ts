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
    /** Energy cost per flap. */
    flapEnergyCost: 0.35,
    /** Passive energy drain per second (may be 0). Hovering isn't free. */
    passiveDrainPerSec: 0.1,
    /** Max turn rate at a full-edge tap (rad/s). */
    turnRateMax: 1.7,
    /** Fraction of half-screen-width around centre that steers straight. */
    steerDeadZone: 0.12,
    /** Steering response exponent: >1 softens small offsets, sharpens edges. */
    steerCurveExp: 1.5,
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
    /** Altitude ceiling above terrain (soft clamp; keeps camera/fog readable). */
    maxAltitude: 45,
  },

  collisions: {
    /** Bee collision sphere radius (m). */
    beeRadius: 0.35,
    /** Energy cost when striking a branch. */
    branchEnergyCost: 8,
    /** Energy cost when striking a leaf cluster (softer). */
    leafEnergyCost: 4,
    /** Stun duration after a hit (s): tumble, reduced forward speed. */
    stunDurationSec: 0.7,
    /** Forward speed multiplier while stunned. */
    stunSpeedMult: 0.25,
    /** Horizontal knockback speed away from the obstacle (m/s). */
    knockbackSpeed: 5,
    /** Post-hit invulnerability window (s) so one tangle can't drain the bee. */
    invulnSec: 1.2,
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
    up: 1.4,
    /** Look-at point ahead of the bee (m) — keeps horizon high on screen. */
    lookAhead: 9,
    /** Position lerp stiffness (1/s). Higher = snappier follow. */
    lerp: 4.5,
  },

  fog: {
    near: 18,
    /** Draw distance. Tight on purpose: only nearby flowers are visible; the
     *  rest hide over the horizon and are revealed as the bee approaches. */
    far: 70,
  },

  world: {
    /** Terrain chunk edge length (m). */
    chunkSize: 32,
    /** Plane subdivisions per chunk (verts = (n+1)^2). */
    chunkSegments: 16,
    /** Chunk streaming radius in chunks around the bee. */
    chunkRadius: 3,
    /** Grid cell size used to group flowers into clusters (m). */
    clusterCell: 30,
  },

  day: {
    /** Fallback day length if a map omits difficulty (s). */
    defaultLengthSec: 150,
    /** Fallback starting energy budget. */
    defaultEnergy: 100,
    /** Day fraction after which light shifts warm toward dusk. */
    duskStart: 0.65,
  },

  hud: {
    /** HUD store update frequency (Hz) — throttled to avoid React re-renders. */
    updateHz: 8,
    /** Max compass petals shown at once. */
    maxPetals: 3,
    /** Clusters closer than this are "on screen enough" — no petal (m). */
    petalMinDist: 35,
  },

  fx: {
    /** In-world beacon shaft max opacity (scaled by remaining nectar). */
    beaconMaxOpacity: 0.06,
    beaconHeight: 34,
    beaconRadius: 1.1,
    /** Beacons fade out within this distance of the bee (they guide from afar;
     *  up close they'd fill the near-first-person camera). */
    beaconFadeNear: 35,
  },

  perf: {
    /** devicePixelRatio clamp. */
    maxDPR: 2,
  },

  ending: {
    /** Seconds the bee drifts down after energy hits zero before summary. */
    driftSec: 1.8,
  },
} as const;

export type GameConfig = typeof CONFIG;
