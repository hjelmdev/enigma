// "Offret till solen" — the painted relief used by the sliding wall puzzle.
// A kneeling figure raises the miniature pyramid toward a winged sun whose
// rays strike the pyramid's eye; a column of the canonical signs runs down
// the right edge. Drawn from normalised shapes so the same picture renders at
// hall scale (24 px tiles), close-up scale (64 px tiles) and as the painted
// reference on the hall wall.
import {
  Raster,
  hex,
  mix,
  bayer,
  fbm,
  noise,
  rng,
  STONE,
  PAL,
  HALL_LAYOUT,
  paintAshlar,
  makeLight,
  litColor,
  glow,
} from './common.mjs';
import { rampColor } from '../prologue-art/raster.mjs';
import { GLYPHS } from '../prologue-art/glyphs.mjs';

const C = HALL_LAYOUT.closeup;

// Normalised shapes (u, v in 0..1 of the square picture).
const WIG = [
  [0.275, 0.33],
  [0.33, 0.295],
  [0.395, 0.3],
  [0.415, 0.335],
  [0.41, 0.405],
  [0.385, 0.47],
  [0.3, 0.475],
  [0.265, 0.41],
];
const FACE = [
  [0.385, 0.325],
  [0.425, 0.335],
  [0.44, 0.37],
  [0.462, 0.392],
  [0.44, 0.405],
  [0.445, 0.425],
  [0.425, 0.452],
  [0.39, 0.455],
];
const TORSO = [
  [0.295, 0.465],
  [0.44, 0.465],
  [0.43, 0.54],
  [0.415, 0.62],
  [0.33, 0.62],
  [0.31, 0.54],
];
const ARM_BACK = [
  [0.4, 0.49],
  [0.49, 0.52],
  [0.6, 0.468],
  [0.632, 0.47],
  [0.622, 0.49],
  [0.5, 0.552],
  [0.4, 0.554],
];
const ARM_FRONT = [
  [0.415, 0.465],
  [0.5, 0.485],
  [0.545, 0.458],
  [0.572, 0.46],
  [0.566, 0.48],
  [0.505, 0.512],
  [0.42, 0.507],
];
const KILT = [
  [0.315, 0.6],
  [0.43, 0.6],
  [0.47, 0.67],
  [0.535, 0.695],
  [0.54, 0.765],
  [0.37, 0.785],
  [0.285, 0.73],
];
const SHIN = [
  [0.5, 0.765],
  [0.535, 0.79],
  [0.505, 0.818],
  [0.3, 0.858],
  [0.235, 0.862],
  [0.23, 0.835],
  [0.3, 0.818],
];
const PYR = {
  apex: [0.635, 0.285],
  left: [0.525, 0.465],
  right: [0.745, 0.465],
};
const SUN = { u: 0.5, v: 0.145, r: 0.058 };

function poly(r, S, pts, shader) {
  r.fillPolygon(
    pts.map(([u, v]) => [u * S, v * S]),
    shader,
  );
}

function inside(pts, u, v) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi)
      c = !c;
  }
  return c;
}

/**
 * The relief picture, S×S. `paint` 0..1 controls pigment strength (the
 * reference painting is fully coloured, the carved puzzle tiles are muted
 * painted limestone). `light(x, y)` is the lighting across the picture.
 */
