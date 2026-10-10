// Shared palette, lighting and stone helpers for the entrance-hall art.
// Interior lighting: cool indigo ambient in the recesses, warm amber from
// braziers and torches, a pale gold shaft of daylight over the map pedestal.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from '../prologue-art/glyphs.mjs';
import {
  Raster,
  rampColor,
  fbm,
  noise,
  hex,
  mix,
  bayer,
  rng,
} from '../prologue-art/raster.mjs';

export { Raster, rampColor, fbm, noise, hex, mix, bayer, rng, ROOT };

export const HALL_LAYOUT = JSON.parse(
  readFileSync(path.join(ROOT, 'src/game/hall/hallLayout.json'), 'utf8'),
);

const hallSheet = JSON.parse(
  readFileSync(path.join(ROOT, 'src/game/hall/hallGlyphs.json'), 'utf8'),
);
export const HALL_GLYPHS = hallSheet.glyphs;

/** Stone ramp: cold indigo shadow → warm torch-lit limestone. */
export const STONE = [
  '#0c0a15',
  '#151223',
  '#1f1a30',
  '#2b243d',
  '#3b3048',
  '#4f3e4f',
  '#664d53',
  '#7f5f56',
  '#99725b',
  '#b38861',
  '#cb9e6c',
  '#dfb67c',
  '#efcc93',
  '#f8e0b0',
];

export const PAL = {
  lapis: ['#0f1736', '#182a57', '#22407c', '#2f5aa0', '#4a7cc0'],
  turquoise: ['#123536', '#1d5552', '#2b7a70', '#46a191', '#7cc7b0'],
  ochreRed: ['#2a0f12', '#4e1a18', '#7a2c21', '#a3432c', '#c4623a'],
  gold: ['#2a1a0c', '#5a3714', '#8d5c1f', '#c38a32', '#e9b84f', '#fbe08c'],
  bronze: [
    '#1d140f',
    '#3c2614',
    '#6b4421',
    '#9c6a33',
    '#c99147',
    '#ebbd6a',
    '#fbe3a6',
  ],
  skin: ['#2a120d', '#5a2a18', '#8a4526', '#b4663a', '#cf8a52'],
  linen: ['#3a3440', '#6f6870', '#a59c96', '#d8cfc0', '#f1ead8'],
  ink: '#0a0810',
  flame: ['#fff6d0', '#ffd77a', '#ffad4a', '#f07a2e', '#b8441e'],
};

/**
 * Light field for a scene: ambient plus point lights {x, y, r, i} and an
 * optional shaft. Returns a value roughly 0..1.2.
 */
export function makeLight(lights, ambient = 0.18, extra = () => 0) {
  return (x, y) => {
    let l = ambient;
    for (const p of lights) {
      const d = Math.hypot((x - p.x) / (p.sx ?? 1), (y - p.y) / (p.sy ?? 1));
      l += p.i / (1 + (d / p.r) ** 2);
    }
    return l + extra(x, y);
  };
}

/** Quantised, dithered lighting of a pigment: keeps a small palette. */
export function litColor(pigment, l, x, y, steps = 6) {
  const base = typeof pigment === 'string' ? hex(pigment) : pigment;
  const shadow = hex('#120e1c');
  const warm = hex('#ffd9a0');
  const t = Math.max(0, Math.min(1.25, l));
  const q = t * steps;
  const lo = Math.floor(q);
  const level = (q - lo > bayer(x, y) ? lo + 1 : lo) / steps;
  if (level <= 1) return mix(shadow, base, level);
  return mix(base, warm, Math.min(1, (level - 1) * 1.6));
}

/** Pick from a ramp by light with ordered dithering. */
export function litRamp(ramp, l, x, y, dither = 0.9) {
  return rampColor(ramp, l, x, y, dither);
}

/**
 * Ashlar masonry on a rectangle: blocks with mortar joints, per-block tone,
 * grain, chipped corners. `light(x, y)` gives the light field.
 */
