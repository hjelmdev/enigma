import { describe, expect, it } from 'vitest';
import {
  FIRST_HALL_BALANCE,
  WEIGHT_KINDS,
  allSolutions,
  attemptSeed,
  addWeight,
  checkPuzzle,
  countPieces,
  createBalanceState,
  emptyPieces,
  fits,
  generateBalancePuzzle,
  isOneToGroup,
  pieces,
  pullLever,
  puzzleFor,
  relationsDetermineRatios,
  removeWeight,
  restoreBalanceState,
  sideWeight,
  weightOf,
  weightsAreBaseMultiples,
} from '../src/game/puzzles/balanceScale';
import type {
  BalanceConfig,
  BalancePuzzle,
  BalanceState,
  Clue,
  Pieces,
} from '../src/game/puzzles/balanceScale';

const CONFIG = FIRST_HALL_BALANCE;
const RETRY_SAME: BalanceConfig = { ...CONFIG, attemptPolicy: 'retry-same' };

/** The authored first weighing (attempt 0 ignores the seed). */
function authoredPuzzle(): BalancePuzzle {
  return puzzleFor(CONFIG, { seed: 7, attempt: 0 });
}

/** Recomputes stored solutions so a mutated puzzle isolates one rule. */
function withSolutions(p: BalancePuzzle): BalancePuzzle {
  return { ...p, solutions: allSolutions(p.weights, p.target, p.inventory) };
}

function stateWith(
  seed: number,
  attempt: number,
  placed: Pieces,
): BalanceState {
  return { seed, attempt, placed: { ...placed }, solved: false };
}

/** Independent enumeration of every selection within the shelf, weighed by hand. */
function bruteForceSolutions(
  weights: Pieces,
  target: number,
  inventory: Pieces,
): Pieces[] {
  const ranges = WEIGHT_KINDS.map((k) =>
    Array.from({ length: inventory[k] + 1 }, (_, i) => i),
  );
  const out: Pieces[] = [];
  for (const s of ranges[0])
    for (const f of ranges[1])
      for (const l of ranges[2]) {
        const weight =
          s * weights.scarab + f * weights.falcon + l * weights.lotus;
        if (s + f + l > 0 && weight === target) out.push(pieces(s, f, l));
      }
  return out;
}

const keyOf = (p: Pieces) => WEIGHT_KINDS.map((k) => p[k]).join(',');

describe('symbolic relations', () => {
  it('every relation in the authored puzzle balances under its weights', () => {
    const p = authoredPuzzle();
    for (const c of p.relations) {
      expect(sideWeight(c.left, p.weights, p.target)).toBe(
        sideWeight(c.right, p.weights, p.target),
      );
    }
    expect(weightOf(p.targetPieces, p.weights)).toBe(p.target);
  });

  it('every relation in generated puzzles balances (seeds 1..30)', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const p = generateBalancePuzzle(CONFIG, seed);
      for (const c of p.relations) {
        expect(sideWeight(c.left, p.weights, p.target)).toBe(
          sideWeight(c.right, p.weights, p.target),
        );
      }
    }
  });
});

describe('allSolutions', () => {
  it('matches brute-force enumeration over a grid of targets and shelves', () => {
    const weights = pieces(3, 2, 1);
    for (let target = 0; target <= 20; target++) {
      for (let s = 0; s <= 3; s++)
        for (let f = 0; f <= 3; f++)
          for (let l = 0; l <= 4; l++) {
            const inventory = pieces(s, f, l);
            const got = allSolutions(weights, target, inventory)
              .map(keyOf)
              .sort();
            const want = bruteForceSolutions(weights, target, inventory)
              .map(keyOf)
              .sort();
            expect(got).toEqual(want);
          }
    }
  });

  it('only returns selections that fit the inventory, are non-empty and have no duplicates', () => {
    const inventory = pieces(1, 2, 4);
    const solutions = allSolutions(pieces(3, 2, 1), 6, inventory);
    expect(solutions.length).toBeGreaterThan(0);
    for (const p of solutions) {
      expect(countPieces(p)).toBeGreaterThan(0);
      for (const k of WEIGHT_KINDS) {
        expect(p[k]).toBeGreaterThanOrEqual(0);
        expect(p[k]).toBeLessThanOrEqual(inventory[k]);
      }
    }
    expect(new Set(solutions.map(keyOf)).size).toBe(solutions.length);
  });

  it('returns nothing for a zero target (only the empty selection weighs zero)', () => {
    expect(allSolutions(pieces(3, 2, 1), 0, pieces(1, 2, 4))).toEqual([]);
  });
});

