/**
 * Generic sliding-tile puzzle engine.
 *
 * Pure and Phaser-free. Cells are row-major; tile ids are 0..n-2 and EMPTY
 * marks the single gap. Every rule derives from rows/cols, so 3x3, 3x4, 4x4
 * and so on share one code path. Inputs are never mutated.
 */

export const EMPTY = -1;

/** Row-major arrangement, length rows*cols, one EMPTY and tiles 0..n-2. */
export type Cells = readonly number[];

export interface SlidingConfig {
  id: string;
  rows: number;
  cols: number;
  /** Solved arrangement (any permutation, EMPTY may sit anywhere). */
  goal: Cells;
  /** Starting arrangement. */
  initial: Cells;
  /** Legal slides allowed per attempt. */
  moveBudget: number;
}

export interface SlidingState {
  cells: number[];
  movesLeft: number;
  solved: boolean;
}

export type SlideOutcome = 'illegal' | 'moved' | 'solved' | 'exhausted';

export interface SlideResult {
  state: SlidingState;
  outcome: SlideOutcome;
  /** Cell index of the tile that slid (-1 if illegal). */
  from: number;
  /** Former empty index the tile moved into (-1 if illegal). */
  to: number;
}

/** Direction a TILE moves into the empty cell. */
export type Dir = 'up' | 'down' | 'left' | 'right';

function isDimension(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

export function validateCells(cells: Cells, rows: number, cols: number): boolean {
  if (!isDimension(rows) || !isDimension(cols)) return false;
  const n = rows * cols;
  if (!Array.isArray(cells) || cells.length !== n) return false;
  const seen = new Array<boolean>(n).fill(false);
  let empties = 0;
  for (const value of cells) {
    if (!Number.isInteger(value)) return false;
    if (value === EMPTY) {
      empties += 1;
      continue;
    }
    if (value < 0 || value > n - 2 || seen[value]) return false;
    seen[value] = true;
  }
  return empties === 1;
}

export function createState(config: SlidingConfig): SlidingState {
  return {
    cells: [...config.initial],
    movesLeft: config.moveBudget,
    solved: isSolved(config.initial, config.goal),
  };
}

export function resetState(config: SlidingConfig): SlidingState {
  return createState(config);
}

export function emptyIndex(cells: Cells): number {
  return cells.indexOf(EMPTY);
}

/** Orthogonal neighbours of an index, without wrapping across rows. */
function neighborsOf(index: number, rows: number, cols: number): number[] {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const out: number[] = [];
  if (row > 0) out.push(index - cols);
  if (col > 0) out.push(index - 1);
  if (col < cols - 1) out.push(index + 1);
  if (row < rows - 1) out.push(index + cols);
  return out;
}

export function legalMoves(cells: Cells, rows: number, cols: number): number[] {
  const empty = emptyIndex(cells);
  if (empty < 0) return [];
  return neighborsOf(empty, rows, cols);
}

export function canSlide(
  cells: Cells,
  rows: number,
  cols: number,
  index: number,
): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= cells.length) return false;
  const empty = emptyIndex(cells);
  if (empty < 0 || index === empty) return false;
  return neighborsOf(empty, rows, cols).includes(index);
}

export function slideDirection(
  cells: Cells,
  cols: number,
  index: number,
): Dir | null {
  const empty = emptyIndex(cells);
  if (empty < 0 || !Number.isInteger(index)) return null;
  if (index < 0 || index >= cells.length || index === empty) return null;
  const diff = empty - index;
  if (diff === cols) return 'down';
  if (diff === -cols) return 'up';
  if (Math.floor(index / cols) === Math.floor(empty / cols)) {
    if (diff === 1) return 'right';
    if (diff === -1) return 'left';
  }
  return null;
}

function copyState(state: SlidingState): SlidingState {
  return { cells: [...state.cells], movesLeft: state.movesLeft, solved: state.solved };
}

export function slide(
  config: SlidingConfig,
  state: SlidingState,
  index: number,
): SlideResult {
  const { rows, cols, goal } = config;
  if (
    state.solved ||
    state.movesLeft <= 0 ||
    !canSlide(state.cells, rows, cols, index)
  ) {
    return { state: copyState(state), outcome: 'illegal', from: -1, to: -1 };
  }

  const empty = emptyIndex(state.cells);
  const next = [...state.cells];
  next[empty] = next[index];
  next[index] = EMPTY;
  const movesLeft = state.movesLeft - 1;

  if (isSolved(next, goal)) {
    return {
      state: { cells: next, movesLeft, solved: true },
      outcome: 'solved',
      from: index,
      to: empty,
    };
  }
  if (movesLeft === 0) {
    return {
      state: resetState(config),
      outcome: 'exhausted',
      from: index,
      to: empty,
    };
  }
  return {
    state: { cells: next, movesLeft, solved: false },
    outcome: 'moved',
    from: index,
    to: empty,
  };
}

