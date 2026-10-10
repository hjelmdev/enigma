// The entrance passage: a corbelled corridor sloping gently down from the
// opened door. Daylight from behind falls off quickly; ahead, the hall's
// teal-and-amber glow fills the far doorway. Ray-cast per pixel against the
// passage's real cross-section so the corbel steps and carvings recede
// correctly.
import {
  Raster,
  rampColor,
  fbm,
  hex,
  mix,
  bayer,
  STONE,
  PAL,
  HALL_LAYOUT,
  glow,
} from './common.mjs';
import { GLYPHS } from '../prologue-art/glyphs.mjs';

const C = HALL_LAYOUT.corridor;
const W = C.width;
const H = C.height;
const [VX, VY] = C.vanish;
const F = 300; // focal length in px
const END = 12; // depth of the far doorway
const FLOOR_Y = 1.0;
const WALL_TOP = -0.7;
const STEP_H = 0.24;
const STEPS = 5;
const STEP_IN = 0.11;

function halfWidthAt(level) {
  return 1 - STEP_IN * level;
}

/** Nearest surface hit for a view ray. */
function trace(dx, dy) {
  let best = { z: Infinity, kind: 'end' };
  const consider = (z, kind, extra) => {
    if (z > 0.15 && z < best.z) best = { z, kind, ...extra };
  };
  // Floor (slopes down: y grows slowly with z).
  const slope = 0.035;
  if (dy - slope > 0) consider(FLOOR_Y / (dy - slope), 'floor');
  // Walls and corbel faces.
  for (let level = 0; level <= STEPS; level++) {
    const w = halfWidthAt(level);
    const yTop = level === 0 ? WALL_TOP : WALL_TOP - STEP_H * level;
    const yBot = level === 0 ? FLOOR_Y + 2 : WALL_TOP - STEP_H * (level - 1);
    if (dx !== 0) {
      const z = (Math.sign(dx) * w) / dx;
      const y = dy * z;
      if (y >= yTop && y <= yBot)
        consider(z, 'wall', { level, side: Math.sign(dx), y });
    }
    // Underside of the next corbel step (facing down).
    if (level < STEPS && dy < 0) {
      const yU = WALL_TOP - STEP_H * level;
      const z = yU / dy;
      const x = Math.abs(dx * z);
      if (x <= w && x >= halfWidthAt(level + 1))
        consider(z, 'under', { level });
    }
  }
  // Roof slab.
  const yRoof = WALL_TOP - STEP_H * STEPS;
  if (dy < 0) {
    const z = yRoof / dy;
    if (Math.abs(dx * z) <= halfWidthAt(STEPS)) consider(z, 'roof');
  }
  if (best.z > END) best = { z: END, kind: 'end' };
  return best;
}

function lightAt(z) {
  const day = 0.95 * Math.exp(-z / 3.2);
  const hall = 0.55 * Math.exp(-(END - z) / 2.6);
  return { l: 0.06 + day + hall, day, hall };
}