describe('FIRST_HALL_BALANCE authored puzzle', () => {
  it('passes checkPuzzle under the configured difficulty', () => {
    const result = checkPuzzle(authoredPuzzle(), CONFIG);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('is independent of the base seed for attempt 0', () => {
    expect(puzzleFor(CONFIG, { seed: 1, attempt: 0 }).weights).toEqual(
      puzzleFor(CONFIG, { seed: 999, attempt: 0 }).weights,
    );
  });

  it('accepts scarab + three lotus and two falcon + two lotus, but not two scarabs', () => {
    const solutions = authoredPuzzle().solutions.map(keyOf);
    expect(solutions).toContain(keyOf(pieces(1, 0, 3)));
    expect(solutions).toContain(keyOf(pieces(0, 2, 2)));
    expect(solutions).not.toContain(keyOf(pieces(2, 0, 0)));
  });

  it('keeps the vessel composition off the shelf and the whole shelf unbalanced', () => {
    const p = authoredPuzzle();
    expect(p.inventory.scarab).toBeLessThan(p.targetPieces.scarab);
    expect(weightOf(p.inventory, p.weights)).not.toBe(p.target);
  });
});

describe('checkPuzzle rejects invalid candidates', () => {
  const base = authoredPuzzle();

  it('rejects a vessel composition the shelf can supply directly', () => {
    const p = withSolutions({ ...base, inventory: pieces(2, 2, 4) });
    const result = checkPuzzle(p, CONFIG);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'vessel composition can be copied straight from the shelf',
    );
  });

  it('rejects a shelf whose total weighs exactly the vessel', () => {
    // 1 scarab + 3 lotus = 6 = target.
    const p = withSolutions({ ...base, inventory: pieces(1, 0, 3) });
    expect(checkPuzzle(p).errors).toContain(
      'the whole shelf balances (trivial)',
    );
  });

  it('rejects relations that leave a weight ratio undetermined', () => {
    const p = withSolutions({ ...base, relations: [base.relations[0]] });
    const result = checkPuzzle(p, CONFIG);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'relations do not determine every weight ratio',
    );
  });

  it('rejects an unbalanced relation', () => {
    const relations = base.relations.map((c, i) =>
      i === 1
        ? { left: c.left, right: { pieces: pieces(0, 2, 1), target: 0 } }
        : c,
    );
    const result = checkPuzzle(withSolutions({ ...base, relations }));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('a relation does not balance');
  });

  it('rejects a vessel relation that does not balance', () => {
    const result = checkPuzzle(
      withSolutions({ ...base, targetPieces: pieces(1, 0, 0) }),
    );
    expect(result.errors).toContain('vessel relation does not balance');
  });

  it('rejects a target no shelf selection can reach', () => {
    const p = withSolutions({ ...base, inventory: pieces(1, 0, 0) });
    const result = checkPuzzle(p, CONFIG);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('no solution within the shelf');
    expect(result.errors).toContain('no substitution path to a placeable set');
  });

  it('rejects non-distinct weights', () => {
    const result = checkPuzzle({ ...base, weights: pieces(3, 3, 1) });
    expect(result.errors).toContain('weights must be distinct');
  });

  it('rejects stale stored solutions', () => {
    expect(checkPuzzle({ ...base, solutions: [] }).errors).toContain(
      'stored solutions are stale',
    );
  });

  it('rejects more solutions than the configured maximum', () => {
    expect(
      checkPuzzle(base, { depth: CONFIG.depth, maxSolutions: 3 }).errors,
    ).toContain('too many solutions');
  });

  it('rejects a substitution depth outside the configured difficulty', () => {
    expect(
      checkPuzzle(base, { depth: [2, 2], maxSolutions: 5 }).errors,
    ).toContain('substitution depth outside configured difficulty');
  });
});

