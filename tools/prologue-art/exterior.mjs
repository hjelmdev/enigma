// Exterior panorama of the inherited pyramid: late-afternoon sun from the
// right, warm sunlit right face, cool sky-lit front face with the carved eye.
import {
  Raster,
  rampColor,
  fbm,
  noise,
  rng,
  mix,
  hex,
  bayer,
} from './raster.mjs';
import { LAYOUT, carveGlyph, forEachGlyphPixel } from './glyphs.mjs';

const P = LAYOUT.panorama;
const W = P.width;
const H = P.height;

export const PAL = {
  sky: [
    '#1b2f4f',
    '#24406a',
    '#335a84',
    '#4d789b',
    '#7397ad',
    '#a7b6b4',
    '#d8c7a6',
    '#f0d9ac',
    '#f8e6c0',
  ],
  haze: ['#9d8a93', '#ab9496', '#bca096', '#cdb09c'],
  farDune: ['#a7837c', '#b8907f', '#c99f86', '#d8ae8c'],
  sandLit: ['#b07a4e', '#c58c57', '#d6a063', '#e2b472', '#ecc685', '#f4d79c'],
  sandShade: ['#5b4350', '#6c4f55', '#7f5d5a', '#946c62'],
  front: [
    '#3f3240',
    '#4d3c48',
    '#5e4950',
    '#715857',
    '#86695f',
    '#9a7b69',
    '#ad8c75',
  ],
  right: [
    '#8d5f40',
    '#a87149',
    '#c08454',
    '#d49962',
    '#e3ae72',
    '#eec386',
    '#f6d8a1',
  ],
  bronze: ['#3c2614', '#6b4421', '#9c6a33', '#c99147', '#ebbd6a', '#fbe3a6'],
  lapis: ['#1d3d5c', '#2b5e7a', '#3f8790', '#6fb3ad'],
  ink: '#1b1218',
};

export function paintSky(width = W, height = H, sun = { x: 1118, y: 70 }) {
  const r = new Raster(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const t = 1 - Math.min(1, Math.max(0, (y - 2) / 268));
      const d = Math.hypot((x - sun.x) / 520, (y - sun.y) / 300);
      const warm = Math.max(0, 1 - d) * 0.18;
      r.set(x, y, rampColor(PAL.sky, 1 - t * t * 0.95 + warm, x, y, 1));
    }
  // Sun halo rings, dithered.
  for (let y = sun.y - 60; y <= sun.y + 60; y++)
    for (let x = sun.x - 60; x <= sun.x + 60; x++) {
      const d = Math.hypot(x - sun.x, y - sun.y);
      if (d < 8.5) r.set(x, y, d < 6 ? '#fffbea' : '#fff1c4');
      else if (d < 60) {
        const glow = (1 - d / 60) ** 2.2;
        if (glow > bayer(x, y) * 0.9)
          r.tint(x, y, '#fff0c8', 0.35 * glow + 0.08);
      }
    }
  // Thin high cloud streaks, lit on their sun side.
  const rand = rng(41);
  for (let i = 0; i < 14; i++) {
    const cx = rand() * width;
    const cy = 30 + rand() * 150;
    const len = 40 + rand() * 120;
    const thick = 1 + Math.round(rand() * 2);
    for (let x = Math.round(cx - len / 2); x < cx + len / 2; x++) {
      const k = 1 - Math.abs((x - cx) / (len / 2));
      const wob = Math.round(noise(x / 24, i, 7) * 3);
      for (let t = 0; t < thick; t++) {
        const yy = Math.round(cy + wob + t);
        if (k * 1.3 > bayer(x, yy) + 0.15)
          r.tint(x, yy, t === 0 ? '#fde6c2' : '#c7a6a4', 0.35 + k * 0.25);
      }
    }
  }
  return r;
}