export function isSolved(cells: Cells, goal: Cells): boolean {
  if (cells.length !== goal.length) return false;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] !== goal[i]) return false;
  }
  return true;
}

/**
 * Reachability by permutation parity, generalised to any rows/cols.
 *
 * - Horizontal slides keep the relative order of the tiles.
 * - A vertical slide moves one tile across cols-1 others.
 * So with odd cols the tile-inversion parity is invariant. With even cols
 * each vertical slide also changes the blank's row, so the invariant is
 * inversions + blank row (mod 2).
 */
function parityKey(cells: Cells, cols: number): number {
  let inversions = 0;
  const tiles: number[] = [];
  for (const value of cells) {
    if (value !== EMPTY) tiles.push(value);
  }
  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      if (tiles[i] > tiles[j]) inversions += 1;
    }
  }
  let key = inversions;
  if (cols % 2 === 0) {
    key += Math.floor(emptyIndex(cells) / cols);
  }
  return key % 2;
}

export function isReachable(
  from: Cells,
  goal: Cells,
  rows: number,
  cols: number,
): boolean {
  if (!validateCells(from, rows, cols) || !validateCells(goal, rows, cols)) {
    return false;
  }
  return parityKey(from, cols) === parityKey(goal, cols);
}

export function applyEmptyMoves(
  cells: Cells,
  rows: number,
  cols: number,
  moves: readonly Dir[],
): number[] {
  if (!validateCells(cells, rows, cols)) {
    throw new Error('applyEmptyMoves: invalid cells');
  }
  const next = [...cells];
  let empty = emptyIndex(next);
  for (const move of moves) {
    const row = Math.floor(empty / cols);
    const col = empty % cols;
    let targetRow = row;
    let targetCol = col;
    if (move === 'up') targetRow -= 1;
    else if (move === 'down') targetRow += 1;
    else if (move === 'left') targetCol -= 1;
    else targetCol += 1;
    if (targetRow < 0 || targetRow >= rows || targetCol < 0 || targetCol >= cols) {
      throw new Error(`applyEmptyMoves: illegal step ${move} from ${empty}`);
    }
    const target = targetRow * cols + targetCol;
    next[empty] = next[target];
    next[target] = EMPTY;
    empty = target;
  }
  return next;
}

/**
 * Linear conflict within one line: tiles that belong to this line and sit in
 * reversed order must leave it. Greedy removal gives a valid lower bound.
 * pairs = [current offset, goal offset], in current order.
 */
function lineConflictRemovals(pairs: Array<[number, number]>): number {
  const count = pairs.length;
  if (count < 2) return 0;
  const alive = new Array<boolean>(count).fill(true);
  let removed = 0;
  for (;;) {
    let worst = -1;
    let worstCount = 0;
    for (let a = 0; a < count; a++) {
      if (!alive[a]) continue;
      let conflicts = 0;
      for (let b = 0; b < count; b++) {
        if (b === a || !alive[b]) continue;
        if ((pairs[a][0] - pairs[b][0]) * (pairs[a][1] - pairs[b][1]) < 0) {
          conflicts += 1;
        }
      }
      if (conflicts > worstCount) {
        worstCount = conflicts;
        worst = a;
      }
    }
    if (worst < 0) break;
    alive[worst] = false;
    removed += 1;
  }
  return removed;
}

/** Manhattan distance plus linear conflicts (admissible). */
function heuristic(
  cells: Cells,
  goalPos: readonly number[],
  rows: number,
  cols: number,
): number {
  let manhattan = 0;
  for (let i = 0; i < cells.length; i++) {
    const tile = cells[i];
    if (tile === EMPTY) continue;
    const goalIndex = goalPos[tile];
    manhattan +=
      Math.abs(Math.floor(i / cols) - Math.floor(goalIndex / cols)) +
      Math.abs((i % cols) - (goalIndex % cols));
  }
  if (manhattan === 0) return 0;

  let conflicts = 0;
  for (let row = 0; row < rows; row++) {
    const pairs: Array<[number, number]> = [];
    for (let col = 0; col < cols; col++) {
      const tile = cells[row * cols + col];
      if (tile === EMPTY) continue;
      const goalIndex = goalPos[tile];
      if (Math.floor(goalIndex / cols) === row) {
        pairs.push([col, goalIndex % cols]);
      }
    }
    conflicts += lineConflictRemovals(pairs);
  }
  for (let col = 0; col < cols; col++) {
    const pairs: Array<[number, number]> = [];
    for (let row = 0; row < rows; row++) {
      const tile = cells[row * cols + col];
      if (tile === EMPTY) continue;
      const goalIndex = goalPos[tile];
      if (goalIndex % cols === col) {
        pairs.push([row, Math.floor(goalIndex / cols)]);
      }
    }
    conflicts += lineConflictRemovals(pairs);
  }
  return manhattan + 2 * conflicts;
}

