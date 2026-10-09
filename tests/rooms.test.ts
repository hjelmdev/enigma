import { describe, expect, it } from 'vitest';
import { rooms } from '../src/game/world/rooms';

describe('room content', () => {
  it('has unique hotspot IDs and areas inside each room world', () => {
    const ids = rooms.entrance.hotspots.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(rooms.entrance.hotspots.length).toBeGreaterThanOrEqual(2);
    for (const hotspot of rooms.entrance.hotspots) {
      expect(hotspot.area.x).toBeGreaterThanOrEqual(
        rooms.entrance.worldBounds.x,
      );
      expect(hotspot.area.y).toBeGreaterThanOrEqual(
        rooms.entrance.worldBounds.y,
      );
      expect(hotspot.area.x + hotspot.area.width).toBeLessThanOrEqual(
        rooms.entrance.worldBounds.x + rooms.entrance.worldBounds.width,
      );
      expect(hotspot.area.y + hotspot.area.height).toBeLessThanOrEqual(
        rooms.entrance.worldBounds.y + rooms.entrance.worldBounds.height,
      );
    }
  });
});