export function paintFar(width = W, height = H, seed = 3, withPyramids = true) {
  const r = new Raster(width, height);
  const horizon = 262;
  // Distant hazy ridge.
  for (let x = 0; x < width; x++) {
    const ridge = horizon - 14 - fbm(x / 140, 0.5, seed, 3) * 26;
    for (let y = Math.floor(ridge); y < horizon + 30; y++) {
      const t = (y - ridge) / 40;
      r.set(x, y, rampColor(PAL.haze, 0.9 - t, x, y, 1));
    }
  }
  if (withPyramids) {
    // Two remote pyramids on the horizon give scale (lit right faces).
    for (const [px, h] of [
      [186, 30],
      [236, 17],
      [1004, 21],
    ]) {
      const base = horizon - 4;
      const half = h * 0.8;
      r.fillPolygon(
        [
          [px - half, base],
          [px, base - h],
          [px + half * 0.35, base],
        ],
        hex('#a48f97'),
      );
      r.fillPolygon(
        [
          [px + half * 0.35, base],
          [px, base - h],
          [px + half, base - 2],
        ],
        hex('#cbb0a0'),
      );
    }
  }
  // Nearer rolling dunes with sunlit crests and shaded lee sides.
  for (let x = 0; x < width; x++) {
    const crest = horizon - 4 - fbm(x / 90 + 9, 2.5, seed + 5, 3) * 20;
    const slope =
      fbm((x + 6) / 90 + 9, 2.5, seed + 5, 3) -
      fbm((x - 6) / 90 + 9, 2.5, seed + 5, 3);
    const lee = Math.max(0, Math.min(1, slope * 40)) * 0.35;
    for (let y = Math.floor(crest); y < horizon + 40; y++) {
      const depth = (y - crest) / 30;
      r.set(x, y, rampColor(PAL.farDune, 1 - depth * 0.6 - lee, x, y, 1));
    }
  }
  return r;
}

// ---------------------------------------------------------------------------
// Pyramid

function lerpX(a, b, y) {
  return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]);
}

/** Course boundaries from base upward (tapering course heights). */
function courses(baseY, topY, scale = 1) {
  const list = [];
  let y = baseY;
  let i = 0;
  while (y > topY) {
    const h = Math.max(4, Math.round((8 - (i / 40) * 3.5) * scale));
    list.push({ bottom: y, top: y - h, index: i });
    y -= h;
    i++;
  }
  return list;
}

export function paintFace(r, poly, ramp, light, seed, options = {}) {
  const rand = rng(seed);
  const baseY = Math.max(...poly.map((p) => p[1]));
  const topY = Math.min(...poly.map((p) => p[1]));
  const rows = courses(baseY, topY, options.courseScale ?? 1);
  const offsets = rows.map(() => Math.floor(rand() * 20));
  const cs = options.courseScale ?? 1;
  const widths = rows.map((c) =>
    Math.round((13 + Math.floor(rand() * 9) - Math.floor(c.index / 14)) * cs),
  );
  const blockShade = new Map();
  r.fillPolygon(poly, (x, y) => {
    const row =
      rows.find((c) => y < c.bottom && y >= c.top) ?? rows[rows.length - 1];
    const bw = Math.max(8, widths[row.index]);
    const local = x + offsets[row.index];
    const block = Math.floor(local / bw);
    const key = row.index * 1000 + block;
    if (!blockShade.has(key)) blockShade.set(key, (rand() - 0.5) * 0.12);
    let t = light(x, y) + blockShade.get(key);
    // Weathered casing grain.
    t += (fbm(x / 7, y / 5, seed, 2) - 0.5) * 0.12;
    const yInRow = y - row.top;
    const isJoint = local % bw === 0;
    if (yInRow === 0) t -= options.mortar ?? 0.28;
    else if (isJoint) t -= (options.mortar ?? 0.28) * 0.8;
    else if (yInRow === 1) t += options.topLip ?? 0.06;
    else if (y === row.bottom - 1) t -= 0.06;
    return rampColor(ramp, t, x, y, 0.8);
  });
  return rows;
}

function chipEdges(r, edgeA, edgeB, side, rows, seed) {
  // Stepped, eroded silhouette along a face edge: notch whole course ends.
  const rand = rng(seed);
  for (const row of rows) {
    if (rand() > 0.55) continue;
    const depth = 1 + Math.floor(rand() * 4);
    for (let y = row.top; y < row.bottom; y++) {
      const ex = Math.round(lerpX(edgeA, edgeB, y + 0.5));
      for (let d = 0; d < depth; d++) r.clear(ex + side * d, y);
    }
  }
}

