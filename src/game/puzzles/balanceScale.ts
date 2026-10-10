/**
 * Vågens hemlighet — the entrance hall's bronze balance.
 *
 * A sealed vessel sits in one pan. The player loads sculpted weights (scarab,
 * falcon, lotus) from a shelf into the other pan and commits the attempt by
 * pulling a lever; nothing about the balance is revealed before that. Carved
 * reliefs above the scale state equal-weight relations ("one scarab balances
 * three lotus") and what the vessel balances. The vessel's stated contents are
 * never directly available on the shelf, so the player has to substitute
 * equivalent weights using the reliefs.
 *
 * Every puzzle is constructed AND checked:
 * - the relations fix every weight ratio (the answer can be reasoned out),
 * - at least one inventory-limited solution exists, and every balancing
 *   selection is accepted (not just one hard-coded answer),
 * - the vessel's literal composition cannot simply be copied from the shelf,
 * - emptying the whole shelf onto the pan is not a solution,
 * - the minimum number of relief substitutions matches the difficulty.
 *
 * Generation is deterministic per seed. A failed weighing (reroll policy)
 * advances the attempt counter, which derives a new seed and so a new puzzle;
 * moving weights around without pulling the lever never changes the puzzle.
 * Pure TypeScript, no Phaser dependency.
 */

export const WEIGHT_KINDS = ['scarab', 'falcon', 'lotus'] as const;
export type WeightKind = (typeof WEIGHT_KINDS)[number];
export type Pieces = Record<WeightKind, number>;

/** One side of a carved relation. `target` counts the sealed vessel. */
export interface ClueSide {
  pieces: Pieces;
  target: number;
}

export interface Clue {
  left: ClueSide;
  right: ClueSide;
}

export interface BalancePuzzle {
  seed: number;
  weights: Pieces;
  /** Weight of the sealed vessel. */
  target: number;
  /** What the vessel is carved as balancing (never placeable as is). */
  targetPieces: Pieces;
  /** Relations between weights; the vessel relation is NOT included here. */
  relations: Clue[];
  /** Weights available on the shelf. */
  inventory: Pieces;
  /** Every inventory-limited selection that balances the vessel. */
  solutions: Pieces[];
  /** Minimum relief substitutions from the vessel relation to a placeable set. */
  depth: number;
}

export type AttemptPolicy = 'reroll-on-fail' | 'retry-same';

export interface BalanceConfig {
  /** Inclusive range for an individual weight (in hidden units). */
  weightRange: [number, number];
  /** Number of weight relations carved above the scale (≥ 2 for 3 kinds). */
  relationCount: number;
  /** Max pieces per side of a relation. */
  maxSidePieces: number;
  /** Pieces in the vessel relation. */
  targetPieces: [number, number];
  /** Shelf count per kind. */
  inventory: [number, number];
  /** Required substitution depth (inclusive range). */
  depth: [number, number];
  /** Upper bound on distinct balancing selections (keeps guessing pointless). */
  maxSolutions: number;
  attemptPolicy: AttemptPolicy;
  /** Optional hand-authored puzzle used for attempt 0. Must pass checkPuzzle. */
  authored?: AuthoredBalance;
  /** Candidates tried per seed before falling back. */
  maxCandidates: number;
}

export interface AuthoredBalance {
  weights: Pieces;
  targetPieces: Pieces;
  relations: Clue[];
  inventory: Pieces;
}

export interface BalanceState {
  seed: number;
  attempt: number;
  placed: Pieces;
  solved: boolean;
}

export type LeverOutcome = 'balanced' | 'too-light' | 'too-heavy';

export interface LeverResult {
  outcome: LeverOutcome;
  /** State after the weighing (rerolled on failure under reroll policy). */
  state: BalanceState;
  /** The puzzle the weighing was judged against. */
  judged: BalancePuzzle;
  /** The puzzle now on display (new one after a reroll). */
  puzzle: BalancePuzzle;
  rerolled: boolean;
}

