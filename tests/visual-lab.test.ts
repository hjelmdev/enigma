import { describe, expect, it } from 'vitest';
import {
  initialSunSeal,
  isSunSealSolved,
  rotateRing,
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
    const first = rotateRing(initialSunSeal(), 0);
    expect(first).toEqual([1, 0, 0]);
    expect(rotateRing([3, 0, 0], 0)).toEqual([0, 0, 0]);
    expect(rotateRing(first, -1)).toEqual(first);
  });

  it('opens only at the relief solution', () => {
    expect(isSunSealSolved(initialSunSeal())).toBe(false);
    expect(isSunSealSolved(SUN_SEAL_SOLUTION)).toBe(true);
    expect(isSunSealSolved([1, 2, 2])).toBe(false);
  });
});
