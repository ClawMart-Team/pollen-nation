/**
 * Tiny WebAudio layer: wing buzz whose pitch rises with flapping, plus one-shot
 * chimes/thuds. No assets — everything is synthesized.
 */
let ctx: AudioContext | null = null;
let buzzOsc: OscillatorNode | null = null;
let buzzGain: GainNode | null = null;
let flapBoost = 0;

export function ensureAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return;
  }
  try {
    ctx = new AudioContext();
    buzzOsc = ctx.createOscillator();
    buzzOsc.type = "sawtooth";
    buzzOsc.frequency.value = 110;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 500;
    buzzGain = ctx.createGain();
    buzzGain.gain.value = 0;
    buzzOsc.connect(filter).connect(buzzGain).connect(ctx.destination);
    buzzOsc.start();
  } catch {
    ctx = null;
  }
}

/** Call every frame; flapping raises buzz pitch and volume briefly. */
export function updateBuzz(dt: number, flying: boolean): void {
  if (!ctx || !buzzOsc || !buzzGain) return;
  flapBoost = Math.max(0, flapBoost - dt * 2.5);
  const target = flying ? 0.035 + flapBoost * 0.05 : 0;
  buzzGain.gain.setTargetAtTime(target, ctx.currentTime, 0.05);
  buzzOsc.frequency.setTargetAtTime(110 + flapBoost * 90, ctx.currentTime, 0.03);
}

export function onFlap(): void {
  flapBoost = Math.min(1.5, flapBoost + 0.5);
}

function blip(freq: number, dur: number, type: OscillatorType, gain = 0.12): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

export function onPollinate(): void {
  blip(880, 0.25, "sine", 0.15);
  setTimeout(() => blip(1320, 0.3, "sine", 0.12), 90);
}

/** Rising sparkle while sipping; pitch climbs as the quota fills (progress01). */
export function onSip(progress01: number): void {
  const jitter = (Math.random() - 0.5) * 40;
  blip(660 + progress01 * 760 + jitter, 0.07, "sine", 0.045);
}

/** Little ascending fanfare when the day's quota is met. */
export function onGoal(): void {
  [660, 880, 1180, 1560].forEach((f, i) =>
    setTimeout(() => blip(f, 0.4, "sine", 0.14), i * 110)
  );
}

export function onLand(): void {
  blip(520, 0.12, "triangle", 0.08);
}
