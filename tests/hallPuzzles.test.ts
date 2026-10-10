import { describe, expect, it } from 'vitest';
import { RELIEF_PUZZLE, HALL_BALANCE } from '../src/game/hall/puzzles';
import {
  EMPTY,
  minSolutionDistance,
  validateConfig,
} from '../src/game/puzzles/slidingTiles';
import { checkPuzzle, puzzleFor } from '../src/game/puzzles/balanceScale';

describe('hall puzzle instances', () => {
  it('relief starts from a crafted, reachable layout within budget', () => {
    const v = validateConfig(RELIEF_PUZZLE);
    expect(v.ok).toBe(true);
    expect(RELIEF_PUZZLE.initial).toEqual([0, 1, 3, 4, EMPTY, 7, 6, 5, 2]);
    const d = minSolutionDistance(
      RELIEF_PUZZLE.initial,
      RELIEF_PUZZLE.goal,
      3,
      3,
      40,
    );
    expect(d).toBe(16);
    expect(RELIEF_PUZZLE.moveBudget).toBeGreaterThanOrEqual(2 * d!);
  });

  it('first balance weighing is the authored, checked instance', () => {
    const p = puzzleFor(HALL_BALANCE, { seed: 12345, attempt: 0 });
    expect(checkPuzzle(p, HALL_BALANCE).ok).toBe(true);
    expect(p.solutions.length).toBeGreaterThan(1);
  });
});