export function paintReliefPicture(S, opts = {}) {
  const r = new Raster(S, S);
  const paint = opts.paint ?? 0.8;
  const light = opts.light ?? ((x, y) => 0.95 - (x + y) / (S * 6));
  const k = S / 192; // detail scale relative to close-up size
  const stoneAt = (x, y, t = 0) =>
    rampColor(
      STONE,
      0.62 * light(x, y) +
        0.28 +
        t +
        (fbm(x / (14 * k + 1), y / (10 * k + 1), 21, 2) - 0.5) * 0.04,
      x,
      y,
      0.45,
    );
  const pig = (color, x, y, t = 0) => {
    const base = stoneAt(x, y, t);
    const c = hex(color);
    const m = mix(base, c, paint * 0.85);
    return litColor(m, 0.78 + light(x, y) * 0.32 + t, x, y, 7);
  };

  // Limestone ground.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) r.set(x, y, stoneAt(x, y));

  // Border bands: dark line, red ochre, lapis, light inner line. They tell
  // the player which tiles belong on the edges and corners.
  const b = Math.max(2, Math.round(S * 0.045));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.min(x, y, S - 1 - x, S - 1 - y);
      if (d >= b) continue;
      const band = d / b;
      const col =
        band < 0.2
          ? '#1a1220'
          : band < 0.55
            ? PAL.ochreRed[3]
            : band < 0.85
              ? PAL.lapis[3]
              : '#e8d6b0';
      r.set(x, y, pig(col, x, y));
    }
  // Corner rosettes in gold distinguish the four corners at a glance.
  for (const [cx, cy] of [
    [b * 1.6, b * 1.6],
    [S - b * 1.6, b * 1.6],
    [b * 1.6, S - b * 1.6],
    [S - b * 1.6, S - b * 1.6],
  ])
    r.ellipse(cx, cy, b * 0.9, b * 0.9, (x, y, d) =>
      pig(d < 0.35 ? PAL.ochreRed[4] : PAL.gold[4], x, y),
    );

  // Sun rays falling to the pyramid's eye (thin gold lines).
  const sun = [SUN.u * S, SUN.v * S];
  const eye = [(PYR.apex[0] - 0.015) * S, (PYR.apex[1] + 0.09) * S];
  for (const off of [-0.035, 0, 0.035]) {
    const ex = eye[0] + off * S * 0.6;
    const ey = eye[1] + Math.abs(off) * S * 0.4;
    const n = Math.ceil(Math.hypot(ex - sun[0], ey - sun[1]));
    for (let i = Math.ceil(SUN.r * S) + 1; i < n - 2; i++) {
      const t = i / n;
      const x = Math.round(sun[0] + (ex - sun[0]) * t);
      const y = Math.round(sun[1] + (ey - sun[1]) * t);
      if ((i + (off ? 1 : 0)) % 3 === 2 && off) continue;
      r.set(x, y, pig(PAL.gold[4], x, y, 0.05));
    }
  }

  // Winged sun: wings of lapis/turquoise/gold feathers.
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = x / S;
      const v = y / S;
      const du = Math.abs(u - SUN.u);
      if (du > 0.31 || du < SUN.r * 0.6) continue;
      const span = du / 0.31;
      const top = SUN.v - 0.035 + span * span * 0.03;
      const bottom = SUN.v + 0.045 - span * 0.04;
      if (v < top || v > bottom) continue;
      const rowT = (v - top) / Math.max(0.001, bottom - top);
      const col =
        rowT < 0.33
          ? PAL.lapis[3]
          : rowT < 0.66
            ? PAL.turquoise[3]
            : PAL.gold[4];
      const feather = Math.floor((du * S) / Math.max(2, 3 * k)) % 2 === 0;
      r.set(x, y, pig(col, x, y, feather ? 0 : -0.06));
    }
  r.ellipse(sun[0], sun[1], SUN.r * S, SUN.r * S, (x, y, d) =>
    pig(d < 0.5 ? PAL.ochreRed[4] : PAL.ochreRed[3], x, y, d < 0.3 ? 0.06 : 0),
  );
  // Uraeus serpents hanging either side of the disc.
  for (const s of [-1, 1]) {
    const ux = sun[0] + s * SUN.r * S * 1.05;
    r.ellipse(
      ux,
      sun[1] + SUN.r * S * 0.5,
      Math.max(1, 1.4 * k),
      Math.max(1.5, 4 * k),
      (x, y) => pig(PAL.gold[3], x, y),
    );
  }

  // The miniature pyramid: shaded left face, sunlit right face, eye inlay.
  const A = PYR.apex.map((c) => c * S);
  const L = PYR.left.map((c) => c * S);
  const R = PYR.right.map((c) => c * S);
  const mid = [A[0] + 0.03 * S, L[1]];
  r.fillPolygon([A, L, mid], (x, y) => pig(PAL.gold[3], x, y, -0.05));
  r.fillPolygon([A, mid, R], (x, y) => pig(PAL.gold[5], x, y, 0.04));
  // Courses.
  for (let i = 1; i < 5; i++) {
    const y = Math.round(A[1] + ((L[1] - A[1]) * i) / 5);
    for (let x = 0; x < S; x++)
      if (r.alpha(x, y)) {
        const u = x / S;
        const v = y / S;
        if (inside([PYR.apex, PYR.left, PYR.right], u, v))
          r.tint(x, y, '#5a3714', 0.35);
      }
  }
  // Eye on the shaded face.
  const ex = Math.round(eye[0]);
  const ey = Math.round(eye[1]);
  const er = Math.max(1, Math.round(3 * k));
  r.ellipse(ex, ey, er * 1.6, er * 0.9, (x, y, d) =>
    d < 0.4 ? hex('#13213f') : hex('#f4ead0'),
  );
  // Hands holding the base.
  r.set(Math.round(L[0] + 1), Math.round(L[1]), pig(PAL.skin[3], L[0], L[1]));

  // Figure.
  poly(r, S, SHIN, (x, y) => pig(PAL.skin[3], x, y, -0.04));
  poly(r, S, TORSO, (x, y) => pig(PAL.skin[3], x, y));
  poly(r, S, ARM_BACK, (x, y) => pig(PAL.skin[2], x, y));
  poly(r, S, KILT, (x, y) => {
    const pleat = Math.floor((x + y * 0.5) / Math.max(2, 3 * k)) % 2;
    return pig(PAL.linen[4], x, y, pleat ? -0.05 : 0);
  });
  // Kilt sash.
  for (let x = Math.round(0.315 * S); x < 0.44 * S; x++)
    for (let t = 0; t < Math.max(1, Math.round(2 * k)); t++) {
      const y = Math.round(0.605 * S) + t;
      if (r.alpha(x, y)) r.set(x, y, pig(PAL.ochreRed[3], x, y));
    }
  poly(r, S, ARM_FRONT, (x, y) => pig(PAL.skin[3], x, y, 0.03));
  poly(r, S, FACE, (x, y) => pig(PAL.skin[3], x, y, 0.04));
  poly(r, S, WIG, (x, y) => {
    const strand = Math.floor(y / Math.max(2, 2.5 * k)) % 2;
    return pig(PAL.lapis[2], x, y, strand ? 0 : -0.05);
  });
  // Broad collar.
  for (let y = Math.round(0.465 * S); y < 0.515 * S; y++)
    for (let x = Math.round(0.3 * S); x < 0.44 * S; x++) {
      const dv = (y / S - 0.465) / 0.05;
      const du = Math.abs(x / S - 0.365) / 0.075;
      if (du * du + (1 - dv) * 0.2 > 1.05) continue;
      const ring = Math.max(0, Math.min(2, Math.floor(dv * 3)));
      r.set(
        x,
        y,
        pig([PAL.turquoise[3], PAL.gold[4], PAL.lapis[3]][ring % 3], x, y),
      );
    }
  // Eye of the figure + cosmetic line.
  const fx = Math.round(0.418 * S);
  const fy = Math.round(0.365 * S);
  r.set(fx, fy, '#120c14');
  if (k > 0.6) {
    r.set(fx + 1, fy, '#120c14');
    r.set(fx - 1, fy, '#f0e6d0');
    r.set(fx + 2, fy + 1, '#120c14');
  }

  // Ground line.
  for (let y = Math.round(0.865 * S); y < 0.865 * S + Math.max(1, 2 * k); y++)
    for (let x = b; x < 0.77 * S; x++) r.set(x, y, pig('#2a1c22', x, y));

  // Right-hand column of canonical signs: eye, steps, sun.
  const colX = Math.round(0.775 * S);
  for (let y = b + 1; y < S - b - 1; y++)
    r.set(colX, y, pig('#2a1c22', colX, y));
  const names = ['eye', 'steps', 'sun'];
  const gs = Math.max(1, Math.floor((0.17 * S) / 16));
  names.forEach((name, i) => {
    const ox = Math.round(0.865 * S - 8 * gs);
    const oy = Math.round(0.27 * S + i * 0.21 * S);
    if (gs >= 1 && S >= 96) {
      const rows = GLYPHS[name];
      for (let gy = 0; gy < 16; gy++)
        for (let gx = 0; gx < 16; gx++) {
          const c = rows[gy][gx];
          if (c === '.') continue;
          for (let sy = 0; sy < gs; sy++)
            for (let sx = 0; sx < gs; sx++) {
              const x = ox + gx * gs + sx;
              const y = oy + gy * gs + sy;
              r.set(x, y, pig(c === '*' ? PAL.gold[4] : PAL.lapis[2], x, y));
            }
        }
    } else {
      // Too small to read: a compact painted block per sign.
      const w = Math.max(3, Math.round(0.09 * S));
      r.rect(
        Math.round(0.865 * S - w / 2),
        oy + 1,
        w,
        w,
        pig(PAL.lapis[2], ox, oy),
      );
      r.set(
        Math.round(0.865 * S),
        oy + Math.round(w / 2) + 1,
        pig(PAL.gold[4], ox, oy),
      );
    }
  });

  // Carving: dark outline around painted figures (sunken relief edge),
  // light lip on the lower-right.
  const src = new Raster(S, S);
  src.draw(r, 0, 0);
  const lum = (x, y) => {
    const c = src.get(x, y);
    return c[0] * 0.3 + c[1] * 0.55 + c[2] * 0.15;
  };
  const ground = (x, y) => {
    const u = x / S;
    const v = y / S;
    const fig =
      inside(WIG, u, v) ||
      inside(FACE, u, v) ||
      inside(TORSO, u, v) ||
      inside(KILT, u, v) ||
      inside(SHIN, u, v) ||
      inside(ARM_BACK, u, v) ||
      inside(ARM_FRONT, u, v) ||
      inside([PYR.apex, PYR.left, PYR.right], u, v);
    return !fig;
  };
  if (S >= 96)
    for (let y = 1; y < S - 1; y++)
      for (let x = 1; x < S - 1; x++) {
        if (!ground(x, y)) continue;
        if (!ground(x + 1, y) || !ground(x, y + 1))
          r.tint(x, y, '#120c14', 0.55);
        else if (!ground(x - 1, y) || !ground(x, y - 1))
          r.tint(x, y, '#fff0d0', 0.2);
      }
  void lum;
  void noise;
  void rng;
  void bayer;
  return r;
}