describe('generator', () => {
  it('every seed in 1..200 yields a puzzle that passes checkPuzzle', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = generateBalancePuzzle(CONFIG, seed);
      const result = checkPuzzle(p, CONFIG);
      expect(result.errors, `seed ${seed}`).toEqual([]);
      expect(p.seed).toBe(seed);
    }
  }, 60_000);

  it('is deterministic per seed', () => {
    for (const seed of [1, 42, 4096]) {
      expect(generateBalancePuzzle(CONFIG, seed)).toEqual(
        generateBalancePuzzle(CONFIG, seed),
      );
    }
  });

  it('different attempts usually produce different puzzles', () => {
    const seen = new Set<string>();
    for (let attempt = 1; attempt <= 12; attempt++) {
      const p = puzzleFor(CONFIG, { seed: 1234, attempt });
      seen.add(
        JSON.stringify([p.weights, p.targetPieces, p.inventory, p.relations]),
      );
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it('attempt seeds are stable and attempt 0 keeps the base seed', () => {
    expect(attemptSeed(55, 0)).toBe(55);
    expect(attemptSeed(55, 3)).toBe(attemptSeed(55, 3));
    expect(attemptSeed(55, 3)).not.toBe(attemptSeed(55, 4));
  });
});

describe('addWeight and removeWeight', () => {
  const p = authoredPuzzle();

  it('never adds beyond the shelf count for a kind', () => {
    let state = createBalanceState(9);
    state = addWeight(state, p, 'scarab');
    expect(state.placed.scarab).toBe(1);
    const capped = addWeight(state, p, 'scarab');
    expect(capped).toBe(state);
    expect(capped.placed.scarab).toBe(1);
  });

  it('removing from an empty kind is a no-op, and add/remove round-trip', () => {
    const state = createBalanceState(9);
    expect(removeWeight(state, 'lotus')).toBe(state);
    const added = addWeight(state, p, 'lotus');
    expect(removeWeight(added, 'lotus').placed).toEqual(emptyPieces());
  });

  it('never changes seed or attempt and leaves the lever result untouched', () => {
    let state = createBalanceState(321);
    state = addWeight(state, p, 'falcon');
    state = addWeight(state, p, 'lotus');
    state = removeWeight(state, 'falcon');
    expect(state.seed).toBe(321);
    expect(state.attempt).toBe(0);
    expect(state.solved).toBe(false);
  });

  it('gives no feedback: the state exposes only its persisted fields', () => {
    const state = addWeight(createBalanceState(5), p, 'lotus');
    expect(Object.keys(state).sort()).toEqual([
      'attempt',
      'placed',
      'seed',
      'solved',
    ]);
  });

  it('does not change a solved state', () => {
    const solved: BalanceState = {
      ...createBalanceState(5),
      placed: pieces(1, 0, 3),
      solved: true,
    };
    expect(addWeight(solved, p, 'lotus')).toBe(solved);
    expect(removeWeight(solved, 'scarab')).toBe(solved);
  });
});

describe('pullLever on a balancing pan', () => {
  it('every valid authored solution balances, solves and stays solved on a second pull', () => {
    const p = authoredPuzzle();
    expect(p.solutions.length).toBeGreaterThan(0);
    for (const solution of p.solutions) {
      const state = stateWith(5, 0, solution);
      const first = pullLever(CONFIG, state);
      expect(first.outcome).toBe('balanced');
      expect(first.rerolled).toBe(false);
      expect(first.state.solved).toBe(true);
      expect(first.state.attempt).toBe(0);
      expect(first.state.seed).toBe(5);
      expect(first.judged).toEqual({ ...p, seed: 5 });

      const second = pullLever(CONFIG, first.state);
      expect(second.outcome).toBe('balanced');
      expect(second.state).toEqual(first.state);
      expect(second.rerolled).toBe(false);
    }
  });

  it('every valid solution of generated puzzles (attempt 1) balances', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const p = puzzleFor(CONFIG, { seed, attempt: 1 });
      for (const solution of p.solutions) {
        const result = pullLever(CONFIG, stateWith(seed, 1, solution));
        expect(result.outcome, `seed ${seed}`).toBe('balanced');
        expect(result.state.attempt).toBe(1);
      }
    }
  });

  it('judges by weight: any selection weighing the vessel balances', () => {
    const p = authoredPuzzle();
    const alt = pieces(0, 2, 2);
    expect(weightOf(alt, p.weights)).toBe(p.target);
    expect(pullLever(CONFIG, stateWith(5, 0, alt)).outcome).toBe('balanced');
  });
});

