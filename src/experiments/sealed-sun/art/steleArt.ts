import { STELE } from '../layout.ts';
import { glyph, glyphOn, type GlyphId } from './glyphs.ts';
import { MaterialMap } from './materialMap.ts';
import type { RampName } from './palette.ts';
import { createRng } from './pixelCanvas.ts';

/**
 * The clue stele: a round-topped limestone stela. Its lunette shows the
 * dawn image — the sun disc above the scarab above the mountains — painted
 * in the same colours as the three rings of the Sun Seal (gold, lapis,
 * ochre). The lower register is decorative text, not part of the puzzle.
 */
export const STELE_VIGNETTE: { glyph: GlyphId; ramp: RampName }[] = [
  { glyph: 'sun', ramp: 'gold' },
  { glyph: 'scarab', ramp: 'lapis' },
  { glyph: 'mountain', ramp: 'ochreRed' },
];

const TEXT_COLUMNS: { glyph: GlyphId; ramp: RampName }[][] = [
  [
    { glyph: 'ankh', ramp: 'lapis' },
    { glyph: 'reed', ramp: 'ochreRed' },
    { glyph: 'water', ramp: 'lapis' },
  ],
  [
    { glyph: 'djed', ramp: 'ochreRed' },
    { glyph: 'owl', ramp: 'lapis' },
    { glyph: 'bread', ramp: 'ochreRed' },
  ],
];

/** Carves a glyph as painted sunken relief, scaled by an integer factor. */
export function carveGlyph(
  map: MaterialMap,
  id: GlyphId,
  left: number,
  top: number,
  ramp: RampName,
  scale = 1,
) {
  const g = glyph(id);
  const on = (x: number, y: number) =>
    glyphOn(g, Math.floor(x / scale), Math.floor(y / scale));
  const size = g.size * scale;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!on(x, y)) continue;
      let delta = 0;
      if (!on(x - 1, y) || !on(x, y - 1)) delta = -2;
      else if (!on(x + 1, y) || !on(x, y + 1)) delta = 1;
      map.set(left + x, top + y, ramp, delta);
    }
  }
  // A lit lip on the stone just below/right of the cut, a dark lip above/left.
  for (let y = -1; y <= size; y++) {
    for (let x = -1; x <= size; x++) {
      if (on(x, y)) continue;
      if (on(x + 1, y) || on(x, y + 1)) map.shift(left + x, top + y, -1);
      else if (on(x - 1, y) || on(x, y - 1)) map.shift(left + x, top + y, 1);
    }
  }
}

function carvedLine(map: MaterialMap, x0: number, x1: number, y: number) {
  for (let x = x0; x <= x1; x++) {
    map.shift(x, y, -2);
    map.shift(x, y + 1, 1);
  }
}

export function buildSteleMap() {
  const w = STELE.artW;
  const h = STELE.artH;
  const map = new MaterialMap(w, h);
  const arch = 24;
  const inside = (x: number, y: number) => {
    if (y >= arch) return x >= 0 && x < w;
    const dx = (x + 0.5 - w / 2) / (w / 2);
    const dy = (arch - y - 0.5) / arch;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const rim = !inside(x - 1, y) || !inside(x, y - 1);
      const rimLow = !inside(x + 1, y) || !inside(x, y + 1) || y >= h - 1;
      map.set(x, y, 'limestone', rim ? 1 : rimLow ? -2 : 0);
    }
  }
  // Carved frame line, following the arch.
  for (let y = 0; y < h - 6; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const inner = (xx: number, yy: number) =>
        inside(xx - 4, yy) &&
        inside(xx + 4, yy) &&
        inside(xx, yy - 4) &&
        yy < h - 8;
      if (inner(x, y) && (!inner(x - 1, y) || !inner(x, y - 1)))
        map.shift(x, y, -2);
      else if (inner(x, y) && (!inner(x + 1, y) || !inner(x, y + 1)))
        map.shift(x, y, 1);
    }
  }
  // Lunette: the dawn image, drawn large.
  const cx = Math.floor(w / 2) - 13;
  STELE_VIGNETTE.forEach((item, i) => {
    carveGlyph(map, item.glyph, cx, 12 + i * 29, item.ramp, 2);
  });
  // A thin horizon line under the mountains, and the register divider.
  carvedLine(map, 10, w - 11, 102);
  carvedLine(map, 10, w - 11, 105);
  // Lower register: two text columns between carved column rules.
  TEXT_COLUMNS.forEach((column, c) => {
    const left = 21 + c * 30;
    column.forEach((item, r) =>
      carveGlyph(map, item.glyph, left, 111 + r * 16, item.ramp),
    );
  });
  for (let y = 109; y < h - 10; y++) {
    for (const x of [16, 41, 67]) {
      map.shift(x, y, -2);
      map.shift(x + 1, y, 1);
    }
  }
  // Weathering: one diagonal crack and a few chips, placed, not sprinkled.
  const rng = createRng(4402);
  let x = 58;
  for (let y = 120; y < h - 4; y++) {
    if (rng.next() < 0.45) x += rng.next() < 0.6 ? 1 : -1;
    map.shift(x, y, -3);
    map.shift(x + 1, y, 1);
  }
  for (let i = 0; i < 7; i++) {
    const px = rng.int(6, w - 8);
    const py = rng.int(30, h - 8);
    map.shift(px, py, -2);
    map.shift(px + 1, py + 1, 1);
  }
  return map;
}
