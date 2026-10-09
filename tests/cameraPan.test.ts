import { describe, expect, it } from 'vitest';
import {
  advancePanMomentum,
  clampCameraScrollX,
  getHorizontalPanAvailability,
  isHorizontalSwipe,
} from '../src/game/navigation/cameraPan';

describe('mobile chamber camera panning', () => {
  const bounds = { x: 0, width: 3000 };

  it('recognizes deliberate horizontal and diagonal swipes, not taps', () => {
    expect(isHorizontalSwipe(5, 4)).toBe(false);
    expect(isHorizontalSwipe(24, 10)).toBe(true);
    expect(isHorizontalSwipe(-24, 18)).toBe(true);
    expect(isHorizontalSwipe(8, 24)).toBe(false);
  });

  it('clamps the camera to both room edges at the current zoom', () => {
    expect(clampCameraScrollX(-20, bounds, 390, 1)).toBe(0);
    expect(clampCameraScrollX(5000, bounds, 390, 1)).toBe(2610);
    expect(clampCameraScrollX(5000, bounds, 390, 1.3)).toBeCloseTo(2700);
  });

  it('shows direction cues only where more room remains', () => {
    expect(getHorizontalPanAvailability(0, bounds, 390, 1)).toEqual({
      left: false,
      right: true,
    });
    expect(getHorizontalPanAvailability(2610, bounds, 390, 1)).toEqual({
      left: true,
      right: false,
    });
    expect(
      getHorizontalPanAvailability(0, { x: 0, width: 360 }, 390, 1),
    ).toEqual({
      left: false,
      right: false,
    });
  });

  it('carries a short, bounded glide after a deliberate swipe', () => {
    expect(advancePanMomentum(600, 0.8, 16, bounds, 390, 1)).toMatchObject({
      scrollX: 612.8,
    });
    expect(advancePanMomentum(2600, 1, 80, bounds, 390, 1).scrollX).toBe(2610);
    expect(advancePanMomentum(2610, 1, 16, bounds, 390, 1).velocityX).toBe(0);
  });
});
