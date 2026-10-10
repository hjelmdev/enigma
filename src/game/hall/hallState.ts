import { progress } from '../prologue/progress';
import { restoreBalanceState } from '../puzzles/balanceScale';
import type { BalanceState } from '../puzzles/balanceScale';
import { restoreState, serializeState } from '../puzzles/slidingTiles';
import type { SlidingState } from '../puzzles/slidingTiles';
import { EXIT } from '../world/pyramidMap';
import { HALL_BALANCE, RELIEF_PUZZLE, newBalanceSeed } from './puzzles';

/** Puzzle → the hall exit it unlocks. */
export const PUZZLE_EXIT = {
  relief: EXIT.reliefDoor,
  balance: EXIT.balanceDoor,
} as const;
export type HallPuzzle = keyof typeof PUZZLE_EXIT;

export function reliefState(): SlidingState {
  return restoreState(RELIEF_PUZZLE, progress.current().hall.relief);
}

export function saveRelief(state: SlidingState) {
  progress.commit((s) => {
    s.hall.relief = serializeState(state);
  });
}

/** The balance state; creates and persists a seed on first use. */
export function balanceState(): BalanceState {
  const save = progress.current();
  if (!save.hall.balance) {
    const seed = newBalanceSeed();
    const state = restoreBalanceState(HALL_BALANCE, { seed }, seed);
    saveBalance(state);
    return state;
  }
  return restoreBalanceState(HALL_BALANCE, save.hall.balance, newBalanceSeed());
}

export function saveBalance(state: BalanceState) {
  progress.commit((s) => {
    s.hall.balance = {
      seed: state.seed,
      attempt: state.attempt,
      placed: { ...state.placed },
      solved: state.solved,
    };
  });
}

export function isSolved(puzzle: HallPuzzle) {
  const h = progress.current().hall;
  return puzzle === 'relief'
    ? Boolean(h.relief?.solved)
    : Boolean(h.balance?.solved);
}

/** Marks a puzzle's door as unlocked (opened in the world graph). Idempotent. */
export function unlockDoor(puzzle: HallPuzzle) {
  progress.openExit(PUZZLE_EXIT[puzzle]);
}

export function solvedCount() {
  return (isSolved('relief') ? 1 : 0) + (isSolved('balance') ? 1 : 0);
}