export function paintPyramid(r) {
  const { frontLeft: FL, frontRight: FR, backRight: BR, apex: A } = P.pyramid;
  const capY = A[1] + 8;
  const rightRows = paintFace(
    r,
    [FR, BR, A],
    PAL.right,
    (x, y) => 0.66 + (y - A[1]) / 900 - (x - FR[0]) / 900,
    11,
    { mortar: 0.22, topLip: 0.1 },
  );
  const frontRows = paintFace(
    r,
    [FL, FR, A],
    PAL.front,
    (x, y) => 0.5 + (x - FL[0]) / 1800 - (y - A[1]) / 1400,
    12,
  );
  // Sun grazing the ridge between faces.
  for (let y = A[1]; y < FR[1]; y++) {
    const x = Math.round(lerpX(A, FR, y));
    r.tint(x, y, '#ffe3ae', 0.35);
  }
  chipEdges(r, A, FL, 1, frontRows, 5);
  chipEdges(r, A, BR, -1, rightRows, 6);
  // Missing capstone: flat broken top.
  for (let y = 0; y < capY; y++)
    for (let x = A[0] - 20; x < A[0] + 20; x++) r.clear(x, y);
  for (let x = A[0] - 8; x < A[0] + 9; x++) {
    if (r.alpha(x, capY)) r.tint(x, capY, '#ffe0a8', 0.4);
  }
  // A few missing casing blocks (recessed, with shadowed upper edge).
  const rand = rng(77);
  for (let i = 0; i < 26; i++) {
    const y = Math.round(A[1] + 30 + rand() * (FL[1] - A[1] - 60));
    const xl = lerpX(A, FL, y) + 6;
    const xr = lerpX(A, FR, y) - 6;
    if (xr - xl < 30) continue;
    const x = Math.round(xl + rand() * (xr - xl - 20));
    if (Math.abs(x - 620) < 56 && y > 140) continue; // keep entrance area intact
    const w = 8 + Math.floor(rand() * 14);
    const h = 4 + Math.floor(rand() * 4);
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) {
        if (!r.alpha(xx, yy)) continue;
        r.tint(xx, yy, '#2d2230', yy === y ? 0.55 : 0.28);
        if (xx === x + w - 1) r.tint(xx, yy, '#c9a07e', 0.2);
      }
  }
  return { frontRows, rightRows };
}

export function carvedPanel(r, x, y, w, h) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) {
      r.tint(xx, yy, '#a98a76', 0.18);
      if (yy === y || xx === x) r.tint(xx, yy, '#21181f', 0.45);
      else if (yy === y + h - 1 || xx === x + w - 1)
        r.tint(xx, yy, '#e9c9a3', 0.3);
    }
}