export function paintCorridor() {
  const r = new Raster(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5 - VX) / F;
      const dy = (y + 0.5 - VY) / F;
      const hit = trace(dx, dy);
      const { l, day, hall } = lightAt(hit.z);
      let t = l;
      let pigment = null;
      if (hit.kind === 'end') {
        // Far doorway into the hall: dark frame around a glowing opening.
        const ex = dx * END;
        const ey = dy * END;
        const inDoor =
          Math.abs(ex) < 0.82 &&
          ey > WALL_TOP + 0.05 &&
          ey < FLOOR_Y + END * 0.035;
        if (inDoor) {
          // Silhouettes of the hall's columns against its glow.
          if (Math.abs(Math.abs(ex) - 0.5) < 0.09 && ey < 1.2) {
            r.set(x, y, hex('#22182a'));
            continue;
          }
          const v = Math.max(0, 1 - Math.hypot(ex / 0.9, (ey - 0.4) / 1.2));
          const c = mix(
            hex(PAL.turquoise[2]),
            hex('#ffc27a'),
            Math.min(1, v * 1.4),
          );
          r.set(x, y, mix(hex('#1a1424'), c, 0.35 + v * 0.65));
          continue;
        }
        t = 0.1 + hall * 0.7;
      } else if (hit.kind === 'floor') {
        const fz = hit.z;
        const fx = dx * fz;
        const step = Math.floor(fz * 1.4);
        const inStep = fz * 1.4 - step;
        t += (fbm(fx * 3, fz * 2, 5, 2) - 0.5) * 0.08;
        if (inStep < 0.06) t -= 0.12; // worn step edges
        if (inStep > 0.06 && inStep < 0.14) t += 0.05;
        // Sand blown in from outside, thinning with depth.
        const drift =
          Math.abs(fx) -
          0.55 +
          (fbm(fz * 0.7, fx, 11, 3) - 0.5) * 0.5 +
          fz * 0.015;
        if (drift > 0 || fz < 1.2 + fbm(fx * 3, 2, 12, 2) * 0.8)
          pigment = '#c9a06a';
      } else if (hit.kind === 'wall') {
        const z = hit.z;
        const wy = hit.y;
        const course = Math.floor((wy + 3) / 0.3);
        const inCourse = (wy + 3) / 0.3 - course;
        const blockLen = 1.6 + (course % 3) * 0.3;
        const bz = (z + course * 0.7) / blockLen;
        const inBlock = bz - Math.floor(bz);
        t *= 0.9 + (hit.side > 0 ? -0.08 : 0.04);
        t += (fbm(z * 3, wy * 6, 31, 2) - 0.5) * 0.07;
        if (inCourse < 0.04 || inBlock < 0.012 * (z + 1)) t -= 0.14;
        // Carved glyph registers on the lower wall: the canonical signs repeat.
        if (hit.level === 0 && wy > -0.4 && wy < 0.3 && hit.z > 2.4) {
          const names = ['sun', 'eye', 'steps', 'moon'];
          const cell = Math.floor(z / 0.9);
          const gz = (z / 0.9 - cell) * 1.9;
          const gy = (wy + 0.4) / 0.7;
          const band = Math.floor(gy * 3);
          const fy = gy * 3 - band;
          if (gz < 1 && cell > 0) {
            const rows =
              GLYPHS[names[(cell + band + (hit.side > 0 ? 2 : 0)) % 4]];
            const gx = Math.floor(gz * 16);
            const gyy = Math.floor(fy * 16);
            const c = rows[gyy]?.[gx];
            if (c && c !== '.') {
              t -= 0.18;
              if (c === '*') pigment = PAL.lapis[3];
            }
          }
        }
        // Painted band at the top of the wall.
        if (hit.level === 0 && wy < WALL_TOP + 0.08)
          pigment = Math.floor(z * 2) % 2 ? PAL.ochreRed[3] : PAL.lapis[3];
      } else if (hit.kind === 'under') {
        t *= 0.55;
        t += (fbm(dx * hit.z * 4, hit.z * 3, 41, 2) - 0.5) * 0.06;
      } else if (hit.kind === 'roof') {
        t *= 0.5;
        // Faded stars on the roof slab.
        const sz = hit.z * 3;
        const sx = dx * hit.z * 8;
        if (
          Math.abs(sz - Math.round(sz)) < 0.05 &&
          Math.abs(sx - Math.round(sx)) < 0.08 &&
          (Math.round(sz) + Math.round(sx)) % 3 === 0
        )
          pigment = PAL.gold[4];
      }
      // Daylight from behind is warm-white; hall light is amber with teal in
      // the shadows.
      let c = rampColor(STONE, t, x, y, 0.85);
      if (pigment) c = mix(c, hex(pigment), Math.min(0.75, 0.25 + l * 0.6));
      if (hall > day && hall > 0.15)
        c = mix(c, hex(PAL.turquoise[1]), Math.min(0.25, (1 - t) * 0.2));
      r.set(x, y, c);
    }
  // A few dark recesses where casing stones are missing.
  void bayer;
  return r;
}

/** Additive glow from the far doorway and the daylight spill (separate layer). */
export function paintCorridorGlow() {
  const r = new Raster(W, H);
  const ey = VY + (0.3 * F) / END;
  glow(r, VX, ey, 70, '#ffb860', 0.35);
  glow(r, VX, ey, 26, '#ffe2a8', 0.5);
  return r;
}

export function corridorAnchors() {
  // Screen positions (art px) of the inscription hotspot and the far door.
  const z = 3.3;
  const wy = 0.05;
  return {
    inscription: {
      x: Math.round(VX - F / z),
      y: Math.round(VY + (wy * F) / z),
    },
    farDoor: { x: VX, y: Math.round(VY + (0.3 * F) / END) },
  };
}