/**
 * Exact optimal number of slides from `from` to `goal`, via IDA* with a
 * Manhattan + linear-conflict heuristic. Returns null if unreachable or if
 * the optimum exceeds `limit`.
 */
export function minSolutionDistance(
  from: Cells,
  goal: Cells,
  rows: number,
  cols: number,
  limit: number,
): number | null {
  if (!validateCells(from, rows, cols) || !validateCells(goal, rows, cols)) {
    return null;
  }
  if (isSolved(from, goal)) return 0;
  if (!isReachable(from, goal, rows, cols)) return null;

  const goalPos = new Array<number>(rows * cols).fill(-1);
  goal.forEach((tile, index) => {
    if (tile !== EMPTY) goalPos[tile] = index;
  });

  const work = [...from];
  let best = -1;

  // Returns the smallest f that exceeded `bound` (or Infinity).
  const search = (g: number, bound: number, blank: number, prev: number): number => {
    const h = heuristic(work, goalPos, rows, cols);
    const f = g + h;
    if (f > bound) return f;
    if (h === 0) {
      if (best < 0 || g < best) best = g;
      return f;
    }
    let min = Number.POSITIVE_INFINITY;
    for (const next of neighborsOf(blank, rows, cols)) {
      if (next === prev) continue;
      work[blank] = work[next];
      work[next] = EMPTY;
      const t = search(g + 1, bound, next, blank);
      work[next] = work[blank];
      work[blank] = EMPTY;
      if (t < min) min = t;
    }
    return min;
  };

  let bound = heuristic(work, goalPos, rows, cols);
  const startBlank = emptyIndex(work);
  while (bound <= limit) {
    const nextBound = search(0, bound, startBlank, -1);
    if (best >= 0) return best;
    if (nextBound === Number.POSITIVE_INFINITY) return null;
    bound = nextBound;
  }
  return null;
}

export function validateConfig(config: SlidingConfig): {
  ok: boolean;
  minDistance: number | null;
  errors: string[];
} {
  const errors: string[] = [];
  const { rows, cols, moveBudget, initial, goal } = config;
  if (!Number.isInteger(rows) || rows < 2) errors.push('rows must be an integer >= 2');
  if (!Number.isInteger(cols) || cols < 2) errors.push('cols must be an integer >= 2');
  if (!Number.isInteger(moveBudget) || moveBudget < 1) {
    errors.push('moveBudget must be an integer >= 1');
  }
  if (!validateCells(initial, rows, cols)) errors.push('initial is not a valid arrangement');
  if (!validateCells(goal, rows, cols)) errors.push('goal is not a valid arrangement');
  if (errors.length > 0) return { ok: false, minDistance: null, errors };

  if (isSolved(initial, goal)) errors.push('initial must differ from goal');

  let minDistance: number | null = null;
  if (!isReachable(initial, goal, rows, cols)) {
    errors.push('goal is not reachable from initial');
  } else {
    minDistance = minSolutionDistance(initial, goal, rows, cols, moveBudget);
    if (minDistance === null) {
      errors.push(`optimal solution exceeds moveBudget ${moveBudget}`);
    }
  }
  return { ok: errors.length === 0, minDistance, errors };
}

export function serializeState(state: SlidingState): {
  cells: number[];
  movesLeft: number;
  solved: boolean;
} {
  return { cells: [...state.cells], movesLeft: state.movesLeft, solved: state.solved };
}

export function restoreState(config: SlidingConfig, raw: unknown): SlidingState {
  const fallback = createState(config);
  if (typeof raw !== 'object' || raw === null) return fallback;
  const { cells, movesLeft, solved } = raw as {
    cells?: unknown;
    movesLeft?: unknown;
    solved?: unknown;
  };
  const { rows, cols, goal, moveBudget } = config;
  if (!Array.isArray(cells) || !validateCells(cells as number[], rows, cols)) {
    return fallback;
  }
  const arrangement = cells as number[];

  if (solved === true) {
    if (!isSolved(arrangement, goal)) return fallback;
    const solvedMoves =
      typeof movesLeft === 'number' &&
      Number.isInteger(movesLeft) &&
      movesLeft >= 0 &&
      movesLeft <= moveBudget
        ? movesLeft
        : moveBudget;
    return { cells: [...arrangement], movesLeft: solvedMoves, solved: true };
  }

  if (
    typeof movesLeft !== 'number' ||
    !Number.isInteger(movesLeft) ||
    movesLeft < 1 ||
    movesLeft > moveBudget
  ) {
    return fallback;
  }
  if (isSolved(arrangement, goal)) return fallback;
  if (!isReachable(arrangement, goal, rows, cols)) return fallback;
  return { cells: [...arrangement], movesLeft, solved: false };
}
