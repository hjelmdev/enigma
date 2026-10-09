import { describe, expect, it } from 'vitest';
import { rooms } from '../src/game/world/rooms';

describe('room content', () => {
  it('has unique hotspot IDs and normalized, usable interaction areas', () => {
    const ids = rooms.entrance.hotspots.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rooms.entrance.hotspots.length).toBeGreaterThanOrEqual(2);
    for (const hotspot of rooms.entrance.hotspots) {
      expect(hotspot.area.x).toBeGreaterThanOrEqual(0);
      expect(hotspot.area.y).toBeGreaterThanOrEqual(0);
      expect(hotspot.area.x + hotspot.area.width).toBeLessThanOrEqual(1);
      expect(hotspot.area.y + hotspot.area.height).toBeLessThanOrEqual(1);
    }
  });
});