export function paintAshlar(r, x0, y0, w, h, light, seed, opts = {}) {
  const rand = rng(seed);
  const courseH = opts.courseH ?? 22;
  const tone = new Map();
  const ramp = opts.ramp ?? STONE;
  for (let y = y0; y < y0 + h; y++) {
    const row = Math.floor((y - y0) / courseH);
    const yIn = (y - y0) % courseH;
    const off = ((row * 37) % 5) * 13 + (row % 2) * 24;
    for (let x = x0; x < x0 + w; x++) {
      if (opts.mask && !opts.mask(x, y)) continue;
      const bw = opts.blockW ?? 48;
      const local = x - x0 + off;
      const block = Math.floor(local / bw);
      const k = row * 4096 + block;
      if (!tone.has(k)) tone.set(k, (rand() - 0.5) * 0.09);
      const xIn = local % bw;
      let t = light(x, y) + tone.get(k);
      t += (fbm(x / 9, y / 6, seed, 2) - 0.5) * 0.08;
      t += (noise(x / 2.5, y / 2.5, seed + 3) - 0.5) * 0.035;
      if (yIn === 0 || xIn === 0) t -= 0.16;
      else if (yIn === 1 || xIn === 1) t += 0.035;
      else if (yIn === courseH - 1 || xIn === bw - 1) t -= 0.05;
      // Chipped block corners.
      const corner =
        (xIn < 3 && yIn < 3 && xIn + yIn < 3 && (k * 7) % 5 === 0) ||
        (xIn > bw - 4 && yIn > courseH - 4 && (k * 11) % 7 === 0);
      if (corner) t -= 0.12;
      r.set(x, y, rampColor(ramp, t, x, y, 0.85));
    }
  }
}

/** Visit cells of a hall glyph at an integer scale. */
export function forHallGlyph(name, scale, visit) {
  const rows = HALL_GLYPHS[name];
  const at = (c, rr) =>
    rr < 0 || c < 0 || rr >= 16 || c >= 16 ? '.' : rows[rr][c];
  for (let rr = 0; rr < 16; rr++)
    for (let c = 0; c < 16; c++)
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++)
          visit(c * scale + sx, rr * scale + sy, {
            on: at(c, rr) === '#',
            above: sy > 0 ? at(c, rr) === '#' : at(c, rr - 1) === '#',
            left: sx > 0 ? at(c, rr) === '#' : at(c - 1, rr) === '#',
            below: sy < scale - 1 ? at(c, rr) === '#' : at(c, rr + 1) === '#',
            right: sx < scale - 1 ? at(c, rr) === '#' : at(c + 1, rr) === '#',
          });
}

/** Sunken relief of a hall glyph (shadowed top-left, lit lower lip). */
export function carveHallGlyph(r, name, ox, oy, scale, o = {}) {
  forHallGlyph(name, scale, (x, y, n) => {
    const px = ox + x;
    const py = oy + y;
    if (n.on) {
      if (o.fill) r.set(px, py, o.fill(x, y));
      else
        r.tint(
          px,
          py,
          o.shadow ?? '#140f1c',
          !n.above || !n.left ? 0.62 : 0.42,
        );
    } else if (n.above || n.left) {
      r.tint(px, py, o.lip ?? '#ffe2b0', o.lipAmount ?? 0.25);
    }
  });
}

/** Additive radial glow written as premultiplied-friendly alpha. */
export function glow(r, cx, cy, radius, color, strength = 1, sy = 1) {
  const c = typeof color === 'string' ? hex(color) : color;
  for (let y = Math.floor(cy - radius * sy); y <= cy + radius * sy; y++)
    for (let x = Math.floor(cx - radius); x <= cx + radius; x++) {
      const d = Math.hypot(x - cx, (y - cy) / sy) / radius;
      if (d >= 1 || !r.inside(x, y)) continue;
      const a = (1 - d) ** 2 * strength;
      // Dithered alpha steps keep it pixel-art rather than airbrushed.
      const q = Math.floor(a * 8 + bayer(x, y)) / 8;
      if (q <= 0) continue;
      const old = r.get(x, y);
      const na = Math.min(255, old[3] + q * 255);
      r.set(x, y, c, 255);
      r.data[(y * r.width + x) * 4 + 3] = na;
    }
}
