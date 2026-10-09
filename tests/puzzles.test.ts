import { describe, expect, it } from 'vitest';
import {
  isBalanceSolved,
  isLightAligned,
  isSequenceSolved,
} from '../src/game/puzzles/logic';

describe('prototype puzzle rules', () => {
  it('accepts only the clue sequence', () => {
    expect(isSequenceSolved(['SOL', 'FLOD', 'ÖGA'])).toBe(true);
    expect(isSequenceSolved(['FLOD', 'SOL', 'ÖGA'])).toBe(false);
  });

  it('balances the 1 and 2 stones against the 3 stone', () => {
    expect(isBalanceSolved([1, 1, 2])).toBe(true);
    expect(isBalanceSolved([1, 2, 1])).toBe(false);
    expect(isBalanceSolved([0, 0, 0])).toBe(false);
  });

  it('requires all three mirrors to align', () => {
    expect(isLightAligned([1, 2, 1])).toBe(true);
    expect(isLightAligned([1, 1, 1])).toBe(false);
  });
});
