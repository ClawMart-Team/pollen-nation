/**
 * Touch input for Small World, kept outside React. Designed for one-handed play:
 *  • Touching the screen makes the bee dive down onto the flower it is passing.
 *  • Keeping the finger down and sliding left/right hops the bee between lanes —
 *    one lane per slide step, so a longer slide crosses several lanes.
 * Desktop mirrors this with the arrow keys (left/right hop) and space / down to
 * dive.
 */
export interface InputState {
  /** Pending lane hops since the last sim step. Positive = screen-left,
   *  negative = screen-right. One hop is consumed per step. */
  hop: number;
  /** Pending dive (drop onto the flower to pollinate it). */
  dive: boolean;
}

export const input: InputState = { hop: 0, dive: false };

export function resetInput(): void {
  input.hop = 0;
  input.dive = false;
}

/** Queue a lane hop, keeping the buffer bounded so a wild slide can't stack up. */
function queueHop(dir: number): void {
  input.hop = Math.max(-2, Math.min(2, input.hop + dir));
}

export function bindInput(el: HTMLElement): () => void {
  let activeId: number | null = null;
  let refX = 0;

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
    // A touch = a dive onto the flower the bee is over.
    input.dive = true;
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
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft") {
      queueHop(1);
    } else if (e.key === "ArrowRight") {
      queueHop(-1);
    } else if (e.key === " " || e.key === "ArrowDown" || e.key === "Spacebar") {
      input.dive = true;
    } else {
      return;
    }
    e.preventDefault();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
  };
}