describe('pullLever on a wrong weighing (reroll-on-fail)', () => {
  it('too light: advances the attempt, clears the pan and shows the new puzzle', () => {
    const base = authoredPuzzle();
    const state = stateWith(88, 0, pieces(1, 0, 0));
    const result = pullLever(CONFIG, state);

    expect(result.outcome).toBe('too-light');
    expect(result.rerolled).toBe(true);
    expect(result.judged).toEqual({ ...base, seed: 88 });
    expect(result.state.attempt).toBe(1);
    expect(result.state.seed).toBe(88);
    expect(result.state.placed).toEqual(emptyPieces());
    expect(result.state.solved).toBe(false);
    expect(result.puzzle).toEqual(puzzleFor(CONFIG, result.state));
  });

  it('too heavy: classified as too-heavy and rerolled', () => {
    const result = pullLever(CONFIG, stateWith(88, 0, pieces(1, 2, 4)));
    expect(result.outcome).toBe('too-heavy');
    expect(result.rerolled).toBe(true);
    expect(result.state.attempt).toBe(1);
  });

  it('an empty pan is a failed weighing', () => {
    const result = pullLever(CONFIG, createBalanceState(88));
    expect(result.outcome).toBe('too-light');
    expect(result.state.attempt).toBe(1);
  });

  it('a generated puzzle after a reroll is judged against its own weights', () => {
    const first = pullLever(CONFIG, stateWith(12, 0, pieces(1, 0, 0)));
    const next = first.state;
    const judged = puzzleFor(CONFIG, next);
    expect(first.puzzle).toEqual(judged);
    const solution = judged.solutions[0];
    expect(solution).toBeDefined();
    const solved = pullLever(CONFIG, { ...next, placed: { ...solution } });
    expect(solved.outcome).toBe('balanced');
    expect(solved.judged).toEqual(judged);
  });

  it('retry-same keeps the attempt and the pan, and the displayed puzzle is unchanged', () => {
    const state = stateWith(88, 0, pieces(1, 0, 0));
    const result = pullLever(RETRY_SAME, state);
    expect(result.outcome).toBe('too-light');
    expect(result.rerolled).toBe(false);
    expect(result.state).toEqual(state);
    expect(result.puzzle).toEqual(result.judged);
  });
});

