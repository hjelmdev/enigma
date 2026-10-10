import { FIRST_HALL_BALANCE } from '../puzzles/balanceScale';
import type { BalanceConfig } from '../puzzles/balanceScale';
import { EMPTY, applyEmptyMoves } from '../puzzles/slidingTiles';
import type { Dir, SlidingConfig } from '../puzzles/slidingTiles';

/** Solved arrangement: tiles in reading order, empty slot bottom right. */
const RELIEF_GOAL = [0, 1, 2, 3, 4, 5, 6, 7, EMPTY];

/**
 * Hand-picked scramble, built by legal moves of the empty slot from the
 * solved relief. The top-left of the winged sun stays in place so the picture
 * is recognisable; the pyramid, the figure and one gold corner are displaced
 * and the gap starts in the centre.
 * Optimal solution: 16 slides (checked in tests). Budget: 32.
 */
export const RELIEF_SCRAMBLE: Dir[] = [
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

export const RELIEF_PUZZLE: SlidingConfig = {
  id: 'hall-relief',
  rows: 3,
  cols: 3,
  goal: RELIEF_GOAL,
  initial: applyEmptyMoves(RELIEF_GOAL, 3, 3, RELIEF_SCRAMBLE),
  moveBudget: 32,
};

export const HALL_BALANCE: BalanceConfig = FIRST_HALL_BALANCE;

/** New base seed for a fresh balance puzzle chain (stored in the save). */
export function newBalanceSeed() {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}