/** Splits a picture into tile rasters, row-major. */
export function cutTiles(picture, rows, cols) {
  const tw = picture.width / cols;
  const th = picture.height / rows;
  const out = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      out.push(picture.crop(c * tw, r * th, tw, th));
  return out;
}

/**
 * Tile sprite sheet: each tile as a carved stone block with bevelled edges,
 * laid out in one row (frame width = tile size). Edges catch the lamp from
 * the upper right; grooves keep each block distinct.
 */
export function paintTileSheet(picture, rows, cols, opts = {}) {
  const tiles = cutTiles(picture, rows, cols);
  const t = tiles[0].width;
  const bevel = opts.bevel ?? Math.max(1, Math.round(t / 24));
  const sheet = new Raster(t * tiles.length, t);
  tiles.forEach((tile, i) => {
    const ox = i * t;
    for (let y = 0; y < t; y++)
      for (let x = 0; x < t; x++) {
        const c = tile.get(x, y);
        sheet.set(ox + x, y, c);
        const dl = x;
        const dt = y;
        const dr = t - 1 - x;
        const db = t - 1 - y;
        const d = Math.min(dl, dt, dr, db);
        if (d === 0)
          sheet.set(ox + x, y, dr === 0 || db === 0 ? '#120c16' : '#3a2a30');
        else if (d < bevel + 1) {
          if (dt === d || dr === d) sheet.tint(ox + x, y, '#fff0cf', 0.32);
          else sheet.tint(ox + x, y, '#1a1018', 0.42);
        }
      }
  });
  return sheet;
}