describe('persistence', () => {
  it('restoring a JSON round-tripped state yields the same puzzle and state', () => {
    const wrong = pullLever(CONFIG, stateWith(77, 0, pieces(1, 0, 0))).state;
    const placedState = addWeight(
      addWeight(wrong, puzzleFor(CONFIG, wrong), 'lotus'),
      puzzleFor(CONFIG, wrong),
      'lotus',
    );
    const saved = JSON.parse(JSON.stringify(placedState));
    const restored = restoreBalanceState(CONFIG, saved, 0);

    expect(restored).toEqual(placedState);
    expect(puzzleFor(CONFIG, restored)).toEqual(puzzleFor(CONFIG, placedState));
  });

  it('clamps placed counts to the inventory of the puzzle for that attempt', () => {
    const raw = {
      seed: 5,
      attempt: 0,
      placed: { scarab: 99, falcon: -3, lotus: 9 },
      solved: false,
    };
    const restored = restoreBalanceState(CONFIG, raw, 0);
    expect(restored.placed).toEqual(pieces(1, 0, 4));
  });

  it('clamps against a generated puzzle inventory at attempt > 0', () => {
    const inventory = puzzleFor(CONFIG, { seed: 3, attempt: 1 }).inventory;
    const restored = restoreBalanceState(
      CONFIG,
      { seed: 3, attempt: 1, placed: pieces(9, 9, 9), solved: false },
      0,
    );
    expect(restored.placed).toEqual(inventory);
  });

  it('drops non-integer or wrong-typed placed counts to zero', () => {
    const restored = restoreBalanceState(
      CONFIG,
      {
        seed: 5,
        attempt: 0,
        placed: { scarab: 1.5, falcon: 'two', lotus: null },
        solved: false,
      },
      0,
    );
    expect(restored.placed).toEqual(emptyPieces());
  });

  it('uses the fallback seed when the stored seed is missing or not finite, and attempt 0 for bad attempts', () => {
    const noSeed = restoreBalanceState(
      CONFIG,
      { attempt: -2, placed: {}, solved: false },
      31,
    );
    expect(noSeed.seed).toBe(31);
    expect(noSeed.attempt).toBe(0);
    const badSeed = restoreBalanceState(
      CONFIG,
      { seed: Number.NaN, attempt: 1.5 },
      31,
    );
    expect(badSeed.seed).toBe(31);
    expect(badSeed.attempt).toBe(0);
  });

  it('keeps the solved flag only when it is exactly true', () => {
    expect(
      restoreBalanceState(CONFIG, { seed: 5, attempt: 0, solved: 'yes' }, 0)
        .solved,
    ).toBe(false);
    expect(
      restoreBalanceState(CONFIG, { seed: 5, attempt: 0, solved: true }, 0)
        .solved,
    ).toBe(true);
  });

  it('garbage input falls back to a fresh state for the fallback seed', () => {
    const fresh = createBalanceState(31);
    for (const raw of [null, undefined, 'junk', 5, true]) {
      expect(restoreBalanceState(CONFIG, raw, 31)).toEqual(fresh);
    }
  });
});

