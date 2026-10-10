import { describe, expect, it } from 'vitest';
import { RELIEF_PUZZLE, HALL_BALANCE } from '../src/game/hall/puzzles';
import {
  EMPTY,
  applyEmptyMoves,
  minSolutionDistance,
  validateConfig,
} from '../src/game/puzzles/slidingTiles';
import type { Dir, SlidingConfig } from '../src/game/puzzles/slidingTiles';
import { checkPuzzle, puzzleFor } from '../src/game/puzzles/balanceScale';

/** Former relief scramble (optimal 16), kept as a harder regression case. */
const OLD_RELIEF_SCRAMBLE: Dir[] = [
  'up',
  'left',
  'left',
  'up',
  'right',
  'down',
  'right',
  'up',
  'left',
  'left',
  'down',
  'right',
  'down',
  'right',
  'up',
  'left',
];

function solvedGoal(rows: number, cols: number): number[] {
  return Array.from({ length: rows * cols }, (_, i) =>
    i < rows * cols - 1 ? i : EMPTY,
  );
}

describe('hall puzzle instances', () => {
  it('relief starts from the crafted layout, optimal 7, budget 14', () => {
    const v = validateConfig(RELIEF_PUZZLE);
    expect(v.ok).toBe(true);
    expect(RELIEF_PUZZLE.initial).toEqual([0, EMPTY, 4, 3, 2, 1, 6, 7, 5]);
    expect(RELIEF_PUZZLE.initial[0]).toBe(0);
    expect(RELIEF_PUZZLE.initial[8]).not.toBe(EMPTY);

    const d = minSolutionDistance(
      RELIEF_PUZZLE.initial,
      RELIEF_PUZZLE.goal,
      3,
      3,
      40,
    );
    expect(d).toBe(7);
    expect(v.minDistance).toBe(7);
    expect(RELIEF_PUZZLE.moveBudget).toBe(14);
    expect(RELIEF_PUZZLE.moveBudget).toBeGreaterThanOrEqual(d!);
    expect(RELIEF_PUZZLE.moveBudget).toBeLessThanOrEqual(2 * d! + 2);
  });

  it('first balance weighing is the authored, checked instance', () => {
    const p = puzzleFor(HALL_BALANCE, { seed: 12345, attempt: 0 });
    expect(checkPuzzle(p, HALL_BALANCE).ok).toBe(true);
    expect(p.solutions.length).toBeGreaterThan(1);
  });

  it('the engine still validates harder reachable layouts within 2x their distance', () => {
    const cases: Array<{
      name: string;
      rows: number;
      cols: number;
      moves: Dir[];
      minD: number;
    }> = [
      {
        name: '3x3 old relief',
        rows: 3,
        cols: 3,
        moves: OLD_RELIEF_SCRAMBLE,
        minD: 16,
      },
      {
        name: '4x4 walk',
        rows: 4,
        cols: 4,
        moves: [
          'up',
          'up',
          'up',
          'left',
          'down',
          'left',
          'left',
          'up',
          'right',
          'down',
          'right',
          'down',
          'down',
          'left',
          'up',
          'right',
          'up',
          'right',
          'up',
          'left',
          'down',
          'down',
          'left',
          'up',
        ],
        minD: 16,
      },
      {
        name: '4x4 walk long',
        rows: 4,
        cols: 4,
        moves: [
          'left',
          'up',
          'right',
          'up',
          'up',
          'left',
          'down',
          'down',
          'right',
          'up',
          'up',
          'left',
          'down',
          'right',
          'up',
          'left',
          'down',
          'down',
          'down',
          'left',
          'up',
          'left',
          'up',
          'up',
        ],
        minD: 22,
      },
      {
        name: '3x4 walk',
        rows: 3,
        cols: 4,
        moves: [
          'left',
          'up',
          'right',
          'up',
          'left',
          'down',
          'left',
          'up',
          'left',
          'down',
          'down',
          'right',
          'up',
          'right',
          'down',
          'left',
          'up',
          'up',
          'left',
          'down',
        ],
        minD: 20,
      },
    ];

    for (const c of cases) {
      const goal = solvedGoal(c.rows, c.cols);
      const initial = applyEmptyMoves(goal, c.rows, c.cols, c.moves);
      const d = minSolutionDistance(initial, goal, c.rows, c.cols, 60);
      expect(d, c.name).toBe(c.minD);
      expect(d!, c.name).toBeGreaterThanOrEqual(c.minD);

      const config: SlidingConfig = {
        id: `regression-${c.name}`,
        rows: c.rows,
        cols: c.cols,
        goal,
        initial,
        moveBudget: 2 * d!,
      };
      const v = validateConfig(config);
      expect(v.ok, `${c.name}: ${v.errors.join('; ')}`).toBe(true);
      expect(v.minDistance, c.name).toBe(d);
    }
  });
});
