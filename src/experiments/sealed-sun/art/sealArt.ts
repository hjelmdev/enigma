import { SUN_SEAL, SLOTS } from '../puzzle/sunSeal.ts';
import { glyph, glyphOn } from './glyphs.ts';
import { PALETTE, type RampName, type Rgb } from './palette.ts';
import { PixelCanvas, bayer, quantize } from './pixelCanvas.ts';

/**
 * The Sun Seal close-up. The plate is drawn once; the rings are re-drawn
 * analytically at any angle (no sprite rotation), so the pixel art stays
 * crisp while a ring turns. Glyphs stay upright, like numerals on a dial.
 */
export const SEAL_SIZE = 232;
const C = SEAL_SIZE / 2;

export interface RingStyle {
  inner: number;
  outer: number;
  glyphRadius: number;
  stone: RampName;
  inlay: RampName;
}

export const RING_STYLES: RingStyle[] = [
  { inner: 79, outer: 104, glyphRadius: 91.5, stone: 'granite', inlay: 'gold' },
  { inner: 54, outer: 78, glyphRadius: 66, stone: 'sandstone', inlay: 'lapis' },
  {
    inner: 29,
    outer: 53,
    glyphRadius: 41,
    stone: 'limestone',
    inlay: 'ochreRed',
  },
];
const HUB = 28;
const WINDOW_HALF = 10;

const LIGHT = { x: -0.62, y: -0.78 };

function flatLight(x: number, y: number) {
  // Raking light from the upper left across the whole plate.
  return 0.6 - ((x - C) * 0.55 + (y - C) * 0.75) / (SEAL_SIZE * 1.6);
}

function pick(
  ramp: RampName,
  x: number,
  y: number,
  value: number,
  delta = 0,
): Rgb {
  const colors = PALETTE[ramp];
  const i =
    quantize(x, y, Math.max(0, Math.min(1, value)), colors.length, 0.35) +
    delta;
  return colors[Math.max(0, Math.min(colors.length - 1, i))];
}

/** The fixed stone plate behind the rings. */
export function renderSealPlate() {
  const plate = new PixelCanvas(SEAL_SIZE, SEAL_SIZE);
  for (let y = 0; y < SEAL_SIZE; y++) {
    for (let x = 0; x < SEAL_SIZE; x++) {
      const chamfer = Math.min(x, y, SEAL_SIZE - 1 - x, SEAL_SIZE - 1 - y);
      const corner = Math.min(
        x + y,
        SEAL_SIZE - 1 - x + y,
        x + SEAL_SIZE - 1 - y,
        2 * SEAL_SIZE - 2 - x - y,
      );
      if (corner < 14) continue;
      let delta = 0;
      if (chamfer < 2 || corner < 16) delta = x + y < SEAL_SIZE ? 2 : -2;
      else if (chamfer === 6) delta = -2;
      else if (chamfer === 7) delta = 1;
      const r = Math.hypot(x + 0.5 - C, y + 0.5 - C);
      // Carved channel around the rings, and rays in the corners.
      if (r > 104 && r < 107) delta = -3;
      else if (r >= 107 && r < 108.5) delta = 1;
      const a = Math.atan2(y - C, x - C);
      if (r > 110 && chamfer > 9 && Math.abs(Math.sin(a * 8)) < 0.07)
        delta = -1;
      plate.put(x, y, pick('sandstone', x, y, flatLight(x, y) - 0.05, delta));
    }
  }
  return plate;
}

export interface SealDrawOptions {
  /** Ring angles in slot steps (fractional while animating). */
  angles: number[];
  selected: number | null;
  /** 0..1 glow along the window column and hub when solved. */
  glow: number;
}