// -- Small helpers -------------------------------------------------------------

export function pieces(
  scarab = 0,
  falcon = 0,
  lotus = 0,
): Pieces {
  return { scarab, falcon, lotus };
}

export function emptyPieces(): Pieces {
  return pieces();
}

export function countPieces(p: Pieces) {
  return WEIGHT_KINDS.reduce((n, k) => n + p[k], 0);
}

export function weightOf(p: Pieces, weights: Pieces) {
  return WEIGHT_KINDS.reduce((n, k) => n + p[k] * weights[k], 0);
}

export function fits(p: Pieces, inventory: Pieces) {
  return WEIGHT_KINDS.every((k) => p[k] >= 0 && p[k] <= inventory[k]);
}

export function samePieces(a: Pieces, b: Pieces) {
  return WEIGHT_KINDS.every((k) => a[k] === b[k]);
}

function key(p: Pieces) {
  return WEIGHT_KINDS.map((k) => p[k]).join(',');
}

function side(p: Pieces, target = 0): ClueSide {
  return { pieces: { ...p }, target };
}

/** Weight of one side of a clue given the weights and vessel weight. */
export function sideWeight(s: ClueSide, weights: Pieces, target: number) {
  return weightOf(s.pieces, weights) + s.target * target;
}

/** Deterministic 32-bit PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seed for a given attempt; attempt 0 uses the base seed. */
export function attemptSeed(baseSeed: number, attempt: number) {
  if (attempt === 0) return baseSeed >>> 0;
  let h = (baseSeed ^ Math.imul(attempt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

// -- Analysis ------------------------------------------------------------------

/** All selections within the inventory that weigh exactly `target`. */
export function allSolutions(
  weights: Pieces,
  target: number,
  inventory: Pieces,
): Pieces[] {
  const out: Pieces[] = [];
  for (let s = 0; s <= inventory.scarab; s++)
    for (let f = 0; f <= inventory.falcon; f++)
      for (let l = 0; l <= inventory.lotus; l++) {
        const p = pieces(s, f, l);
        if (countPieces(p) > 0 && weightOf(p, weights) === target) out.push(p);
      }
  return out;
}

/**
 * True when the relations pin down every weight ratio, i.e. the difference
 * vectors (left − right) span a space of dimension kinds − 1. Then any
 * weights consistent with the carvings are proportional to the real ones, so
 * the player can deduce the answer without guessing.
 */
export function relationsDetermineRatios(relations: Clue[]) {
  const rows = relations
    .filter((c) => c.left.target === 0 && c.right.target === 0)
    .map((c) => WEIGHT_KINDS.map((k) => c.left.pieces[k] - c.right.pieces[k]));
  return rank(rows) === WEIGHT_KINDS.length - 1;
}

function rank(rows: number[][]) {
  const m = rows.map((r) => r.slice());
  let r = 0;
  const cols = WEIGHT_KINDS.length;
  for (let c = 0; c < cols && r < m.length; c++) {
    let pivot = -1;
    for (let i = r; i < m.length; i++)
      if (Math.abs(m[i][c]) > 1e-9) {
        pivot = i;
        break;
      }
    if (pivot < 0) continue;
    [m[r], m[pivot]] = [m[pivot], m[r]];
    for (let i = 0; i < m.length; i++) {
      if (i === r) continue;
      const f = m[i][c] / m[r][c];
      for (let j = c; j < cols; j++) m[i][j] -= f * m[r][j];
    }
    r++;
  }
  return r;
}

/**
 * Minimum number of relief substitutions (replace one side of a relation with
 * the other, either direction) that turn the vessel's carved composition into
 * something the shelf can supply. Returns null if no placeable set is reachable
 * within `maxPieces`. This is the "reasoning path" difficulty.
 */
export function substitutionDepth(
  start: Pieces,
  relations: Clue[],
  inventory: Pieces,
  maxPieces = 14,
  maxDepth = 6,
): number | null {
  const rules: Array<[Pieces, Pieces]> = [];
  for (const c of relations) {
    if (c.left.target || c.right.target) continue;
    rules.push([c.left.pieces, c.right.pieces], [c.right.pieces, c.left.pieces]);
  }
  const seen = new Set([key(start)]);
  let frontier = [start];
  for (let d = 0; d <= maxDepth; d++) {
    const next: Pieces[] = [];
    for (const p of frontier) {
      if (fits(p, inventory)) return d;
      for (const [from, to] of rules) {
        if (!WEIGHT_KINDS.every((k) => p[k] >= from[k])) continue;
        const q = emptyPieces();
        for (const k of WEIGHT_KINDS) q[k] = p[k] - from[k] + to[k];
        if (countPieces(q) > maxPieces) continue;
        const id = key(q);
        if (seen.has(id)) continue;
        seen.add(id);
        next.push(q);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

export interface PuzzleCheck {
  ok: boolean;
  errors: string[];
}

/** Validates a puzzle against the construction rules described above. */
export function checkPuzzle(
  p: BalancePuzzle,
  config?: Pick<BalanceConfig, 'depth' | 'maxSolutions'>,
): PuzzleCheck {
  const errors: string[] = [];
  const kinds = new Set(WEIGHT_KINDS.map((k) => p.weights[k]));
  if (WEIGHT_KINDS.some((k) => !(p.weights[k] > 0)))
    errors.push('weights must be positive');
  if (kinds.size !== WEIGHT_KINDS.length)
    errors.push('weights must be distinct');
  for (const c of p.relations) {
    const l = sideWeight(c.left, p.weights, p.target);
    const r = sideWeight(c.right, p.weights, p.target);
    if (l !== r) errors.push('a relation does not balance');
  }
  if (weightOf(p.targetPieces, p.weights) !== p.target)
    errors.push('vessel relation does not balance');
  if (!relationsDetermineRatios(p.relations))
    errors.push('relations do not determine every weight ratio');
  for (const k of WEIGHT_KINDS)
    if (
      !p.relations.some((c) => c.left.pieces[k] > 0 || c.right.pieces[k] > 0)
    )
      errors.push(`${k} never appears in a relation`);
  if (fits(p.targetPieces, p.inventory))
    errors.push('vessel composition can be copied straight from the shelf');
  const solutions = allSolutions(p.weights, p.target, p.inventory);
  if (!solutions.length) errors.push('no solution within the shelf');
  if (config && solutions.length > config.maxSolutions)
    errors.push('too many solutions');
  if (weightOf(p.inventory, p.weights) === p.target)
    errors.push('the whole shelf balances (trivial)');
  const depth = substitutionDepth(p.targetPieces, p.relations, p.inventory);
  if (depth === null) errors.push('no substitution path to a placeable set');
  else if (config && (depth < config.depth[0] || depth > config.depth[1]))
    errors.push('substitution depth outside configured difficulty');
  if (solutions.map(key).join('|') !== p.solutions.map(key).join('|'))
    errors.push('stored solutions are stale');
  return { ok: errors.length === 0, errors };
}

// -- Generation ----------------------------------------------------------------

export const FIRST_HALL_BALANCE: BalanceConfig = {
  weightRange: [1, 6],
  relationCount: 2,
  maxSidePieces: 3,
  targetPieces: [2, 3],
  inventory: [1, 4],
  depth: [1, 2],
  maxSolutions: 5,
  attemptPolicy: 'reroll-on-fail',
  maxCandidates: 400,
  // Hand-authored first weighing. Reliefs: one scarab balances three lotus;
  // a scarab with a lotus balances two falcons; the vessel balances two
  // scarabs. The shelf has a single scarab, so the player must substitute
  // (e.g. scarab + three lotus, or two falcons + two lotus).
  authored: {
    weights: pieces(3, 2, 1),
    targetPieces: pieces(2, 0, 0),
    relations: [
      { left: side(pieces(1, 0, 0)), right: side(pieces(0, 0, 3)) },
      { left: side(pieces(1, 0, 1)), right: side(pieces(0, 2, 0)) },
    ],
    inventory: pieces(1, 2, 4),
  },
};

function finish(
  seed: number,
  a: AuthoredBalance,
): BalancePuzzle {
  const target = weightOf(a.targetPieces, a.weights);
  return {
    seed,
    weights: { ...a.weights },
    target,
    targetPieces: { ...a.targetPieces },
    relations: a.relations.map((c) => ({
      left: side(c.left.pieces, c.left.target),
      right: side(c.right.pieces, c.right.target),
    })),
    inventory: { ...a.inventory },
    solutions: allSolutions(a.weights, target, a.inventory),
    depth:
      substitutionDepth(a.targetPieces, a.relations, a.inventory) ?? -1,
  };
}

/** Every reduced equal-weight relation with disjoint sides. */
function candidateRelations(weights: Pieces, maxSide: number): Clue[] {
  const sides: Pieces[] = [];
  const max = maxSide;
  for (let s = 0; s <= max; s++)
    for (let f = 0; f <= max - s; f++)
      for (let l = 0; l <= max - s - f; l++)
        if (s + f + l > 0) sides.push(pieces(s, f, l));
  const out: Clue[] = [];
  const seen = new Set<string>();
  for (const a of sides)
    for (const b of sides) {
      if (WEIGHT_KINDS.some((k) => a[k] > 0 && b[k] > 0)) continue;
      if (weightOf(a, weights) !== weightOf(b, weights)) continue;
      const all = WEIGHT_KINDS.flatMap((k) => [a[k], b[k]]).filter((n) => n);
      if (all.reduce(gcd) !== 1) continue;
      // Put the side with fewer pieces on the left ("one scarab = three lotus").
      const [l, r] = countPieces(a) <= countPieces(b) ? [a, b] : [b, a];
      const id = `${key(l)}=${key(r)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ left: side(l), right: side(r) });
    }
  return out;
}

function int(rand: () => number, [lo, hi]: [number, number]) {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

function shuffle<T>(rand: () => number, items: T[]) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function tryCandidate(
  rand: () => number,
  config: BalanceConfig,
  seed: number,
): BalancePuzzle | null {
  const values = shuffle(
    rand,
    Array.from(
      { length: config.weightRange[1] - config.weightRange[0] + 1 },
      (_, i) => config.weightRange[0] + i,
    ),
  ).slice(0, WEIGHT_KINDS.length);
  if (values.length < WEIGHT_KINDS.length) return null;
  if (values.reduce(gcd) !== 1) return null;
  const weights = pieces(values[0], values[1], values[2]);
  const pool = shuffle(rand, candidateRelations(weights, config.maxSidePieces));
  if (pool.length < config.relationCount) return null;
  const relations = pool.slice(0, config.relationCount);
  if (!relationsDetermineRatios(relations)) return null;

  const targetPieces = emptyPieces();
  const n = int(rand, config.targetPieces);
  for (let i = 0; i < n; i++)
    targetPieces[WEIGHT_KINDS[Math.floor(rand() * WEIGHT_KINDS.length)]]++;
  const inventory = pieces(
    int(rand, config.inventory),
    int(rand, config.inventory),
    int(rand, config.inventory),
  );
  const p = finish(seed, { weights, targetPieces, relations, inventory });
  return checkPuzzle(p, config).ok ? p : null;
}

/**
 * Builds the puzzle for one seed. Bounded retries; if no candidate passes,
 * falls back to the authored puzzle (or a fixed safe instance).
 */
export function generateBalancePuzzle(
  config: BalanceConfig,
  seed: number,
): BalancePuzzle {
  const rand = rng(seed);
  for (let i = 0; i < config.maxCandidates; i++) {
    const p = tryCandidate(rand, config, seed);
    if (p) return p;
  }
  return finish(seed, config.authored ?? FIRST_HALL_BALANCE.authored!);
}

/** The puzzle shown for a state: authored for attempt 0, generated after. */
export function puzzleFor(
  config: BalanceConfig,
  state: Pick<BalanceState, 'seed' | 'attempt'>,
): BalancePuzzle {
  const seed = attemptSeed(state.seed, state.attempt);
  if (state.attempt === 0 && config.authored)
    return finish(seed, config.authored);
  return generateBalancePuzzle(config, seed);
}

// -- Play ----------------------------------------------------------------------

export function createBalanceState(seed: number): BalanceState {
  return { seed: seed >>> 0, attempt: 0, placed: emptyPieces(), solved: false };
}

/** Moves one weight from the shelf to the pan. No feedback is produced. */
export function addWeight(
  state: BalanceState,
  puzzle: BalancePuzzle,
  kind: WeightKind,
): BalanceState {
  if (state.solved || state.placed[kind] >= puzzle.inventory[kind])
    return state;
  return { ...state, placed: { ...state.placed, [kind]: state.placed[kind] + 1 } };
}

/** Returns one weight from the pan to the shelf. No feedback is produced. */
export function removeWeight(
  state: BalanceState,
  kind: WeightKind,
): BalanceState {
  if (state.solved || state.placed[kind] <= 0) return state;
  return { ...state, placed: { ...state.placed, [kind]: state.placed[kind] - 1 } };
}

/**
 * The single commit action. Judges the pan against the vessel; on success the
 * state is solved (idempotent afterwards). On failure, the reroll policy
 * advances to a new deterministic puzzle and clears the pan.
 */
export function pullLever(
  config: BalanceConfig,
  state: BalanceState,
): LeverResult {
  const judged = puzzleFor(config, state);
  if (state.solved)
    return { outcome: 'balanced', state, judged, puzzle: judged, rerolled: false };
  const placed = weightOf(state.placed, judged.weights);
  if (placed === judged.target && countPieces(state.placed) > 0) {
    const next = { ...state, solved: true };
    return { outcome: 'balanced', state: next, judged, puzzle: judged, rerolled: false };
  }
  const outcome: LeverOutcome = placed < judged.target ? 'too-light' : 'too-heavy';
  if (config.attemptPolicy === 'reroll-on-fail') {
    const next: BalanceState = {
      ...state,
      attempt: state.attempt + 1,
      placed: emptyPieces(),
    };
    return {
      outcome,
      state: next,
      judged,
      puzzle: puzzleFor(config, next),
      rerolled: true,
    };
  }
  return { outcome, state, judged, puzzle: judged, rerolled: false };
}

/** Sanitises persisted state against the puzzle it would display. */
export function restoreBalanceState(
  config: BalanceConfig,
  raw: unknown,
  fallbackSeed: number,
): BalanceState {
  if (typeof raw !== 'object' || raw === null)
    return createBalanceState(fallbackSeed);
  const r = raw as Partial<BalanceState>;
  const seed =
    typeof r.seed === 'number' && Number.isFinite(r.seed)
      ? r.seed >>> 0
      : fallbackSeed >>> 0;
  const attempt =
    typeof r.attempt === 'number' && Number.isInteger(r.attempt) && r.attempt >= 0
      ? Math.min(r.attempt, 1_000_000)
      : 0;
  const puzzle = puzzleFor(config, { seed, attempt });
  const placed = emptyPieces();
  const rawPlaced = (r.placed ?? {}) as Partial<Pieces>;
  for (const k of WEIGHT_KINDS) {
    const v = rawPlaced[k];
    if (typeof v === 'number' && Number.isInteger(v))
      placed[k] = Math.max(0, Math.min(puzzle.inventory[k], v));
  }
  return { seed, attempt, placed, solved: r.solved === true };
}