export function paintEntrance(r) {
  const eye = P.eye;
  const size = 16 * eye.scale;
  const ex = eye.x - size / 2;
  const ey = eye.y - size / 2;
  // Chevron relieving stones above the cartouche.
  for (let i = 0; i < 7; i++) {
    r.line(eye.x - 34 + i, ey - 3 - i * 0, eye.x, ey - 22 - i, '#3d2f3a');
    r.line(eye.x + 34 - i, ey - 3, eye.x, ey - 22 - i, '#3d2f3a');
  }
  for (let k = 0; k < 2; k++) {
    const off = 6 + k * 5;
    r.line(
      eye.x - 36,
      ey - off + 2,
      eye.x,
      ey - 24 - off,
      k ? '#9f8070' : '#b1917a',
    );
    r.line(
      eye.x + 36,
      ey - off + 2,
      eye.x,
      ey - 24 - off,
      k ? '#8a6c60' : '#9a7b6a',
    );
  }
  carvedPanel(r, ex - 6, ey - 4, size + 12, size + 6);
  carveGlyph(r, 'eye', ex, ey, eye.scale, { depth: 0.5, lipAmount: 0.25 });

  // Lintel with the frieze of four recurring signs.
  const f = P.frieze;
  const fw = f.glyphs.length * 16 * f.scale + (f.glyphs.length - 1) * f.gap;
  const lintel = { x: f.x - 6, y: f.y - 3, w: fw + 12, h: 16 * f.scale + 4 };
  for (let yy = lintel.y; yy < lintel.y + lintel.h; yy++)
    for (let xx = lintel.x; xx < lintel.x + lintel.w; xx++) {
      const t = 0.62 + (fbm(xx / 6, yy / 4, 9, 2) - 0.5) * 0.1;
      r.set(xx, yy, rampColor(PAL.front, t, xx, yy, 0.7));
      if (yy === lintel.y) r.set(xx, yy, '#c4a186');
      if (yy === lintel.y + lintel.h - 1) r.set(xx, yy, '#2f2430');
    }
  f.glyphs.forEach((name, i) => {
    const gx = f.x + i * (16 * f.scale + f.gap);
    carveGlyph(r, name, gx, f.y, f.scale, {
      depth: 0.5,
      shadow: hex('#1f3a52'),
    });
    // Remnants of lapis pigment in the grooves.
    const rand = rng(100 + i);
    for (let yy = 0; yy < 16; yy++)
      for (let xx = 0; xx < 16; xx++)
        if (rand() < 0.08) r.tint(gx + xx, f.y + yy, '#3f8790', 0.18);
  });

  // Steps up to the threshold.
  const s = P.steps;
  for (let i = 0; i < s.count; i++) {
    const w = s.width + i * 10;
    const x = Math.round(620 - w / 2);
    const top = s.y + i * s.rise;
    for (let yy = top; yy < top + s.rise; yy++)
      for (let xx = x; xx < x + w; xx++) {
        const isTread = yy - top < 2;
        const t = isTread ? 0.86 : 0.42 - ((xx - x) / w) * 0.08;
        r.set(
          xx,
          yy,
          rampColor(isTread ? PAL.sandLit : PAL.front, t, xx, yy, 0.6),
        );
        if (xx === x || xx === x + w - 1) r.tint(xx, yy, '#2b2129', 0.3);
      }
  }
  // Threshold shadow line under the door.
  const d = P.door;
  for (let xx = d.x - 2; xx < d.x + d.width + 2; xx++)
    r.set(xx, d.y + d.height, '#2a2029');
  // Jambs: shallow shadowed reveal around the hidden slab.
  for (let yy = d.y - 1; yy < d.y + d.height; yy++) {
    r.tint(d.x - 1, yy, '#1f171f', 0.16);
    r.tint(d.x + d.width, yy, '#e0bd98', 0.06);
  }
}

// ---------------------------------------------------------------------------
// Ground, ruins and props

function paintGround(r) {
  for (let y = 252; y < H; y++)
    for (let x = 0; x < W; x++) {
      const depth = (y - 252) / (H - 252);
      const swell = fbm(x / 160, y / 30, 21, 3) - 0.5;
      const ripple = Math.sin(
        y * (1.4 - depth * 0.7) + fbm(x / 70, y / 12, 4, 3) * 7 + x * 0.015,
      );
      let t = 0.55 + swell * 0.5 + depth * 0.25;
      if (ripple > 0.9) t -= 0.1 + depth * 0.06;
      else if (ripple > 0.6) t += 0.06;
      r.set(x, y, rampColor(PAL.sandLit, t, x, y, 1));
    }
  // Horizon softening: blend the far edge into the haze.
  for (let y = 252; y < 262; y++)
    for (let x = 0; x < W; x++) if ((262 - y) / 10 > bayer(x, y)) r.clear(x, y);
}

export function castShadow(r, poly) {
  r.fillPolygon(poly, (x, y) => {
    if (!r.alpha(x, y)) return null;
    const c = r.get(x, y);
    return [...mix(c, '#4b3a52', 0.38), 255];
  });
}