describe('whole-number first hall', () => {
  const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1);
  const FREE: BalanceConfig = {
    ...CONFIG,
    weightModel: 'free',
    relationForm: 'free',
  };
  let generatedCache: BalancePuzzle[] | undefined;

  /** generateBalancePuzzle(FIRST_HALL_BALANCE, seed) for seeds 1..300, memoised. */
  function generated(): BalancePuzzle[] {
    if (!generatedCache)
      generatedCache = SEEDS.map((seed) => generateBalancePuzzle(CONFIG, seed));
    return generatedCache;
  }

  function expectKeys(obj: Pieces, label: string) {
    expect(Object.keys(obj).sort(), label).toEqual([
      'falcon',
      'lotus',
      'scarab',
    ]);
  }

  it('weights are positive whole numbers, the lightest is 1 and every weight is a multiple of it', () => {
    for (const p of generated()) {
      const label = `seed ${p.seed}`;
      for (const k of WEIGHT_KINDS) {
        expect(
          Number.isInteger(p.weights[k]) && p.weights[k] > 0,
          `${label} ${k}`,
        ).toBe(true);
      }
      expect(Math.min(...WEIGHT_KINDS.map((k) => p.weights[k])), label).toBe(1);
      expect(weightsAreBaseMultiples(p.weights), label).toBe(true);
      expect(Number.isInteger(p.target), label).toBe(true);
    }
  }, 120_000);

  it('every relation is one piece against a group, each side within maxSidePieces, never 2+ pieces on both sides', () => {
    for (const p of generated()) {
      const label = `seed ${p.seed}`;
      for (const c of p.relations) {
        const l = countPieces(c.left.pieces);
        const r = countPieces(c.right.pieces);
        expect(isOneToGroup(c), label).toBe(true);
        expect(Math.max(l, r), label).toBeLessThanOrEqual(CONFIG.maxSidePieces);
        expect(l >= 2 && r >= 2, label).toBe(false);
      }
    }
  }, 120_000);

  it('relations alone fix every ratio, and every relation side weighs a whole number', () => {
    for (const p of generated()) {
      const label = `seed ${p.seed}`;
      expect(relationsDetermineRatios(p.relations), label).toBe(true);
      for (const c of p.relations) {
        const l = sideWeight(c.left, p.weights, p.target);
        const r = sideWeight(c.right, p.weights, p.target);
        expect(l, label).toBe(r);
        expect(Number.isInteger(l), label).toBe(true);
      }
    }
  }, 120_000);

  it('only scarab, falcon and lotus appear in weights, inventory, vessel and relations', () => {
    for (const p of generated()) {
      const label = `seed ${p.seed}`;
      expectKeys(p.weights, `${label} weights`);
      expectKeys(p.inventory, `${label} inventory`);
      expectKeys(p.targetPieces, `${label} targetPieces`);
      for (const c of p.relations) {
        expectKeys(c.left.pieces, `${label} left`);
        expectKeys(c.right.pieces, `${label} right`);
      }
      for (const s of p.solutions) expectKeys(s, `${label} solution`);
    }
  }, 120_000);

  it('generated puzzles are solvable within the shelf: brute force agrees and checkPuzzle passes', () => {
    for (const p of generated()) {
      const label = `seed ${p.seed}`;
      expect(p.solutions.length, label).toBeGreaterThanOrEqual(1);
      for (const s of p.solutions)
        expect(fits(s, p.inventory), label).toBe(true);
      const brute = bruteForceSolutions(p.weights, p.target, p.inventory)
        .map(keyOf)
        .sort();
      expect(p.solutions.map(keyOf).sort(), label).toEqual(brute);
      const result = checkPuzzle(p, CONFIG);
      expect(result.errors, label).toEqual([]);
      expect(result.ok, label).toBe(true);
    }
  }, 120_000);

  it('the authored attempt-0 puzzle balances with each of its solutions on a fresh state', () => {
    const p = authoredPuzzle();
    expect(p.solutions.length).toBeGreaterThanOrEqual(2);
    for (const solution of p.solutions) {
      const state: BalanceState = {
        ...createBalanceState(7),
        placed: { ...solution },
      };
      const result = pullLever(CONFIG, state);
      expect(result.outcome, keyOf(solution)).toBe('balanced');
      expect(result.state.solved, keyOf(solution)).toBe(true);
    }
  });

  it('some generated puzzle has at least two solutions and every one of them balances', () => {
    let multi = 0;
    for (const seed of SEEDS) {
      const p = puzzleFor(CONFIG, { seed, attempt: 1 });
      if (p.solutions.length < 2) continue;
      multi++;
      for (const solution of p.solutions) {
        const state: BalanceState = {
          ...createBalanceState(seed),
          attempt: 1,
          placed: { ...solution },
        };
        const result = pullLever(CONFIG, state);
        expect(result.outcome, `seed ${seed} ${keyOf(solution)}`).toBe(
          'balanced',
        );
        expect(result.state.attempt).toBe(1);
      }
    }
    expect(multi).toBeGreaterThan(0);
  }, 120_000);

  it('a run of 60 failed weighings from several base seeds keeps whole-number puzzles and advances the attempt each time', () => {
    for (const base of [1, 77, 4096]) {
      let state = createBalanceState(base);
      let puzzle = puzzleFor(CONFIG, state);
      for (let i = 0; i < 60; i++) {
        const label = `seed ${base} attempt ${i}`;
        expect(checkPuzzle(puzzle, CONFIG).errors, label).toEqual([]);
        expect(weightsAreBaseMultiples(puzzle.weights), label).toBe(true);
        expect(relationsDetermineRatios(puzzle.relations), label).toBe(true);
        expect(puzzle.relations.every(isOneToGroup), label).toBe(true);

        // The lightest piece is the only thing on the pan: never balances.
        const lightest = WEIGHT_KINDS.reduce((a, b) =>
          puzzle.weights[b] < puzzle.weights[a] ? b : a,
        );
        const wrong = emptyPieces();
        wrong[lightest] = 1;
        expect(fits(wrong, puzzle.inventory), label).toBe(true);
        const result = pullLever(CONFIG, { ...state, placed: wrong });
        expect(result.outcome, label).toBe('too-light');
        expect(result.rerolled, label).toBe(true);
        expect(result.judged, label).toEqual(puzzle);
        expect(result.state, label).toEqual({
          seed: base,
          attempt: i + 1,
          placed: emptyPieces(),
          solved: false,
        });
        expect(result.puzzle.seed, label).toBe(attemptSeed(base, i + 1));
        expect(result.puzzle, label).toEqual(puzzleFor(CONFIG, result.state));

        state = result.state;
        puzzle = result.puzzle;
      }
    }
  }, 120_000);

  it('the same seed and attempt always rebuild an identical puzzle', () => {
    for (const seed of [1, 42, 4096, 99991]) {
      for (let attempt = 0; attempt <= 3; attempt++) {
        const label = `seed ${seed} attempt ${attempt}`;
        const a = puzzleFor(CONFIG, { seed, attempt });
        expect(puzzleFor(CONFIG, { seed, attempt }), label).toEqual(a);
        if (attempt > 0)
          expect(a, label).toEqual(
            generateBalancePuzzle(CONFIG, attemptSeed(seed, attempt)),
          );
        expect(checkPuzzle(a, CONFIG).errors, label).toEqual([]);
      }
    }
  }, 120_000);

  it('the free config still produces advanced relations or fractional ratios (seeds 1..300)', () => {
    let advanced = 0;
    for (const seed of SEEDS) {
      const p = generateBalancePuzzle(FREE, seed);
      const multiSided = p.relations.some(
        (c) =>
          countPieces(c.left.pieces) >= 2 && countPieces(c.right.pieces) >= 2,
      );
      const fractional = !weightsAreBaseMultiples(p.weights);
      if (multiSided || fractional) advanced++;
      expect(checkPuzzle(p, FREE).errors, `seed ${seed}`).toEqual([]);
    }
    expect(advanced).toBeGreaterThan(0);
  }, 120_000);

  it('checkPuzzle rejects a 2 falcon = 3 scarab relation under the first-hall config', () => {
    const weights = pieces(2, 3, 1);
    const targetPieces = pieces(2, 0, 0);
    const relations: Clue[] = [
      {
        left: { pieces: pieces(0, 2, 0), target: 0 },
        right: { pieces: pieces(3, 0, 0), target: 0 },
      },
      {
        left: { pieces: pieces(1, 0, 0), target: 0 },
        right: { pieces: pieces(0, 0, 2), target: 0 },
      },
    ];
    const p = withSolutions({
      seed: 3,
      weights,
      target: weightOf(targetPieces, weights),
      targetPieces,
      relations,
      inventory: pieces(1, 2, 4),
      solutions: [],
      depth: 1,
    });
    const result = checkPuzzle(p, CONFIG);
    expect(result.ok).toBe(false);
    expect(result.errors).not.toContain('a relation does not balance');
    expect(result.errors).toContain(
      'a relation is not one piece against a group',
    );
    expect(
      checkPuzzle(p, { ...CONFIG, relationForm: 'free' }).errors,
    ).not.toContain('a relation is not one piece against a group');
  });
});