/** Close-up background: torchlit wall with the recessed, tracked panel. */
export function paintReliefCloseupBg(board) {
  const W = C.width;
  const H = C.height;
  const r = new Raster(W, H);
  const light = makeLight(
    [
      { x: 430, y: 70, r: 150, i: 0.62 },
      { x: 240, y: 170, r: 260, i: 0.18 },
    ],
    0.12,
  );
  paintAshlar(r, 0, 0, W, H, light, 31, { courseH: 34, blockW: 72 });
  // Painted top frieze (khekher pattern) and dado.
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < W; x++) {
      const cell = Math.floor(x / 10) % 3;
      const inCell = x % 10;
      let col = null;
      if (y < 2) col = '#1a1220';
      else if (y < 13 && inCell > 1 && inCell < 8)
        col = [PAL.lapis[3], PAL.ochreRed[3], PAL.turquoise[3]][cell];
      else if (y >= 13) col = PAL.gold[3];
      if (col) r.set(x, y, litColor(col, light(x, y) * 0.95 + 0.1, x, y));
    }
  // Board recess with deep channels.
  const { x: bx, y: by, size, frame } = board;
  for (let y = by - frame; y < by + size + frame; y++)
    for (let x = bx - frame; x < bx + size + frame; x++) {
      const inner = x >= bx && x < bx + size && y >= by && y < by + size;
      if (inner) {
        // Recess floor: very dark, cool, with track grooves.
        const t = 0.06 + light(x, y) * 0.12;
        r.set(x, y, rampColor(STONE, t, x, y, 0.6));
      }
    }
  return r;
}