function paintColumn(r, x, base, height, opts = {}) {
  const w = opts.width ?? 16;
  const top = base - height;
  for (let y = top; y < base; y++)
    for (let xx = 0; xx < w; xx++) {
      const across = xx / (w - 1);
      let t = 0.18 + across * 0.75;
      if (xx % 4 === 1) t -= 0.12;
      const band = (y - top) % 26 === 0;
      if (band) t -= 0.2;
      t += (fbm((x + xx) / 5, y / 7, 31, 2) - 0.5) * 0.12;
      r.set(
        x + xx,
        y,
        rampColor(
          across > 0.45 ? PAL.right : PAL.front,
          across > 0.45 ? t - 0.1 : t + 0.25,
          x + xx,
          y,
          0.7,
        ),
      );
    }
  if (opts.capital) {
    const cw = w + 12;
    for (let i = 0; i < 12; i++) {
      const yy = top - 12 + i;
      const span = Math.round(cw / 2 - i * 0.55);
      for (let xx = -span; xx < span; xx++) {
        const across = (xx + span) / (span * 2);
        const t = 0.25 + across * 0.7 - (i > 9 ? 0.15 : 0);
        r.set(
          x + w / 2 + xx,
          yy,
          rampColor(
            across > 0.45 ? PAL.right : PAL.front,
            across > 0.45 ? t - 0.05 : t + 0.3,
            x + xx,
            yy,
            0.7,
          ),
        );
      }
    }
    r.rect(x - 7, top - 16, w + 14, 4, '#d9ac73');
    r.rect(x - 7, top - 13, w + 14, 1, '#5e4852');
  }
  if (opts.broken) {
    // Jagged broken top.
    const rand = rng(x);
    for (let xx = 0; xx < w; xx++) {
      const cut = Math.floor(rand() * 5);
      for (let k = 0; k < cut; k++) r.clear(x + xx, top + k);
      r.tint(x + xx, top + cut, '#ffe2b0', 0.3);
    }
  }
}

function paintRuins(r) {
  const base = 302;
  // Shadows first (sun from the right throws them left).
  for (const [x, h] of [
    [96, 128],
    [150, 92],
    [204, 34],
  ])
    castShadow(r, [
      [x + 16, base],
      [x, base],
      [x - h * 0.55, base + 10],
      [x - h * 0.55 + 16, base + 10],
    ]);
  paintColumn(r, 96, base, 128, { capital: true });
  paintColumn(r, 150, base, 92, { broken: true });
  paintColumn(r, 204, base, 34, { broken: true });
  // Architrave fragment resting on the first column.
  for (let x = 82; x < 170; x++) {
    const sag = x < 112 ? 0 : Math.round((x - 112) * 0.62);
    for (let y = 158 + sag; y < 169 + sag; y++) {
      const t =
        y - sag < 160
          ? 0.82
          : 0.5 - (x - 80) / 500 + (fbm(x / 6, y / 4, 8, 2) - 0.5) * 0.15;
      if (x > 162 && y - sag < 160 + (x - 162)) continue;
      r.set(x, y, rampColor(PAL.right, t, x, y, 0.7));
    }
    r.set(x, 169 + sag, '#5b4350');
  }
  // Fallen drums lying in the sand.
  for (const [cx, cy, rx] of [
    [238, 294, 11],
    [262, 297, 9],
  ]) {
    r.ellipse(cx, cy, rx, 7, (x, y) =>
      rampColor(PAL.right, 0.25 + ((x - cx + rx) / (rx * 2)) * 0.6, x, y, 0.7),
    );
    r.ellipse(cx + rx - 2, cy, 3, 7, (x, y) =>
      rampColor(PAL.right, 0.85, x, y, 0.5),
    );
  }
  // Stele with the same signs as the miniature.
  const s = P.stele;
  castShadow(r, [
    [s.x + s.width, base],
    [s.x, base],
    [s.x - 40, base + 8],
    [s.x - 10, base + 8],
  ]);
  for (let y = s.y; y < s.y + s.height; y++)
    for (let x = s.x; x < s.x + s.width; x++) {
      const across = (x - s.x) / s.width;
      const round =
        y < s.y + 6
          ? Math.abs(x - (s.x + s.width / 2)) > s.width / 2 - (s.y + 6 - y) * 2
          : false;
      if (round) continue;
      const t = 0.4 + across * 0.25 + (fbm(x / 5, y / 6, 13, 2) - 0.5) * 0.14;
      r.set(x, y, rampColor(PAL.front, t + 0.15, x, y, 0.7));
      if (x === s.x + s.width - 1) r.set(x, y, '#e3b67b');
    }
  carveGlyph(r, 'sun', s.x + 7, s.y + 6, 1, { depth: 0.5 });
  carveGlyph(r, 'eye', s.x + 7, s.y + 24, 1, { depth: 0.5 });
  carveGlyph(r, 'steps', s.x + 7, s.y + 42, 1, { depth: 0.5 });
  // Sand drifts against the ruins.
  for (let x = 60; x < 330; x++) {
    const drift = 4 + Math.round(fbm(x / 22, 3, 44, 2) * 10);
    for (let y = base - drift; y < base + 2; y++)
      r.set(
        x,
        y,
        rampColor(PAL.sandLit, 0.62 - (y - (base - drift)) / 30, x, y, 1),
      );
  }
}

