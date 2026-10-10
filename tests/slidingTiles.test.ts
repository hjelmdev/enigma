import { describe, expect, it } from 'vitest';
import {
  EMPTY,
  applyEmptyMoves,
  canSlide,
  createState,
  emptyIndex,
  isReachable,
  legalMoves,
  minSolutionDistance,
  resetState,
  restoreState,
  serializeState,
  slide,
  slideDirection,
  validateConfig,
} from '../src/game/puzzles/slidingTiles';
import type {
  Cells,
  Dir,
  SlidingConfig,
  SlidingState,
} from '../src/game/puzzles/slidingTiles';

/** Solved arrangement: tiles 0..n-2 in reading order, blank bottom-right. */
function goalOf(rows: number, cols: number): number[] {
  const n = rows * cols;
  return [...Array.from({ length: n - 1 }, (_, i) => i), EMPTY];
}

/** Arrangement with the blank at `blank` and tiles in reading order elsewhere. */
function blankAt(rows: number, cols: number, blank: number): number[] {
  let next = 0;
  return Array.from({ length: rows * cols }, (_, i) =>
    i === blank ? EMPTY : next++,
  );
}

function makeConfig(
  rows: number,
  cols: number,
  initial: Cells,
  moveBudget = 10,
  goal: Cells = goalOf(rows, cols),
): SlidingConfig {
  return { id: `test-${rows}x${cols}`, rows, cols, goal, initial, moveBudget };
}

/** Solved 3x3 walk used across tests: goal -> left -> up. Optimal distance is 2. */
const TWO_AWAY_3X3: number[] = [0, 1, 2, 3, -1, 5, 6, 4, 7];
/** One slide from the 3x3 goal: tile 7 at index 8 slides left into the blank. */
const ONE_AWAY_3X3: number[] = [0, 1, 2, 3, 4, 5, 6, -1, 7];

const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);

describe('legalMoves', () => {
  it('3x3: corners have two neighbours, edges three, centre four', () => {
    expect(sorted(legalMoves(blankAt(3, 3, 0), 3, 3))).toEqual([1, 3]);
    expect(sorted(legalMoves(blankAt(3, 3, 8), 3, 3))).toEqual([5, 7]);
    expect(sorted(legalMoves(blankAt(3, 3, 1), 3, 3))).toEqual([0, 2, 4]);
    expect(sorted(legalMoves(blankAt(3, 3, 7), 3, 3))).toEqual([4, 6, 8]);
    expect(sorted(legalMoves(blankAt(3, 3, 4), 3, 3))).toEqual([1, 3, 5, 7]);
  });

  it('4x4: corners, edge and centre neighbour sets', () => {
    expect(sorted(legalMoves(blankAt(4, 4, 0), 4, 4))).toEqual([1, 4]);
    expect(sorted(legalMoves(blankAt(4, 4, 15), 4, 4))).toEqual([11, 14]);
    expect(sorted(legalMoves(blankAt(4, 4, 1), 4, 4))).toEqual([0, 2, 5]);
    expect(sorted(legalMoves(blankAt(4, 4, 7), 4, 4))).toEqual([3, 6, 11]);
    expect(sorted(legalMoves(blankAt(4, 4, 5), 4, 4))).toEqual([1, 4, 6, 9]);
  });

  it('3x4 (non-square): never wraps across a row boundary', () => {
    // Index 3 is the top-right corner; index 4 is the start of the next row.
    expect(sorted(legalMoves(blankAt(3, 4, 0), 3, 4))).toEqual([1, 4]);
    expect(sorted(legalMoves(blankAt(3, 4, 3), 3, 4))).toEqual([2, 7]);
    expect(sorted(legalMoves(blankAt(3, 4, 4), 3, 4))).toEqual([0, 5, 8]);
    expect(sorted(legalMoves(blankAt(3, 4, 7), 3, 4))).toEqual([3, 6, 11]);
    expect(sorted(legalMoves(blankAt(3, 4, 11), 3, 4))).toEqual([7, 10]);
  });

  it('returns no moves when there is no blank', () => {
    expect(legalMoves([0, 1, 2, 3], 2, 2)).toEqual([]);
  });
});

