import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ALL_GLYPHS,
  GLYPH_SIZE,
  glyphRowWidths,
} from '../src/experiments/sealed-sun/art/glyphs';
import { generateSealedSunArt } from '../src/experiments/sealed-sun/art/generate';
import { STELE_VIGNETTE } from '../src/experiments/sealed-sun/art/steleArt';
import {
  DOOR_FACE,
  DOOR_HOLE,
  DOOR_SLAB,
  HOTSPOTS,
  ROOM_H,
  ROOM_W,
} from '../src/experiments/sealed-sun/layout';
import {
  RING_COUNT,
  SLOTS,
  SUN_SEAL,
  createState,
  deserialize,
  isSolved,
  serialize,
  solve,
  turn,
  validateDefinition,
  windowGlyphs,
  type RingIndex,
  type SunSealState,
} from '../src/experiments/sealed-sun/puzzle/sunSeal';
import {
  freshProgress,
  parseProgress,
  stringifyProgress,
} from '../src/experiments/sealed-sun/state';

describe('Sun Seal rules', () => {
  it('has a valid definition that does not start solved', () => {
    expect(validateDefinition(SUN_SEAL)).toEqual([]);
    expect(createState().solved).toBe(false);
  });

  it('matches the stele: the solved window reads sun, scarab, mountains', () => {
    const solved: SunSealState = { rotations: [0, 0, 0], solved: true };
    expect(windowGlyphs(solved)).toEqual(STELE_VIGNETTE.map((v) => v.glyph));
  });

  it('drags the next ring inward when a ring turns', () => {
    const s0: SunSealState = { rotations: [0, 0, 0], solved: false };
    expect(turn(s0, 0, 1).rotations).toEqual([1, 1, 0]);
    expect(turn(s0, 1, -1).rotations).toEqual([0, 7, 7]);
    expect(turn(s0, 2, 1).rotations).toEqual([0, 0, 1]);
  });

  it('locks once solved', () => {
    const almost: SunSealState = { rotations: [0, 0, 1], solved: false };
    const solved = turn(almost, 2, -1);
    expect(solved.solved).toBe(true);
    expect(turn(solved, 0, 1)).toBe(solved);
  });

  it('is solvable from every one of the 512 states within 12 moves', () => {
    for (let a = 0; a < SLOTS; a++) {
      for (let b = 0; b < SLOTS; b++) {
        for (let c = 0; c < SLOTS; c++) {
          let state: SunSealState = {
            rotations: [a, b, c],
            solved: isSolved([a, b, c]),
          };
          const moves = solve(state);
          expect(moves.length).toBeLessThanOrEqual(12);
          for (const m of moves) state = turn(state, m.ring, m.direction);
          expect(state.solved).toBe(true);
        }
      }
    }
  });

  it('cannot be solved by turning only the outer ring (needs the ordering insight)', () => {
    let state = createState();
    for (let i = 0; i < SLOTS; i++) {
      state = turn(state, 0 as RingIndex, 1);
      expect(state.solved).toBe(false);
    }
  });

  it('round-trips and rejects malformed save data', () => {
    const s = turn(createState(), 1, 1);
    expect(deserialize(JSON.parse(JSON.stringify(serialize(s))))).toEqual(s);
    expect(deserialize({ rotations: [1, 2] })).toEqual(createState());
    expect(deserialize({ rotations: [1, 2, 99] })).toEqual(createState());
    expect(deserialize('nonsense')).toEqual(createState());
    expect(deserialize(null).rotations).toHaveLength(RING_COUNT);
  });
});

describe('Sealed Sun progress', () => {
  it('round-trips through its versioned JSON', () => {
    const p = freshProgress();
    p.seal = { rotations: [0, 0, 0], solved: true };
    p.doorOpen = true;
    p.hintsShown = 2;
    expect(parseProgress(stringifyProgress(p))).toEqual(p);
  });

  it('starts fresh for other versions, corrupt JSON and impossible states', () => {
    expect(parseProgress('{')).toEqual(freshProgress());
    expect(parseProgress(JSON.stringify({ version: 99 }))).toEqual(
      freshProgress(),
    );
    const stale = parseProgress(
      JSON.stringify({
        version: 1,
        seal: { rotations: [1, 0, 0] },
        doorOpen: true,
        hintsShown: 50,
      }),
    );
    expect(stale.doorOpen).toBe(false);
    expect(stale.hintsShown).toBe(3);
  });
});

describe('Sealed Sun art', () => {
  it('has rectangular 13×13 glyphs', () => {
    for (const id of ALL_GLYPHS) {
      expect(
        glyphRowWidths(id).every((w) => w === GLYPH_SIZE),
        id,
      ).toBe(true);
      expect(glyphRowWidths(id)).toHaveLength(GLYPH_SIZE);
    }
  });

  it('keeps the door layers registered: slab covers the hole, hole sits inside the doorway', () => {
    expect(DOOR_SLAB.x).toBeLessThanOrEqual(DOOR_HOLE.x);
    expect(DOOR_SLAB.y).toBeLessThanOrEqual(DOOR_HOLE.y);
    expect(DOOR_SLAB.x + DOOR_SLAB.w).toBeGreaterThanOrEqual(
      DOOR_HOLE.x + DOOR_HOLE.w,
    );
    expect(DOOR_SLAB.y + DOOR_SLAB.h).toBeGreaterThanOrEqual(
      DOOR_HOLE.y + DOOR_HOLE.h,
    );
    expect(DOOR_HOLE.x).toBeGreaterThanOrEqual(DOOR_FACE.x);
    expect(DOOR_HOLE.x + DOOR_HOLE.w).toBeLessThanOrEqual(
      DOOR_FACE.x + DOOR_FACE.w,
    );
    for (const h of HOTSPOTS) {
      for (const p of h.polygon) {
        expect(p.x).toBeGreaterThanOrEqual(-8);
        expect(p.x).toBeLessThanOrEqual(ROOM_W + 8);
        expect(p.y).toBeLessThanOrEqual(ROOM_H + 8);
      }
    }
  });

  it('generates deterministic layers with a transparent slab hole and opaque walls', () => {
    const a = generateSealedSunArt();
    const b = generateSealedSunArt();
    const digest = (data: Uint8ClampedArray) =>
      createHash('sha1').update(data).digest('hex');
    for (const key of Object.keys(a.layers)) {
      expect(digest(a.layers[key].data), key).toBe(digest(b.layers[key].data));
    }
    const room = a.layers.room;
    const cx = DOOR_HOLE.x + Math.floor(DOOR_HOLE.w / 2);
    const cy = DOOR_HOLE.y + Math.floor(DOOR_HOLE.h / 2);
    expect(room.alphaAt(cx, cy)).toBe(0);
    // Everything outside the hole is painted: no gaps for the slab to show through.
    let holes = 0;
    for (let y = 0; y < room.height; y++) {
      for (let x = 0; x < room.width; x++) {
        const inHole =
          x >= DOOR_HOLE.x - 1 &&
          x <= DOOR_HOLE.x + DOOR_HOLE.w &&
          y >= DOOR_HOLE.y - 1 &&
          y <= DOOR_HOLE.y + DOOR_HOLE.h;
        if (!inHole && room.alphaAt(x, y) === 0) holes++;
      }
    }
    expect(holes).toBe(0);
    // The floor in front of the slab occludes it as it sinks.
    expect(room.alphaAt(cx, DOOR_HOLE.y + DOOR_HOLE.h + 1)).toBe(255);
    expect(a.spill.length).toBeGreaterThan(500);
    expect(a.channel.length).toBeGreaterThan(50);
  });
});