function paintPedestal(r) {
  const p = P.pedestal;
  const base = p.y;
  castShadow(r, [
    [p.x + 36, base],
    [p.x - 36, base],
    [p.x - 120, base + 14],
    [p.x - 40, base + 14],
  ]);
  // Three-step dais.
  const tiers = [
    [76, 7],
    [62, 6],
    [48, 6],
  ];
  let y = base;
  for (const [w, h] of tiers) {
    y -= h;
    for (let yy = y; yy < y + h; yy++)
      for (let xx = p.x - w / 2; xx < p.x + w / 2; xx++) {
        const tread = yy - y < 2;
        const across = (xx - (p.x - w / 2)) / w;
        const t = tread ? 0.88 : 0.35 + across * 0.45;
        r.set(
          xx,
          yy,
          rampColor(tread ? PAL.sandLit : PAL.right, t, xx, yy, 0.7),
        );
      }
  }
  // Column with the eye sign facing the pyramid (seen in profile here).
  const colTop = p.cradleY + 6;
  for (let yy = colTop; yy < y; yy++)
    for (let xx = p.x - 8; xx < p.x + 8; xx++) {
      const across = (xx - (p.x - 8)) / 16;
      const t = 0.2 + across * 0.78 + ((yy - colTop) % 9 === 0 ? -0.12 : 0);
      r.set(xx, yy, rampColor(PAL.right, t, xx, yy, 0.7));
    }
  r.rect(p.x - 12, colTop - 2, 24, 3, '#e9c28a');
  r.rect(p.x - 12, colTop + 1, 24, 1, '#6b4a3c');
  // Bronze cradle (empty until the miniature is placed at runtime).
  for (let i = -9; i <= 9; i++) {
    const yy =
      p.cradleY + 4 - Math.round(Math.sqrt(Math.max(0, 81 - i * i)) * 0.45);
    r.set(
      p.x + i,
      yy,
      rampColor(PAL.bronze, 0.4 + (i + 9) / 30, p.x + i, yy, 0.5),
    );
    r.set(
      p.x + i,
      p.cradleY + 4,
      rampColor(PAL.bronze, 0.3 + (i + 9) / 36, p.x + i, 0, 0.5),
    );
  }
  r.set(p.x + 6, p.cradleY + 1, '#fff0c0');
}

function paintObelisk(r) {
  const o = P.obelisk;
  castShadow(r, [
    [o.x + 8, o.y],
    [o.x - 8, o.y],
    [o.x - 110, o.y + 12],
    [o.x - 90, o.y + 12],
  ]);
  const h = 96;
  const lean = 0.12;
  for (let i = 0; i < h; i++) {
    const y = o.y - i;
    const half = 8 - (i / h) * 3;
    const cx = o.x + i * lean;
    for (let xx = Math.round(cx - half); xx < cx + half; xx++) {
      const across = (xx - (cx - half)) / (half * 2);
      const t = across > 0.5 ? 0.62 + across * 0.3 : 0.25 + across * 0.3;
      r.set(xx, y, rampColor(PAL.right, t, xx, y, 0.6));
    }
  }
  // Broken top.
  const rand = rng(9);
  const topY = o.y - h;
  for (let xx = o.x + h * lean - 6; xx < o.x + h * lean + 6; xx++) {
    const cut = Math.floor(rand() * 6);
    for (let k = 0; k < cut; k++) r.clear(Math.round(xx), topY + k);
  }
  // Fallen tip lying beside it.
  r.fillPolygon(
    [
      [o.x + 22, o.y + 1],
      [o.x + 44, o.y - 6],
      [o.x + 48, o.y + 1],
    ],
    (x, y) =>
      rampColor(PAL.right, 0.4 + (y - (o.y - 6)) / -20 + 0.4, x, y, 0.6),
  );
  for (let k = 0; k < 4; k++) {
    const yy = o.y - 30 - k * 14;
    r.tint(Math.round(o.x + (o.y - yy) * lean) + 1, yy, '#3a2a30', 0.4);
  }
}

