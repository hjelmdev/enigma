import {
  ROOM,
  STAND,
  STAND_RECT,
  STELE,
  VIEW,
  scaleAt,
  type Vec3,
} from '../layout.ts';
import { glyph, glyphOn } from './glyphs.ts';
import { lightAt, tone } from './lighting.ts';
import { RAMPS, inlayValue } from './materialMap.ts';
import { PALETTE, type RampName, type Rgb } from './palette.ts';
import { PixelCanvas, bayer, createRng, quantize } from './pixelCanvas.ts';
import { buildSteleMap } from './steleArt.ts';

function pick(
  ramp: RampName,
  x: number,
  y: number,
  value: number,
  delta = 0,
): Rgb {
  const colors = PALETTE[ramp];
  const i =
    quantize(x, y, Math.max(0, Math.min(1, value)), colors.length) + delta;
  return colors[Math.max(0, Math.min(colors.length - 1, i))];
}

// ---------------------------------------------------------------------------
// The seal stand: ray-cast boxes so it sits in the room's perspective.

interface Box {
  min: Vec3;
  max: Vec3;
  ramp: RampName;
  name: string;
}

const X = STAND.x;
const Z = STAND.z;
const BOXES: Box[] = [
  {
    name: 'plinth',
    ramp: 'sandstone',
    min: { x: X - 0.95, y: 2.58, z: Z - 0.5 },
    max: { x: X + 0.95, y: 3, z: Z + 0.5 },
  },
  {
    name: 'body',
    ramp: 'granite',
    min: { x: X - 0.62, y: 0.3, z: Z - 0.26 },
    max: { x: X + 0.62, y: 2.58, z: Z + 0.26 },
  },
  {
    name: 'cap',
    ramp: 'sandstone',
    min: { x: X - 0.72, y: 0.12, z: Z - 0.34 },
    max: { x: X + 0.72, y: 0.3, z: Z + 0.34 },
  },
];

/** A shaft of daylight from a ceiling vent falls on the stand. */
const SHAFT_DIR = (() => {
  const d = { x: 0.25, y: 1, z: 0.35 };
  const l = Math.hypot(d.x, d.y, d.z);
  return { x: d.x / l, y: d.y / l, z: d.z / l };
})();

function intersectBox(o: Vec3, d: Vec3, b: Box) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let axis = 0;
  let sign = 1;
  const keys = ['x', 'y', 'z'] as const;
  for (let i = 0; i < 3; i++) {
    const k = keys[i];
    if (Math.abs(d[k]) < 1e-9) {
      if (o[k] < b.min[k] || o[k] > b.max[k]) return null;
      continue;
    }
    let t1 = (b.min[k] - o[k]) / d[k];
    let t2 = (b.max[k] - o[k]) / d[k];
    let s = -1;
    if (t1 > t2) {
      [t1, t2] = [t2, t1];
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      axis = i;
      sign = s;
    }
    tmax = Math.min(tmax, t2);
  }
  if (tmin > tmax || tmax < 0) return null;
  const n = { x: 0, y: 0, z: 0 };
  n[keys[axis]] = sign;
  return { t: tmin, n };
}