describe('slide', () => {
  it('a legal slide moves the tile into the blank, consumes one move and does not mutate input', () => {
    const config = makeConfig(3, 3, blankAt(3, 3, 4), 10);
    const state = createState(config);
    const before = structuredClone(state);

    const result = slide(config, state, 5);

    expect(result.outcome).toBe('moved');
    expect(result.from).toBe(5);
    expect(result.to).toBe(4);
    expect(result.state.cells).toEqual([0, 1, 2, 3, 4, -1, 5, 6, 7]);
    expect(result.state.movesLeft).toBe(9);
    expect(result.state.solved).toBe(false);
    expect(state).toEqual(before);
  });

  it('an illegal slide (non-adjacent tile) consumes no move and leaves cells untouched', () => {
    const config = makeConfig(3, 3, blankAt(3, 3, 4), 10);
    const state = createState(config);
    const cellsBefore = [...state.cells];

    const result = slide(config, state, 0);

    expect(result.outcome).toBe('illegal');
    expect(result.from).toBe(-1);
    expect(result.to).toBe(-1);
    expect(result.state.movesLeft).toBe(10);
    expect(result.state.cells).toEqual(cellsBefore);
    expect(state.cells).toEqual(cellsBefore);
  });

  it('tapping the blank itself is illegal', () => {
    const config = makeConfig(3, 3, blankAt(3, 3, 4), 10);
    const result = slide(config, createState(config), 4);
    expect(result.outcome).toBe('illegal');
    expect(result.state.movesLeft).toBe(10);
  });

  it('does not slide across the row boundary on a 3x4 board', () => {
    // Blank at index 3 (top-right). Index 4 is adjacent in the flat array only.
    const config = makeConfig(3, 4, blankAt(3, 4, 3), 10);
    const state = createState(config);
    expect(canSlide(state.cells, 3, 4, 4)).toBe(false);
    const result = slide(config, state, 4);
    expect(result.outcome).toBe('illegal');
    expect(result.state.cells).toEqual(state.cells);
    expect(result.state.movesLeft).toBe(10);
  });

  it('reports solved on the move that reaches the goal, and then refuses further slides', () => {
    const config = makeConfig(3, 3, ONE_AWAY_3X3, 5);
    const state = createState(config);
    expect(state.solved).toBe(false);

    const solvingMove = slide(config, state, 8);
    expect(solvingMove.outcome).toBe('solved');
    expect(solvingMove.state.solved).toBe(true);
    expect(solvingMove.state.cells).toEqual(goalOf(3, 3));
    expect(solvingMove.state.movesLeft).toBe(4);

    const after = slide(config, solvingMove.state, 7);
    expect(after.outcome).toBe('illegal');
    expect(after.state).toEqual(solvingMove.state);
  });

  it('exhausting the budget on an unsolved board resets to the initial cells and full budget', () => {
    const config = makeConfig(3, 3, blankAt(3, 3, 4), 1);
    const state = createState(config);

    const result = slide(config, state, 5);

    expect(result.outcome).toBe('exhausted');
    expect(result.state.cells).toEqual(config.initial);
    expect(result.state.movesLeft).toBe(config.moveBudget);
    expect(result.state.solved).toBe(false);
  });

  it('a wrong second move with budget 2 exhausts and resets, while the first move is still legal', () => {
    const config = makeConfig(3, 3, TWO_AWAY_3X3, 2);
    const first = slide(config, createState(config), 1);
    expect(first.outcome).toBe('moved');
    expect(first.state.movesLeft).toBe(1);

    // Blank is now at 1; sliding tile 0 right is a legal but non-solving move.
    const second = slide(config, first.state, 0);
    expect(second.outcome).toBe('exhausted');
    expect(second.state.cells).toEqual(TWO_AWAY_3X3);
    expect(second.state.movesLeft).toBe(2);
  });

  it('the optimal two-move solution solves on the second move with one move to spare', () => {
    const config = makeConfig(3, 3, TWO_AWAY_3X3, 3);
    // Blank at 4: tile 4 sits at index 7. Move it up, then tile 7 left.
    const first = slide(config, createState(config), 7);
    expect(first.outcome).toBe('moved');
    const second = slide(config, first.state, 8);
    expect(second.outcome).toBe('solved');
    expect(second.state.movesLeft).toBe(1);
  });
});

describe('slideDirection', () => {
  it('reports the direction the tile travels into the blank, without wrapping rows', () => {
    // 3x4 blank at 3: index 2 moves right, index 7 moves up.
    const cells = blankAt(3, 4, 3);
    expect(slideDirection(cells, 4, 2)).toBe('right');
    expect(slideDirection(cells, 4, 7)).toBe('up');
    expect(slideDirection(cells, 4, 4)).toBeNull();
  });
});