export function paintJeep(r, x, base, facing = -1) {
  // Small expedition vehicle seen in side profile, nose pointing `facing`.
  const s = (dx) => x + dx * facing;
  const body = '#8d7c55';
  const bodyDark = '#5d5240';
  const bodyLight = '#bba674';
  const tyre = '#221a1c';
  // Wheels.
  for (const wx of [-16, 14]) {
    r.ellipse(s(wx), base - 5, 5.5, 5.5, tyre);
    r.ellipse(s(wx), base - 5, 2.4, 2.4, '#6f6658');
  }
  // Chassis and bonnet.
  r.fillPolygon(
    [
      [s(-26), base - 8],
      [s(26), base - 8],
      [s(26), base - 15],
      [s(8), base - 16],
      [s(-26), base - 16],
    ].map(([px, py]) => [px, py]),
    body,
  );
  for (let xx = -26; xx <= 26; xx++) {
    r.set(s(xx), base - 16, bodyLight);
    r.set(s(xx), base - 8, bodyDark);
  }
  // Canvas canopy at the back.
  r.fillPolygon(
    [
      [s(-25), base - 16],
      [s(-4), base - 16],
      [s(-6), base - 27],
      [s(-23), base - 27],
    ],
    '#b2a27c',
  );
  for (let yy = base - 27; yy < base - 16; yy += 3)
    r.line(s(-24), yy, s(-6), yy, '#968766');
  // Windscreen frame.
  r.line(s(2), base - 16, s(-2), base - 25, '#3e372d');
  r.line(s(-2), base - 25, s(-4), base - 25, '#3e372d');
  // Jerrycans and spare tyre.
  r.rect(Math.min(s(-28), s(-26)), base - 18, 3, 9, '#5f6b45');
  r.ellipse(s(-28), base - 12, 2, 4, tyre);
  // Headlamp glint.
  r.set(s(25), base - 13, '#fff1c4');
}

export function paintMain() {
  const r = new Raster(W, H);
  paintGround(r);
  // Pyramid shadow falls left across the sand.
  const { frontLeft: FL } = P.pyramid;
  castShadow(r, [
    [FL[0] + 40, FL[1]],
    [FL[0] - 10, FL[1] - 4],
    [FL[0] - 230, FL[1] + 14],
    [FL[0] - 120, FL[1] + 24],
  ]);
  const temp = new Raster(W, H);
  paintPyramid(temp);
  paintEntrance(temp);
  r.draw(temp, 0, 0);
  // Sand drifts banked against the base corners.
  for (let x = 380; x < 980; x++) {
    let drift = 0;
    if (x < 560)
      drift =
        Math.max(0, 16 - Math.abs(x - 470) / 6) + fbm(x / 18, 1, 5, 2) * 6;
    else if (x > 700)
      drift =
        Math.max(0, 22 - Math.abs(x - 850) / 6) + fbm(x / 18, 2, 6, 2) * 6;
    const top = Math.round(304 - drift);
    for (let y = top; y < 306; y++) {
      const t = 0.7 - (y - top) / 40 + (x > 700 ? 0.08 : -0.1);
      r.set(x, y, rampColor(PAL.sandLit, t, x, y, 1));
    }
    if (drift > 2) r.tint(x, top, '#fde3b0', 0.4);
  }
  paintRuins(r);
  paintPedestal(r);
  paintObelisk(r);
  paintJeep(r, P.jeep.x, P.jeep.y, -1);
  // Foreground pebbles.
  const rand = rng(303);
  for (let i = 0; i < 90; i++) {
    const x = Math.round(rand() * W);
    const y = Math.round(318 + rand() * 40);
    const size = rand() < 0.15 ? 2 : 1;
    r.rect(x, y, size + 1, size, '#7f5d5a');
    r.rect(x + 1, y - 1, size, 1, '#f1cf95');
  }
  return r;
}

