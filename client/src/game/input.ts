/**
 * Touch input for Small World, kept outside React. Designed for one-handed play:
 *  • Touching (and holding) the screen makes the bee dive down into "hop" mode,
 *    skimming the flowers and pollinating each row it crosses.
 *  • While held, sliding left/right hops the bee between lanes — one lane per
 *    slide step, so a longer slide crosses several lanes.
 *  • Lifting the finger lets the bee climb back up to its fly-over cruise.
 * Desktop mirrors this with the arrow keys (left/right hop) and holding
 * space / down to dive.
 */
export interface InputState {
  /** Pending lane hops since the last sim step. Positive = screen-left,
   *  negative = screen-right. One hop is consumed per step. */
  hop: number;
  /** Whether the finger (or dive key) is currently held down: the bee stays in
   *  hop mode while true, and climbs back to fly-over when released. */
  diving: boolean;
}

export const input: InputState = { hop: 0, diving: false };

export function resetInput(): void {
  input.hop = 0;
  input.diving = false;
}

/** Queue a lane hop, keeping the buffer bounded so a wild slide can't stack up. */
function queueHop(dir: number): void {
  input.hop = Math.max(-2, Math.min(2, input.hop + dir));
}

export function bindInput(el: HTMLElement): () => void {
  let activeId: number | null = null;
  let refX = 0;
  let diveKeyHeld = false;

  const onDown = (e: PointerEvent) => {
    if (activeId !== null) return; // ignore extra fingers
    e.preventDefault();
    activeId = e.pointerId;
    refX = e.clientX;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* capture unsupported — ignore */
    }
    // Finger down = dive into hop mode; stays down until the finger lifts.
    input.diving = true;
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    // One lane per this fraction of the screen width slid horizontally.
    const step = window.innerWidth * 0.11;
    let dx = e.clientX - refX;
    // Sliding right moves the bee screen-right (hop -1); left moves it
    // screen-left (hop +1). Advance the reference each step so a long slide
    // keeps issuing hops.
    while (dx >= step) {
      queueHop(-1);
      refX += step;
      dx -= step;
    }
    while (dx <= -step) {
      queueHop(1);
      refX -= step;
      dx += step;
    }
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    // Finger lifted: climb back to fly-over (unless a dive key is still held).
    input.diving = diveKeyHeld;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      if (!e.repeat) queueHop(1);
    } else if (e.key === "ArrowRight") {
      if (!e.repeat) queueHop(-1);
    } else if (e.key === " " || e.key === "ArrowDown" || e.key === "Spacebar") {
      diveKeyHeld = true;
      input.diving = true;
    } else {
      return;
    }
    e.preventDefault();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "ArrowDown" || e.key === "Spacebar") {
      diveKeyHeld = false;
      // Only clear the dive if no finger is still down.
      if (activeId === null) input.diving = false;
      e.preventDefault();
    }
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
  };
}