describe('isSolved, emptyIndex and state creation', () => {
  it('createState marks an initial arrangement equal to goal as solved', () => {
    const goal = goalOf(3, 3);
    const config = makeConfig(3, 3, goal, 4, goal);
    expect(createState(config).solved).toBe(true);
  });

  it('resetState returns a fresh copy of the initial arrangement', () => {
    const config = makeConfig(3, 3, TWO_AWAY_3X3, 7);
    const state = resetState(config);
    expect(state.cells).toEqual(TWO_AWAY_3X3);
    expect(state.cells).not.toBe(config.initial);
    expect(state.movesLeft).toBe(7);
  });

  it('emptyIndex locates the single blank', () => {
    expect(emptyIndex(blankAt(3, 4, 9))).toBe(9);
  });
});

describe('applyEmptyMoves', () => {
  it('walks the blank along a legal path and yields a reachable layout', () => {
    const goal = goalOf(3, 3);
    const walked = applyEmptyMoves(goal, 3, 3, ['left', 'up']);
    expect(walked).toEqual(TWO_AWAY_3X3);
    expect(isReachable(walked, goal, 3, 3)).toBe(true);
  });

  it('keeps every reachable 3x4 and 4x4 walk reachable from the goal', () => {
    const walks: Array<[number, number, Dir[]]> = [
      [3, 4, ['up', 'left', 'left', 'down', 'right', 'right', 'up']],
      [4, 4, ['left', 'up', 'up', 'right', 'down', 'down', 'left']],
    ];
    for (const [rows, cols, moves] of walks) {
      const goal = goalOf(rows, cols);
      const walked = applyEmptyMoves(goal, rows, cols, moves);
      expect(isReachable(walked, goal, rows, cols)).toBe(true);
    }
  });

  it('throws when a step would leave the board', () => {
    const goal = goalOf(3, 3);
    // Blank starts bottom-right, so down and right are off-board.
    expect(() => applyEmptyMoves(goal, 3, 3, ['down'])).toThrow(/illegal step/);
    expect(() => applyEmptyMoves(goal, 3, 3, ['right'])).toThrow(
      /illegal step/,
    );
  });

  it('throws on a 3x4 walk that would wrap from the last column into the next row', () => {
    // Blank bottom-right at 11. Up twice reaches index 3 (top-right corner).
    const goal = goalOf(3, 4);
    expect(() => applyEmptyMoves(goal, 3, 4, ['up', 'up', 'right'])).toThrow(
      /illegal step/,
    );
    // Same column count, but index 0 has no left neighbour on the same row.
    expect(() =>
      applyEmptyMoves(goal, 3, 4, ['up', 'left', 'left', 'left', 'up', 'left']),
    ).toThrow(/illegal step/);
  });

  it('throws on invalid cells', () => {
    expect(() => applyEmptyMoves([0, 1, -1, -1], 2, 2, [])).toThrow(
      /invalid cells/,
    );
  });
});

describe('isReachable', () => {
  it('is false for a single swapped pair of tiles (3x3, 4x4 and 3x4)', () => {
    const cases: Array<[number, number]> = [
      [3, 3],
      [4, 4],
      [3, 4],
    ];
    for (const [rows, cols] of cases) {
      const goal = goalOf(rows, cols);
      const swapped = [...goal];
      swapped[0] = goal[1];
      swapped[1] = goal[0];
      expect(isReachable(swapped, goal, rows, cols)).toBe(false);
      expect(isReachable(goal, goal, rows, cols)).toBe(true);
    }
  });

  it('is false for invalid cell arrays', () => {
    expect(isReachable([0, 1, 2], goalOf(3, 3), 3, 3)).toBe(false);
  });
});