/** Door slab: the façade under the door rectangle, so it hides in plain sight. */
export function cutDoor(main) {
  const d = P.door;
  const slab = main.crop(d.x, d.y, d.width, d.height);
  // Slightly bevelled edges so the slab reads as one block once it moves.
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      if (x === 0 || y === 0) slab.tint(x, y, '#d8b693', 0.12);
      if (x === d.width - 1 || y === d.height - 1)
        slab.tint(x, y, '#241b23', 0.25);
    }
  for (let y = d.y; y < d.y + d.height; y++)
    for (let x = d.x; x < d.x + d.width; x++) main.clear(x, y);
  return slab;
}

/** Passage revealed behind the slab: a descending corridor lit coolly below. */
export function paintPassage() {
  const d = P.door;
  const r = new Raster(d.width, d.height);
  const vx = d.width / 2;
  const vy = d.height * 0.62;
  const inner = { w: 9, h: 12 };
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const dx = (x + 0.5 - vx) / (d.width / 2);
      const dy = (y + 0.5 - vy) / (y < vy ? vy : d.height - vy);
      const depth = Math.max(Math.abs(dx), Math.abs(dy));
      let color;
      if (
        Math.abs(x + 0.5 - vx) < inner.w / 2 &&
        Math.abs(y + 0.5 - vy) < inner.h / 2
      ) {
        const glow = 1 - Math.hypot((x + 0.5 - vx) / 5, (y + 0.5 - vy + 3) / 6);
        color = mix('#06080c', '#3d8b98', Math.max(0, glow) * 0.8);
      } else {
        const t = Math.max(0, depth);
        const isFloor = dy > Math.abs(dx);
        const isCeil = -dy > Math.abs(dx);
        let base = isFloor ? '#2a2328' : isCeil ? '#0d0b0f' : '#1a161c';
        // Steps descending into the dark.
        if (isFloor && Math.floor((1 - t) * 9) % 2 === 0) base = '#352c30';
        color = mix('#05070a', base, t ** 1.4);
        // Cool light grazing the walls deep inside.
        color = mix(color, '#2f6d78', Math.max(0, 0.32 - t) * 0.6);
      }
      r.set(x, y, color);
    }
  return r;
}

export function paintEyeLit() {
  const eye = P.eye;
  const size = 16 * eye.scale;
  const pad = 14;
  const r = new Raster(size + pad * 2, size + pad * 2);
  // Warm halo.
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const d = Math.hypot(x - r.width / 2, y - r.height / 2) / (r.width / 2);
      if (d < 1 && (1 - d) ** 1.5 > bayer(x, y) * 0.9)
        r.set(x, y, '#ffd98a', Math.round(120 * (1 - d)));
    }
  paintGlyphLight(r, pad, pad, eye.scale);
  return r;
}

function paintGlyphLight(r, ox, oy, scale) {
  forEachGlyphPixel('eye', scale, (x, y, n) => {
    if (n.code === '#')
      r.set(ox + x, oy + y, n.above !== '#' ? '#fff3c9' : '#ffd77a');
    if (n.code === '*') r.set(ox + x, oy + y, '#ffffff');
  });
}

export function paintFront() {
  // Foreground rocks that frame the panorama's lower corners.
  const r = new Raster(W, H);
  const rocks = [
    [20, 352, 38, 18],
    [70, 358, 30, 12],
    [1240, 350, 44, 22],
    [1188, 360, 28, 10],
    [540, 362, 22, 6],
  ];
  const rand = rng(612);
  for (const [cx, cy, rx, ry] of rocks) {
    const pts = [];
    const n = 7;
    for (let i = 0; i < n; i++) {
      const a = Math.PI + (i / (n - 1)) * Math.PI;
      const k = 0.75 + rand() * 0.35;
      pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * 1.6]);
    }
    const ridgeX = cx + rx * 0.2;
    r.fillPolygon(pts, (x, y) => {
      const sunSide = x > ridgeX - (cy - y) * 0.4;
      const top = y < cy - ry * 0.9;
      let t = sunSide ? 0.62 : 0.2;
      if (top) t += 0.18;
      t += (fbm(x / 5, y / 4, 61, 2) - 0.5) * 0.22;
      return rampColor(sunSide ? PAL.right : PAL.front, t, x, y, 0.8);
    });
  }
  r.outline(hex('#2a1d22'));
  return r;
}
