/**
 * Touch input, kept outside React. Tap = flap; tap X position steers; holding
 * the finger down sustains the turn (steer decays after release).
 */
export interface InputState {
  /** Flaps queued since the last sim step (a tap can land between frames). */
  flaps: number;
  /** Raw horizontal position of the active pointer, -1 (left) .. 1 (right). */
  steerX: number;
  /** Whether a pointer is currently held down. */
  down: boolean;
}

export const input: InputState = { flaps: 0, steerX: 0, down: false };

export function resetInput(): void {
  input.flaps = 0;
  input.steerX = 0;
  input.down = false;
}

const normX = (clientX: number) => (clientX / window.innerWidth) * 2 - 1;

export function bindInput(el: HTMLElement): () => void {
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    input.down = true;
    input.steerX = normX(e.clientX);
    input.flaps++;
  };
  const onMove = (e: PointerEvent) => {
    if (input.down) input.steerX = normX(e.clientX);
  };
  const onUp = () => {
    input.down = false;
  };
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
  };
}
