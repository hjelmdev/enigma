import { describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import {
  activate,
  deserialize,
  initialize,
  isAligned,
  moveMarker,
  restore,
  serialize,
  TARGET,
} from '../src/experiments/hidden-horizon/model';
import {
  generateArt,
  GATE,
  ROOM,
} from '../src/experiments/hidden-horizon/art/generate';

describe('Hidden Horizon', () => {
  it('has exactly one deducible solution among all 125 arrangements', () => {
    let solutions = 0;
    for (let a = 0; a < 5; a++)
      for (let b = 0; b < 5; b++)
        for (let c = 0; c < 5; c++) {
          let state = restore({
            version: 1,
            markers: [a, b, c],
            solved: false,
          });
          if (isAligned(state.markers)) solutions++;
          for (let index = 0; index < 3; index++) {
            while (state.markers[index] !== TARGET[index])
              state = moveMarker(
                state,
                index,
                state.markers[index] < TARGET[index] ? 1 : -1,
              );
          }
          expect(activate(state).solved).toBe(true);
        }
    expect(solutions).toBe(1);
  });
  it('bounds moves, rejects invalid commands and freezes a solved mechanism', () => {
    const fresh = initialize();
    expect(moveMarker(fresh, 0, -1).markers[0]).toBe(0);
    expect(moveMarker(fresh, -1, 1)).toBe(fresh);
    expect(moveMarker(fresh, 0, 4)).toBe(fresh);
    expect(activate(fresh).solved).toBe(false);
    const solved = activate({ ...fresh, markers: [...TARGET] });
    expect(moveMarker(solved, 2, 1)).toBe(solved);
    expect(activate(solved)).toEqual(solved);
    expect(initialize().solved).toBe(false);
  });
  it('round-trips partial and solved progress and rejects stale/corrupt saves', () => {
    const partial = moveMarker(initialize(), 2, -1);
    expect(deserialize(serialize(partial))).toEqual(partial);
    const solved = activate({ ...partial, markers: [...TARGET] });
    expect(deserialize(serialize(solved))).toEqual(solved);
    for (const value of [
      null,
      'bad',
      { version: 2 },
      { version: 1, markers: [0, -1, 3], solved: false },
      { version: 1, markers: [0, 1.5, 3], solved: false },
    ])
      expect(restore(value)).toEqual(initialize());
    expect(deserialize('{broken')).toEqual(initialize());
    expect(restore({ ...initialize(), solved: true }).solved).toBe(false);
  });
  it('generates reproducible layers with an exact occluding aperture', () => {
    const first = generateArt();
    const second = generateArt();
    for (const name of Object.keys(first) as (keyof typeof first)[])
      expect(
        Buffer.compare(
          Buffer.from(first[name].pixels),
          Buffer.from(second[name].pixels),
        ),
      ).toBe(0);
    const alpha = (x: number, y: number) =>
      first.room.pixels[(y * ROOM.width + x) * 4 + 3];
    expect(alpha(GATE.x, GATE.y)).toBe(0);
    expect(alpha(GATE.x + GATE.width - 1, GATE.y + GATE.height - 1)).toBe(0);
    expect(alpha(GATE.x, GATE.y - 1)).toBe(255);
    expect(alpha(GATE.x, GATE.y + GATE.height)).toBe(255);
    expect(first.slab.height).toBe(GATE.height);
  });
});
