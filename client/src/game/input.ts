/**
 * Touch input for Small World, kept outside React. A tap on the left half of
 * the screen hops the bee one lane left; a tap on the right half hops one lane
 * right. One tap = one lane.
 */
export interface InputState {
  /** Pending hop since the last sim step: -1 (left), +1 (right), 0 (none). */
  hop: number;
  /** Pending forward jump (leap over the next row). */
  jump: boolean;
}

export const input: InputState = { hop: 0, jump: false };

export function resetInput(): void {
  input.hop = 0;
  input.jump = false;
}

export function bindInput(el: HTMLElement): () => void {
  const onDown = (e: PointerEvent) => {
    e.preventDefault();
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Jump zones: the top of the screen, or the middle of the bottom (thumb-
    // friendly on mobile) — both leap forward over a row.
    if (e.clientY < h * 0.22) {
      input.jump = true;
      return;
    }
    if (e.clientY > h * 0.7 && e.clientX > w / 3 && e.clientX < (2 * w) / 3) {
      input.jump = true;
      return;
    }
    // Camera looks along +Z, so world +X is on the screen's left. Tapping the
    // left half should hop toward screen-left (increasing lane/X), and vice
    // versa, so the bee moves toward the tapped side.
    input.hop = e.clientX < w / 2 ? 1 : -1;
  };
  // Desktop: arrow keys hop toward the pressed direction (left = screen-left);
  // up arrow jumps forward over a row.
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === "ArrowLeft") {
      input.hop = 1;
    } else if (e.key === "ArrowRight") {
      input.hop = -1;
    } else if (e.key === "ArrowUp") {
      input.jump = true;
    } else {
      return;
    }
    e.preventDefault();
  };
  el.addEventListener("pointerdown", onDown);
  window.addEventListener("keydown", onKey);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    window.removeEventListener("keydown", onKey);
  };
}