/** Draws the rings, hub and window over a copy of the plate. */
export function drawSeal(
  target: PixelCanvas,
  plate: PixelCanvas,
  opts: SealDrawOptions,
) {
  target.data.set(plate.data);
  for (let y = 0; y < SEAL_SIZE; y++) {
    for (let x = 0; x < SEAL_SIZE; x++) {
      const dx = x + 0.5 - C;
      const dy = y + 0.5 - C;
      const r = Math.hypot(dx, dy);
      if (r >= 104.5) continue;
      const base = flatLight(x, y);
      if (r < HUB) {
        // Gold sun boss: domed, with a ring of rays.
        const dome = 1 - r / HUB;
        const facing = -(dx * LIGHT.x + dy * LIGHT.y) / (r || 1);
        let v = 0.45 + dome * 0.3 - facing * 0.18 * (1 - dome);
        let delta = 0;
        if (r > HUB - 2) delta = -2;
        else if (r > 17 && r < 19) delta = -1;
        if (opts.glow > 0) v += opts.glow * 0.5;
        target.put(x, y, pick('gold', x, y, v, delta));
        continue;
      }
      const ring = RING_STYLES.findIndex((s) => r >= s.inner && r < s.outer);
      if (ring < 0) {
        // Gap between rings: a deep shadow line.
        target.put(x, y, PALETTE.void[1]);
        continue;
      }
      const s = RING_STYLES[ring];
      let delta = 0;
      const nx = dx / r;
      const ny = dy / r;
      const facing = nx * LIGHT.x + ny * LIGHT.y;
      if (r > s.outer - 2) delta = facing > 0.25 ? 1 : facing < -0.25 ? -2 : 0;
      else if (r < s.inner + 2)
        delta = facing < -0.25 ? 1 : facing > 0.25 ? -2 : 0;
      // Slot dividers rotate with the ring.
      const angle = Math.atan2(dy, dx);
      const slotPos =
        ((angle + Math.PI / 2) / (Math.PI * 2)) * SLOTS - opts.angles[ring];
      const frac = slotPos - Math.floor(slotPos);
      const fromDivider = (Math.abs(frac - 0.5) * (2 * Math.PI * r)) / SLOTS;
      if (fromDivider < 0.75 && r > s.inner + 2 && r < s.outer - 2) delta -= 2;
      else if (
        fromDivider < 1.6 &&
        r > s.inner + 2 &&
        r < s.outer - 2 &&
        frac > 0.5
      )
        delta += 1;
      if (opts.selected === ring && (r > s.outer - 2 || r < s.inner + 2)) {
        target.put(x, y, pick('gold', x, y, 0.82 + bayer(x, y) * 0.1));
        continue;
      }
      target.put(x, y, pick(s.stone, x, y, base, delta));
    }
  }
  // Glyphs, upright, at their rotated slot centres.
  RING_STYLES.forEach((s, ring) => {
    const glyphs = SUN_SEAL.rings[ring];
    for (let j = 0; j < SLOTS; j++) {
      const a = -Math.PI / 2 + ((j + opts.angles[ring]) * Math.PI * 2) / SLOTS;
      const gx = Math.round(C + Math.cos(a) * s.glyphRadius - 6.5);
      const gy = Math.round(C + Math.sin(a) * s.glyphRadius - 6.5);
      const atWindow =
        Math.abs(Math.cos(a) * s.glyphRadius) < WINDOW_HALF && Math.sin(a) < 0;
      stampGlyph(target, glyphs[j], gx, gy, s, atWindow ? opts.glow : 0);
    }
  });
  drawWindow(target, opts.glow);
}

