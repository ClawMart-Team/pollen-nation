/**
 * Imperative "juice" bus for full-screen feedback (flashes) driven from game
 * logic without React round-trips. The JuiceFlash overlay registers its trigger
 * here; game code fires it on satisfying moments (pollination, quota met).
 */
export const juiceBus: {
  /** Flash a fading full-screen glow. strength 0..1. */
  flash: (color?: string, strength?: number) => void;
} = {
  flash: () => {},
};

/** Fire a short haptic pulse where supported (mobile). Safe no-op otherwise. */
export function buzz(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}
