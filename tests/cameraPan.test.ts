import { describe, expect, it } from 'vitest';
import {
  advancePanMomentum,
  clampCameraScroll,
  getPanAvailability,
  isPanGesture,
} from '../src/game/navigation/cameraPan';

describe('mobile chamber camera panning', () => {
  const bounds = { x: 0, y: 0, width: 3000, height: 1600 };

  it('distinguishes taps from deliberate horizontal, vertical and diagonal pans', () => {
    expect(isPanGesture(5, 4)).toBe(false);
    expect(isPanGesture(24, 0)).toBe(true);
    expect(isPanGesture(0, -24)).toBe(true);
    expect(isPanGesture(18, 18)).toBe(true);
  });

  it('clamps both axes to room edges at the current zoom', () => {
    expect(clampCameraScroll(-20, -20, bounds, 390, 700, 1)).toEqual({
      x: 0,
      y: 0,
    });
    expect(clampCameraScroll(5000, 5000, bounds, 390, 700, 1)).toEqual({
      x: 2610,
      y: 900,
    });
    expect(clampCameraScroll(5000, 5000, bounds, 390, 700, 1.3)).toEqual({
      x: 2700,
      y: 1061.5384615384614,
    });
  });

  it('shows pan cues only where more room remains', () => {
    expect(getPanAvailability(0, 0, bounds, 390, 700, 1)).toEqual({
      left: false,
      right: true,
      up: false,
      down: true,
    });
    expect(getPanAvailability(2610, 900, bounds, 390, 700, 1)).toEqual({
      left: true,
      right: false,
      up: true,
      down: false,
    });
    expect(
      getPanAvailability(
        0,
        0,
        { x: 0, y: 0, width: 360, height: 600 },
        390,
        700,
        1,
      ),
    ).toEqual({ left: false, right: false, up: false, down: false });
  });

  it('carries a short, bounded two-axis glide after a deliberate pan', () => {
    expect(
      advancePanMomentum(600, 400, 0.8, -0.5, 16, bounds, 390, 700, 1),
    ).toMatchObject({
      scrollX: 612.8,
      scrollY: 392,
    });
    expect(
      advancePanMomentum(2600, 850, 1, 1, 80, bounds, 390, 700, 1),
    ).toMatchObject({ scrollX: 2610, scrollY: 900 });
    expect(
      advancePanMomentum(2610, 900, 1, 1, 16, bounds, 390, 700, 1),
    ).toMatchObject({ velocityX: 0, velocityY: 0 });
  });
});
