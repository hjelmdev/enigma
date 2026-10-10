import type { GlyphId } from '../art/glyphs.ts';

/**
 * The Sun Seal: three concentric stone rings, each carrying eight glyphs. A
 * bronze window at twelve o'clock shows one glyph per ring, read top to
 * bottom: outer, middle, inner. The stele in the chamber shows the answer as
 * a picture (sun above scarab above mountains), so the player has to look,
 * not guess.
 *
 * The twist that makes it a puzzle rather than a combination lock: each ring
 * is pinned to the ring inside it. Turning the outer ring also turns the
 * middle ring one step; turning the middle ring also turns the inner ring.
 * The inner ring turns alone. Working outside-in always solves it.
 *
 * Pure data and functions only; no Phaser.
 */

export const RING_COUNT = 3;
export const SLOTS = 8;

export type RingIndex = 0 | 1 | 2; // 0 = outer, 2 = inner
export type Direction = 1 | -1; // 1 = clockwise

export interface SunSealDefinition {
  /** Glyphs per ring in slot order. Slot 0 of every ring is its answer. */
  rings: readonly (readonly GlyphId[])[];
  /** Ring rotations at the start, in slot steps (0 = solved position). */
  initial: readonly number[];
}

export interface SunSealState {
  /** Clockwise rotation of each ring in slot steps, 0..SLOTS-1. */
  rotations: number[];
  solved: boolean;
}

export const SUN_SEAL: SunSealDefinition = {
  rings: [
    ['sun', 'feather', 'moon', 'ankh', 'star', 'lotus', 'eye', 'water'],
    ['scarab', 'cobra', 'djed', 'falcon', 'reed', 'owl', 'fish', 'hand'],
    ['mountain', 'bread', 'vase', 'house', 'sedge', 'basket', 'shen', 'water'],
  ],
  initial: [3, 6, 2],
};

/** Rings that move when `ring` is turned, outermost first. */
export function linkedRings(ring: RingIndex): RingIndex[] {
  return ring === 0 ? [0, 1] : ring === 1 ? [1, 2] : [2];
}

export function wrap(step: number) {
  return ((step % SLOTS) + SLOTS) % SLOTS;
}

export function validateDefinition(def: SunSealDefinition): string[] {
  const problems: string[] = [];
  if (def.rings.length !== RING_COUNT) problems.push('ring count');
  def.rings.forEach((ring, i) => {
    if (ring.length !== SLOTS) problems.push(`ring ${i} slot count`);
    if (new Set(ring).size !== ring.length)
      problems.push(`ring ${i} repeats a glyph`);
  });
  const answers = def.rings.map((ring) => ring[0]);
  def.rings.forEach((ring, i) => {
    answers.forEach((answer, j) => {
      if (i !== j && ring.includes(answer)) {
        problems.push(`answer ${answer} also appears on ring ${i}`);
      }
    });
  });
  if (def.initial.length !== RING_COUNT) problems.push('initial length');
  if (def.initial.every((r) => wrap(r) === 0)) problems.push('starts solved');
  return problems;
}

export function createState(def: SunSealDefinition = SUN_SEAL): SunSealState {
  const rotations = def.initial.map(wrap);
  return { rotations, solved: isSolved(rotations) };
}

export function isSolved(rotations: readonly number[]) {
  return (
    rotations.length === RING_COUNT && rotations.every((r) => wrap(r) === 0)
  );
}

/** Turns a ring one slot. Solved seals are locked and ignore input. */
export function turn(
  state: SunSealState,
  ring: RingIndex,
  direction: Direction,
): SunSealState {
  if (state.solved) return state;
  const rotations = [...state.rotations];
  for (const r of linkedRings(ring))
    rotations[r] = wrap(rotations[r] + direction);
  return { rotations, solved: isSolved(rotations) };
}

/** Slot index shown in the twelve o'clock window for a ring. */
export function slotAtWindow(rotation: number) {
  return wrap(-rotation);
}

export function windowGlyphs(
  state: SunSealState,
  def: SunSealDefinition = SUN_SEAL,
): GlyphId[] {
  return state.rotations.map((r, i) => def.rings[i][slotAtWindow(r)]);
}

/**
 * Shortest outside-in solution. Used by tests to prove solvability and by the
 * final hint to describe the next useful move.
 */
export function solve(
  state: SunSealState,
): { ring: RingIndex; direction: Direction }[] {
  const moves: { ring: RingIndex; direction: Direction }[] = [];
  let current = { ...state, rotations: [...state.rotations], solved: false };
  for (const ring of [0, 1, 2] as RingIndex[]) {
    const r = wrap(current.rotations[ring]);
    if (r === 0) continue;
    const direction: Direction = r <= SLOTS / 2 ? -1 : 1;
    const count = direction === -1 ? r : SLOTS - r;
    for (let i = 0; i < count; i++) {
      moves.push({ ring, direction });
      current = turn({ ...current, solved: false }, ring, direction);
    }
  }
  return moves;
}

export interface SerializedSunSeal {
  rotations: number[];
  solved: boolean;
}

export function serialize(state: SunSealState): SerializedSunSeal {
  return { rotations: [...state.rotations], solved: state.solved };
}

/** Accepts only well-formed data; anything else falls back to a fresh seal. */
export function deserialize(
  data: unknown,
  def: SunSealDefinition = SUN_SEAL,
): SunSealState {
  if (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as SerializedSunSeal).rotations) &&
    (data as SerializedSunSeal).rotations.length === RING_COUNT &&
    (data as SerializedSunSeal).rotations.every(
      (r) => Number.isInteger(r) && r >= 0 && r < SLOTS,
    )
  ) {
    const rotations = [...(data as SerializedSunSeal).rotations];
    return { rotations, solved: isSolved(rotations) };
  }
  return createState(def);
}

/** Hint ladder: observe → reason → next step. */
export const HINTS = [
  'Titta på stelen på vänstra väggen. Bilden där liknar något på sigillet.',
  'Läs bronsfönstret uppifrån och ned: yttre ringen överst, inre närmast mitten. Det ska visa samma bild som stelen: solen, skarabén, bergen. Märk att en ring drar med sig ringen innanför.',
  'Börja utifrån: ställ solskivan i fönstret med den yttre ringen, sedan skarabén med den mellersta, sist bergen med den inre.',
] as const;
