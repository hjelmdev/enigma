import { describe, expect, it } from 'vitest';
import { rooms } from '../src/game/world/rooms';

describe('room content', () => {
  it('has unique hotspot IDs and areas inside each room world', () => {
    expect(Object.keys(rooms)).toHaveLength(3);
    for (const room of Object.values(rooms)) {
      const ids = room.hotspots.map(({ id }) => id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(room.hotspots.length).toBeGreaterThanOrEqual(2);
      for (const hotspot of room.hotspots) {
        expect(hotspot.area.x).toBeGreaterThanOrEqual(room.worldBounds.x);
        expect(hotspot.area.y).toBeGreaterThanOrEqual(room.worldBounds.y);
        expect(hotspot.area.x + hotspot.area.width).toBeLessThanOrEqual(
          room.worldBounds.x + room.worldBounds.width,
        );
        expect(hotspot.area.y + hotspot.area.height).toBeLessThanOrEqual(
          room.worldBounds.y + room.worldBounds.height,
        );
      }
      for (const exit of room.exits) {
        expect(
          exit.destinationRoomId === 'ending' || rooms[exit.destinationRoomId],
        ).toBeTruthy();
      }
    }
  });
});