describe('minSolutionDistance', () => {
  it('is 0 for the goal itself', () => {
    const goal = goalOf(3, 3);
    expect(minSolutionDistance(goal, goal, 3, 3, 5)).toBe(0);
  });

  it('is exact for a hand-checked one-move case', () => {
    expect(minSolutionDistance(ONE_AWAY_3X3, goalOf(3, 3), 3, 3, 5)).toBe(1);
  });

  it('is exact for a hand-checked two-move case on 3x3', () => {
    expect(minSolutionDistance(TWO_AWAY_3X3, goalOf(3, 3), 3, 3, 5)).toBe(2);
  });

  it('is exact for a hand-checked two-move case on 3x4 (non-square)', () => {
    // Goal blank at 11; walk up (blank -> 7) then left (blank -> 6).
    const goal = goalOf(3, 4);
    const walked = applyEmptyMoves(goal, 3, 4, ['up', 'left']);
    expect(minSolutionDistance(walked, goal, 3, 4, 5)).toBe(2);
  });

  it('returns null when the optimum exceeds the limit', () => {
    expect(minSolutionDistance(TWO_AWAY_3X3, goalOf(3, 3), 3, 3, 1)).toBeNull();
    const goal = goalOf(3, 3);
    expect(minSolutionDistance(goal, goal, 3, 3, 0)).toBe(0);
  });

  it('returns null for an unreachable arrangement', () => {
    const goal = goalOf(3, 3);
    const swapped = [...goal];
    swapped[0] = goal[1];
    swapped[1] = goal[0];
    expect(minSolutionDistance(swapped, goal, 3, 3, 50)).toBeNull();
  });

  it('is never more than a non-backtracking walk length and has the same parity', () => {
    const goal = goalOf(3, 3);
    // Square loop 8 -> 5 -> 4 -> 7 -> 8 followed by up, left, down. No reversals.
    const moves: Dir[] = ['up', 'left', 'down', 'right', 'up', 'left', 'down'];
    const walked = applyEmptyMoves(goal, 3, 3, moves);
    const distance = minSolutionDistance(walked, goal, 3, 3, 20);
    expect(distance).not.toBeNull();
    expect(distance!).toBeLessThanOrEqual(moves.length);
    expect(distance! % 2).toBe(moves.length % 2);
  });

  it('matches breadth-first search on every state within a few moves (3x3 and 3x4)', () => {
    for (const [rows, cols, depth] of [
      [3, 3, 6],
      [3, 4, 5],
    ] as const) {
      const goal = goalOf(rows, cols);
      const dist = bfsDistances(rows, cols, depth);
      expect(dist.size).toBeGreaterThan(10);
      for (const [key, d] of dist) {
        const cells = key.split(',').map(Number);
        expect(minSolutionDistance(cells, goal, rows, cols, 20)).toBe(d);
      }
    }
  });
});

