/**
 * Imperative score-fly bus: the ScoreFlow overlay registers its `pop` function
 * here so game logic can launch a small "+N" chip from a collected flower's
 * on-screen position. The chip flies into the single large running total, which
 * counts up live. `x`/`y` are CSS pixels (flower position projected to screen).
 */
export const scoreFx: {
  pop: (x: number, y: number, points: number, combo: number) => void;
} = {
  pop: () => {},
};