/** Raised frame around the board; drawn above the tiles so edges tuck under. */
export function paintReliefFrame(board) {
  const W = C.width;
  const H = C.height;
  const r = new Raster(W, H);
  const { x: bx, y: by, size, frame } = board;
  const light = makeLight([{ x: 430, y: 70, r: 150, i: 0.62 }], 0.18);
  for (let y = by - frame; y < by + size + frame; y++)
    for (let x = bx - frame; x < bx + size + frame; x++) {
      const inner = x >= bx && x < bx + size && y >= by && y < by + size;
      if (inner) continue;
      const d = Math.min(
        x - (bx - frame),
        y - (by - frame),
        bx + size + frame - 1 - x,
        by + size + frame - 1 - y,
      );
      const dIn = Math.min(
        Math.abs(x - bx),
        Math.abs(x - (bx + size - 1)),
        Math.abs(y - by),
        Math.abs(y - (by + size - 1)),
      );
      let t =
        0.36 + light(x, y) * 0.55 + (fbm(x / 5, y / 5, 8, 2) - 0.5) * 0.08;
      if (d === 0) t -= 0.25;
      else if (d === 1) t += 0.1;
      // Inner lip: lit on the lower/left edge (facing the torch above right),
      // shadow cast onto the board from the upper/right edge.
      if (dIn <= 2) t -= 0.12;
      // Bronze track rails along the inner lip.
      if (dIn === 3 || dIn === 4) {
        r.set(x, y, rampColor(PAL.bronze, 0.3 + light(x, y) * 0.6, x, y, 0.8));
        continue;
      }
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  // Shadow cast by the frame onto the recess (upper and right inner edges).
  for (let y = by; y < by + size; y++)
    for (let x = bx; x < bx + size; x++) {
      const fromTop = y - by;
      const fromRight = bx + size - 1 - x;
      if (fromTop < 3 || fromRight < 3)
        r.set(
          x,
          y,
          '#0a0710',
          Math.max(0, 150 - Math.min(fromTop, fromRight) * 40),
        );
    }
  // Carved corner bosses with the eye sign's pupil inlaid in lapis.
  for (const [cx, cy] of [
    [bx - frame / 2, by - frame / 2],
    [bx + size + frame / 2, by - frame / 2],
    [bx - frame / 2, by + size + frame / 2],
    [bx + size + frame / 2, by + size + frame / 2],
  ]) {
    r.ellipse(cx, cy, frame * 0.38, frame * 0.38, (x, y, d) =>
      d < 0.35
        ? hex(PAL.lapis[3])
        : rampColor(
            PAL.bronze,
            0.75 - d * 0.4 + (light(x, y) - 0.5) * 0.4,
            x,
            y,
            0.8,
          ),
    );
  }
  return r;
}

/** Warm torch glow for the close-up (additive). */
export function paintReliefCloseupGlow() {
  const r = new Raster(C.width, C.height);
  glow(r, 430, 70, 120, '#ff9a48', 0.55);
  glow(r, 430, 62, 26, '#ffe2a0', 0.9);
  return r;
}