function stampGlyph(
  target: PixelCanvas,
  id: (typeof SUN_SEAL.rings)[number][number],
  left: number,
  top: number,
  style: RingStyle,
  glow: number,
) {
  const g = glyph(id);
  // Carved outline first so the inlay reads on any stone.
  for (let y = -1; y <= g.size; y++) {
    for (let x = -1; x <= g.size; x++) {
      if (glyphOn(g, x, y)) continue;
      const near =
        glyphOn(g, x + 1, y) ||
        glyphOn(g, x - 1, y) ||
        glyphOn(g, x, y + 1) ||
        glyphOn(g, x, y - 1);
      if (near) {
        const lit = glyphOn(g, x - 1, y) || glyphOn(g, x, y - 1);
        target.put(
          left + x,
          top + y,
          lit
            ? pick(style.stone, left + x, top + y, 0.75)
            : PALETTE[style.stone][1],
        );
      }
    }
  }
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!glyphOn(g, x, y)) continue;
      const edge = !glyphOn(g, x - 1, y) || !glyphOn(g, x, y - 1);
      const v =
        (style.inlay === 'gold' ? 0.62 : 0.6) +
        (edge ? -0.12 : 0.04) +
        glow * 0.35;
      target.put(
        left + x,
        top + y,
        pick(glow > 0.3 ? 'gold' : style.inlay, left + x, top + y, v),
      );
    }
  }
}

function drawWindow(target: PixelCanvas, glow: number) {
  const x0 = C - WINDOW_HALF - 2;
  const x1 = C + WINDOW_HALF + 1;
  const y0 = C - 108;
  const y1 = C - HUB + 1;
  for (let y = y0; y <= y1; y++) {
    for (const [x, d] of [
      [x0, 1],
      [x0 + 1, 0],
      [x1 - 1, -1],
      [x1, -2],
    ] as const) {
      target.put(x, y, pick('bronze', x, y, 0.62, d));
    }
    // Inner shadow cast by the bronze frame onto the rings.
    if (y > y0 + 2) target.put(x0 + 2, y, PALETTE.void[2], 140);
  }
  // Pointer cap above the disc.
  for (let y = y0 - 7; y < y0; y++) {
    const half = Math.max(0, Math.floor((y - (y0 - 7)) * 0.9) + 2);
    for (let x = C - half - 1; x <= C + half; x++) {
      target.put(x, y, pick('bronze', x, y, 0.66, x < C ? 1 : -1));
    }
  }
  target.put(C - 1, y0 - 5, pick('gold', 0, 0, 0.9 + glow * 0.1));
  target.put(C, y0 - 5, pick('gold', 0, 0, 0.75));
  if (glow > 0) {
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0 + 2; x < x1 - 1; x++) {
        if (bayer(x, y) + 0.5 < glow * 0.35)
          target.put(x, y, PALETTE.gold[6], 90);
      }
    }
  }
}

/** Small in-room version on the stand: rings as bands with slot marks. */
export function drawSealMini(
  target: PixelCanvas,
  angles: number[],
  light: number,
  glow: number,
) {
  const size = target.width;
  const c = size / 2;
  target.data.fill(0);
  const scale = (c - 1) / 104;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy) / scale;
      if (r >= 104) continue;
      const v = light - (dx + dy) / (size * 3);
      if (r < HUB) {
        target.put(
          x,
          y,
          pick('gold', x, y, 0.5 + glow * 0.4 + (r < 14 ? 0.12 : 0)),
        );
        continue;
      }
      const ring = RING_STYLES.findIndex((s) => r >= s.inner && r < s.outer);
      if (ring < 0) {
        target.put(x, y, PALETTE.void[1]);
        continue;
      }
      const s = RING_STYLES[ring];
      const angle = Math.atan2(dy, dx);
      const slotPos =
        ((angle + Math.PI / 2) / (Math.PI * 2)) * SLOTS - angles[ring];
      const frac = slotPos - Math.floor(slotPos);
      const mid =
        Math.abs(r - s.glyphRadius) < 7 &&
        (Math.abs(frac - 0.5) * 2 * Math.PI * r * scale) / SLOTS > 1.2;
      const mark = mid && Math.abs(frac - 0.5) > 0.32;
      target.put(
        x,
        y,
        mark ? pick(s.inlay, x, y, 0.55 + glow * 0.3) : pick(s.stone, x, y, v),
      );
    }
  }
  for (let y = 0; y < Math.round(c - HUB * scale); y++)
    target.put(Math.floor(c), y, pick('bronze', 0, 0, 0.7));
}
