import { describe, expect, it } from 'vitest';
import {
  createSunSealState,
  initialSunSeal,
  isSunSealSolved,
  resetSunSeal,
  rotateRing,
  rotateSunSeal,
  SEALED_SUN_ROOM,
  SUN_SEAL_SOLUTION,
  VISUAL_STYLES,
} from '../src/game/visual-lab/model';

describe('Visual Lab shared chamber', () => {
  it('uses one geometry for both raster styles and the illustrated integration slot', () => {
    expect(VISUAL_STYLES.map(({ id }) => id)).toEqual([
      'classic',
      'hd',
      'illustrated',
    ]);
    expect(VISUAL_STYLES[0].art?.background).not.toBe(
      VISUAL_STYLES[1].art?.background,
    );
    expect(VISUAL_STYLES[2].art).toBeUndefined();
    expect(SEALED_SUN_ROOM.rings).toHaveLength(3);
  });

  it('rotates each ring independently and wraps around', () => {
    const first = rotateRing([0, 0, 0], 0);
    expect(first).toEqual([1, 0, 0]);
    expect(rotateRing([3, 0, 0], 0)).toEqual([0, 0, 0]);
    expect(rotateRing(first, -1)).toEqual(first);
  });

  it('opens only at the relief solution', () => {
    expect(isSunSealSolved(initialSunSeal())).toBe(false);
    expect(isSunSealSolved(SUN_SEAL_SOLUTION)).toBe(true);
    expect(isSunSealSolved([1, 2, 2])).toBe(false);
    expect(isSunSealSolved([1, 0, 2])).toBe(false);
  });

  it('preserves its three legal rotation states and puzzle progress between views', () => {
    const start = createSunSealState();
    expect(start.angles).toEqual(initialSunSeal());
    let current = rotateSunSeal(start, 0);
    current = rotateSunSeal(current, 1);
    expect(current.angles).toEqual([1, 3, 1]);
    expect(start.angles).toEqual([0, 2, 1]);
    for (const angle of current.angles) expect(angle).toBeGreaterThanOrEqual(0);
    for (const angle of current.angles) expect(angle).toBeLessThan(4);
  });

  it('resets the puzzle and unlocks the door exactly once', () => {
    let state = createSunSealState();
    state = rotateSunSeal(state, 0);
    state = rotateSunSeal(state, 1);
    state = rotateSunSeal(state, 1);
    state = rotateSunSeal(state, 2);
    state = rotateSunSeal(state, 2);
    expect(state).toEqual({ angles: [1, 0, 3], solved: true, unlockCount: 1 });
    expect(rotateSunSeal(state, 0)).toBe(state);
    expect(rotateSunSeal(state, 2).unlockCount).toBe(1);
    expect(resetSunSeal()).toEqual(createSunSealState());
  });
});