/** Independent breadth-first oracle; neighbours computed here, not via production code. */
function bfsDistances(
  rows: number,
  cols: number,
  maxDepth: number,
): Map<string, number> {
  const goal = goalOf(rows, cols);
  const dist = new Map<string, number>([[goal.join(','), 0]]);
  let frontier: number[][] = [goal];
  for (let d = 1; d <= maxDepth; d++) {
    const next: number[][] = [];
    for (const cells of frontier) {
      const blank = cells.indexOf(EMPTY);
      const r = Math.floor(blank / cols);
      const c = blank % cols;
      const targets: number[] = [];
      if (r > 0) targets.push(blank - cols);
      if (r < rows - 1) targets.push(blank + cols);
      if (c > 0) targets.push(blank - 1);
      if (c < cols - 1) targets.push(blank + 1);
      for (const to of targets) {
        const moved = [...cells];
        moved[blank] = moved[to];
        moved[to] = EMPTY;
        const key = moved.join(',');
        if (!dist.has(key)) {
          dist.set(key, d);
          next.push(moved);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

describe('validateConfig', () => {
  it('accepts a solvable config whose budget covers the optimum', () => {
    const result = validateConfig(makeConfig(3, 3, TWO_AWAY_3X3, 2));
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.minDistance).toBe(2);
  });

  it('rejects a budget below the optimal distance', () => {
    const result = validateConfig(makeConfig(3, 3, TWO_AWAY_3X3, 1));
    expect(result.ok).toBe(false);
    expect(result.minDistance).toBeNull();
    expect(result.errors.join(' ')).toMatch(/exceeds moveBudget/);
  });

  it('rejects initial equal to goal', () => {
    const goal = goalOf(3, 3);
    const result = validateConfig(makeConfig(3, 3, goal, 5, goal));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('initial must differ from goal');
  });

  it('rejects an invalid initial arrangement (two blanks)', () => {
    const bad = [0, 1, 2, 3, -1, -1, 6, 7, 4];
    const result = validateConfig(makeConfig(3, 3, bad, 5));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('initial is not a valid arrangement');
  });

  it('rejects an unreachable goal', () => {
    const goal = goalOf(3, 3);
    const swapped = [...goal];
    swapped[0] = goal[1];
    swapped[1] = goal[0];
    const result = validateConfig(makeConfig(3, 3, TWO_AWAY_3X3, 9, swapped));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('goal is not reachable from initial');
    expect(result.minDistance).toBeNull();
  });

  it('rejects a non-positive move budget', () => {
    const result = validateConfig(makeConfig(3, 3, TWO_AWAY_3X3, 0));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('moveBudget'))).toBe(true);
  });
});

describe('serializeState and restoreState', () => {
  const config = makeConfig(
    3,
    4,
    applyEmptyMoves(goalOf(3, 4), 3, 4, ['up', 'left']),
    6,
  );

  it('round-trips a mid-game state through JSON', () => {
    // Walk left the blank at 6; index 7 is its right-hand neighbour.
    const moved = slide(config, createState(config), 7).state;
    expect(moved.solved).toBe(false);
    expect(moved.movesLeft).toBe(5);
    const raw = JSON.parse(JSON.stringify(serializeState(moved)));
    expect(restoreState(config, raw)).toEqual(moved);
  });

  it('round-trips a solved state, keeping its remaining budget', () => {
    const solvedConfig = makeConfig(3, 3, ONE_AWAY_3X3, 5);
    const solved = slide(solvedConfig, createState(solvedConfig), 8).state;
    const raw = JSON.parse(JSON.stringify(serializeState(solved)));
    expect(restoreState(solvedConfig, raw)).toEqual(solved);
  });

  it('serialize returns a copy, not a view of the live cells', () => {
    const state: SlidingState = createState(config);
    const serialized = serializeState(state);
    serialized.cells[0] = 99;
    expect(state.cells[0]).not.toBe(99);
  });

  it('falls back to a fresh state for non-object garbage', () => {
    const fallback = createState(config);
    for (const raw of [null, undefined, 'nope', 42, true]) {
      expect(restoreState(config, raw)).toEqual(fallback);
    }
  });

  it('falls back when cells are malformed or not a valid arrangement', () => {
    const fallback = createState(config);
    expect(
      restoreState(config, { cells: 'x', movesLeft: 3, solved: false }),
    ).toEqual(fallback);
    expect(restoreState(config, { movesLeft: 3, solved: false })).toEqual(
      fallback,
    );
    expect(
      restoreState(config, {
        cells: [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, -1],
        movesLeft: 3,
        solved: false,
      }),
    ).toEqual(fallback);
  });

  it('falls back for out-of-range or non-integer movesLeft on an unsolved state', () => {
    const fallback = createState(config);
    const cells = blankAt(3, 4, 3);
    expect(
      restoreState(config, { cells, movesLeft: 0, solved: false }),
    ).toEqual(fallback);
    expect(
      restoreState(config, { cells, movesLeft: 7, solved: false }),
    ).toEqual(fallback);
    expect(
      restoreState(config, { cells, movesLeft: 2.5, solved: false }),
    ).toEqual(fallback);
    expect(restoreState(config, { cells, solved: false })).toEqual(fallback);
  });

  it('falls back when an unsolved save is the goal itself or unreachable', () => {
    const fallback = createState(config);
    const goal = goalOf(3, 4);
    expect(
      restoreState(config, { cells: goal, movesLeft: 3, solved: false }),
    ).toEqual(fallback);
    const swapped = [...goal];
    swapped[0] = goal[1];
    swapped[1] = goal[0];
    expect(
      restoreState(config, { cells: swapped, movesLeft: 3, solved: false }),
    ).toEqual(fallback);
  });

  it('a solved save with an arrangement that is not the goal falls back', () => {
    const fallback = createState(config);
    expect(
      restoreState(config, {
        cells: blankAt(3, 4, 3),
        movesLeft: 3,
        solved: true,
      }),
    ).toEqual(fallback);
  });

  it('a solved save with a bad movesLeft keeps the solution and resets the budget', () => {
    const goal = goalOf(3, 4);
    const restored = restoreState(config, {
      cells: goal,
      movesLeft: 'x',
      solved: true,
    });
    expect(restored).toEqual({
      cells: goal,
      movesLeft: config.moveBudget,
      solved: true,
    });
  });
});