export function renderStand() {
  const r = STAND_RECT;
  const canvas = new PixelCanvas(r.w, r.h);
  const s = scaleAt(Z);
  const discCx = VIEW.vx + X * s - r.x;
  const discCy = VIEW.vy + STAND.discCenterY * s - r.y;
  const discR = STAND.discRadius * s;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const d = {
        x: (r.x + x + 0.5 - VIEW.vx) / VIEW.focal,
        y: (r.y + y + 0.5 - VIEW.vy) / VIEW.focal,
        z: 1,
      };
      let best: { t: number; n: Vec3; box: Box } | null = null;
      for (const box of BOXES) {
        const hit = intersectBox({ x: 0, y: 0, z: 0 }, d, box);
        if (hit && (!best || hit.t < best.t)) best = { ...hit, box };
      }
      // Disc backing: a thick sandstone ring around the seal.
      const ddx = x + 0.5 - discCx;
      const ddy = y + 0.5 - discCy;
      const dr = Math.hypot(ddx, ddy);
      if (dr < discR + 3) {
        const facing = -(ddx * -0.6 + ddy * -0.8) / (dr || 1);
        const delta =
          dr > discR + 1.5 ? (facing < 0 ? 1 : -2) : dr > discR ? -2 : 0;
        canvas.put(
          x,
          y,
          pick('sandstone', x, y, 0.5 - ddy / (discR * 6), delta),
        );
        continue;
      }
      if (!best) {
        // Contact shadow on the floor around the plinth.
        if (d.y > 0) {
          const fz = ROOM.floorY / d.y;
          const fx = d.x * fz;
          const ex = Math.max(0, Math.abs(fx - X) - 0.95);
          const ez = Math.max(0, Math.abs(fz - Z) - 0.5);
          const dist = Math.hypot(ex, ez);
          if (dist < 0.22 && bayer(x, y) + 0.5 > dist / 0.22)
            canvas.put(x, y, PALETTE.void[1], 150);
        }
        continue;
      }
      const p = { x: d.x * best.t, y: d.y * best.t, z: best.t };
      const n = best.n;
      let light = lightAt(p, n);
      light +=
        0.95 *
        Math.max(
          0,
          -(n.x * SHAFT_DIR.x + n.y * SHAFT_DIR.y + n.z * SHAFT_DIR.z),
        );
      let value = tone(light);
      let ramp = best.box.ramp;
      let delta = 0;
      // Edges: lit arris on top edges, dark on vertical corners.
      const fyTop = p.y - best.box.min.y;
      if (n.z !== 0 && fyTop < 0.05) delta += 1;
      if (
        n.z !== 0 &&
        Math.min(p.x - best.box.min.x, best.box.max.x - p.x) < 0.035
      )
        delta -= 1;
      if (best.box.name === 'body' && n.z < 0) {
        // Faience bands and a carved ankh on the body front.
        if (Math.abs(p.y - 0.62) < 0.07 || Math.abs(p.y - 2.3) < 0.07) {
          ramp = 'turquoise';
          value = inlayValue(ramp, value);
        } else {
          const gx = Math.floor(((p.x - (X - 0.27)) / 0.54) * 13);
          const gy = Math.floor(((p.y - 1.02) / 0.54) * 13);
          if (glyphOn(glyph('ankh'), gx, gy)) {
            ramp = 'gold';
            value = inlayValue(ramp, value);
          }
        }
      }
      canvas.put(x, y, pick(ramp, x, y, value, delta));
    }
  }
  return {
    stand: canvas,
    /** Where the in-room seal miniature sits, in stand-local pixels. */
    disc: {
      x: Math.round(discCx),
      y: Math.round(discCy),
      r: Math.round(discR),
    },
  };
}

// ---------------------------------------------------------------------------
// Fire

export const FLAME_W = 13;
export const FLAME_H = 22;
export const FLAME_FRAMES = 6;

/** Hand-shaped flame frames: a teardrop that sways, with licks at the tip. */
export function renderFlames() {
  const frames: PixelCanvas[] = [];
  const rng = createRng(808);
  for (let f = 0; f < FLAME_FRAMES; f++) {
    const c = new PixelCanvas(FLAME_W, FLAME_H);
    const phase = (f / FLAME_FRAMES) * Math.PI * 2;
    const cx = FLAME_W / 2;
    for (let y = 0; y < FLAME_H; y++) {
      const t = 1 - (y + 0.5) / FLAME_H; // 0 at the base, 1 at the tip
      const sway = Math.sin(phase + t * 3.2) * t * 1.8;
      const width =
        5.2 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.12)) * (1 - t) ** 0.35;
      for (let x = 0; x < FLAME_W; x++) {
        const dx = (x + 0.5 - cx - sway) / Math.max(0.4, width);
        if (Math.abs(dx) > 1) continue;
        const heat = (1 - Math.abs(dx)) * (1 - t * 0.85);
        const level =
          heat > 0.62
            ? 5
            : heat > 0.45
              ? 4
              : heat > 0.28
                ? 3
                : heat > 0.12
                  ? 2
                  : 1;
        c.put(x, y, PALETTE.fire[level]);
      }
    }
    // Two detached licks above the tip.
    for (let i = 0; i < 2; i++) {
      const lx = Math.round(cx + Math.sin(phase * (i + 1) + i) * 2);
      const ly = rng.int(0, 3);
      c.put(lx, ly, PALETTE.fire[2]);
      c.put(lx, ly + 1, PALETTE.fire[3]);
    }
    frames.push(c);
  }
  return frames;
}

/** Banded, dithered warm glow for additive blending around each torch. */
export function renderGlow(radius = 34) {
  const size = radius * 2;
  const c = new PixelCanvas(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d =
        Math.hypot(x + 0.5 - radius, (y + 0.5 - radius) * 1.15) / radius;
      if (d >= 1) continue;
      const v = (1 - d) ** 1.6 + bayer(x, y) * 0.12;
      const band = Math.floor(v * 5);
      if (band <= 0) continue;
      c.put(
        x,
        y,
        PALETTE.fire[Math.min(4, 1 + band)],
        Math.min(255, band * 34),
      );
    }
  }
  return c;
}

/** The stele shaded flat for its close-up. */
export function renderSteleFlat() {
  const map = buildSteleMap();
  const canvas = new PixelCanvas(STELE.artW, STELE.artH);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const v = 0.68 - (x / map.width) * 0.12 - (y / map.height) * 0.14;
      const r = map.rampAt(x, y);
      if (r === 255) continue;
      const c = map.shade(x, y, inlayValue(RAMPS[r], v));
      if (c) canvas.put(x, y, c);
    }
  }
  return canvas;
}
