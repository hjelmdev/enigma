import { mkdir, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public/assets/visual-lab');
const W = 320;
const H = 160;

const palettes = {
  classic: {
    scale: 1,
    colors: {
      ink: '#1a1110',
      outline: '#30201a',
      shade: '#422a20',
      deep: '#281914',
      wall0: '#63432f',
      wall1: '#795539',
      wall2: '#926744',
      wall3: '#b08353',
      light: '#d5ad72',
      gleam: '#efd29a',
      gold: '#bf8945',
      goldLight: '#e3b85e',
      floor: '#59402e',
      mortar: '#39261d',
      dust: '#e8c985',
      flame: '#f2a33c',
      torch: '#f4cd72',
      door: '#70513a',
      doorLight: '#a37a4f',
      vessel: '#9a7048',
      panel: '#846347',
      water: '#8b805c',
      eye: '#ddbd79',
    },
    textureCount: 170,
    rayCount: 9,
  },
  hd: {
    scale: 2,
    colors: {
      ink: '#120e0e',
      outline: '#291c19',
      shade: '#38251f',
      deep: '#211614',
      wall0: '#5e4334',
      wall1: '#785642',
      wall2: '#95694c',
      wall3: '#b6875d',
      light: '#d8b17b',
      gleam: '#f5d9a5',
      gold: '#b97e3f',
      goldLight: '#ecc46d',
      floor: '#523b30',
      mortar: '#30211b',
      dust: '#f0d49a',
      flame: '#f6a54b',
      torch: '#ffdc83',
      door: '#685042',
      doorLight: '#9f7c5c',
      vessel: '#8f684b',
      panel: '#816653',
      water: '#88816b',
      eye: '#e5c789',
    },
    textureCount: 900,
    rayCount: 17,
  },
};

class Raster {
  constructor(width, height, palette) {
    this.width = width;
    this.height = height;
    this.palette = palette;
    this.pixels = new Uint8Array(width * height * 4);
  }
  color(value, alpha = 1) {
    const h = value.startsWith('#') ? value.slice(1) : value;
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      Math.round(alpha * 255),
    ];
  }
  pixel(x, y, color, alpha = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a0] = Array.isArray(color)
      ? color
      : this.color(color, alpha);
    const i = (y * this.width + x) * 4;
    const a = a0 / 255;
    if (a >= 1) {
      this.pixels[i] = r;
      this.pixels[i + 1] = g;
      this.pixels[i + 2] = b;
      this.pixels[i + 3] = 255;
      return;
    }
    const oldA = this.pixels[i + 3] / 255;
    const outA = a + oldA * (1 - a);
    if (!outA) return;
    this.pixels[i] = Math.round(
      (r * a + this.pixels[i] * oldA * (1 - a)) / outA,
    );
    this.pixels[i + 1] = Math.round(
      (g * a + this.pixels[i + 1] * oldA * (1 - a)) / outA,
    );
    this.pixels[i + 2] = Math.round(
      (b * a + this.pixels[i + 2] * oldA * (1 - a)) / outA,
    );
    this.pixels[i + 3] = Math.round(outA * 255);
  }
  rect(x, y, w, h, color, alpha = 1) {
    const x0 = Math.floor(x),
      y0 = Math.floor(y),
      x1 = Math.ceil(x + w),
      y1 = Math.ceil(y + h);
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) this.pixel(xx, yy, color, alpha);
  }
  line(x0, y0, x1, y1, color, thickness = 1, alpha = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      sx = x0 < x1 ? 1 : -1,
      dy = -Math.abs(y1 - y0),
      sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      const radius = Math.floor(thickness / 2);
      this.rect(x0 - radius, y0 - radius, thickness, thickness, color, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * error;
      if (e2 >= dy) {
        error += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        error += dx;
        y0 += sy;
      }
    }
  }
  ellipse(cx, cy, rx, ry, color, fill = true, thickness = 1, alpha = 1) {
    const x0 = Math.floor(cx - rx),
      x1 = Math.ceil(cx + rx),
      y0 = Math.floor(cy - ry),
      y1 = Math.ceil(cy + ry);
    const innerX = Math.max(0, rx - thickness),
      innerY = Math.max(0, ry - thickness);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const d =
          ((x - cx) / Math.max(rx, 0.01)) ** 2 +
          ((y - cy) / Math.max(ry, 0.01)) ** 2;
        const inside = d <= 1;
        const edge =
          ((x - cx) / Math.max(innerX, 0.01)) ** 2 +
            ((y - cy) / Math.max(innerY, 0.01)) ** 2 >=
          1;
        if ((fill && inside) || (!fill && inside && edge))
          this.pixel(x, y, color, alpha);
      }
  }
  polygon(points, color, fill = true, thickness = 1) {
    if (fill) {
      const minY = Math.floor(Math.min(...points.map((p) => p[1]))),
        maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
      for (let y = minY; y <= maxY; y++) {
        const cuts = [];
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [xi, yi] = points[i],
            [xj, yj] = points[j];
          if (yi > y !== yj > y)
            cuts.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
        }
        cuts.sort((a, b) => a - b);
        for (let i = 0; i < cuts.length; i += 2)
          for (let x = Math.ceil(cuts[i]); x <= cuts[i + 1]; x++)
            this.pixel(x, y, color);
      }
    }
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      this.line(a[0], a[1], b[0], b[1], color, thickness);
    }
  }
  bandGlow(cx, cy, radius, color, alpha, seed = 0) {
    const [r, g, b] = this.color(color);
    for (
      let y = Math.max(0, Math.floor(cy - radius));
      y < Math.min(this.height, cy + radius);
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(cx - radius));
        x < Math.min(this.width, cx + radius);
        x++
      ) {
        const d = Math.hypot(x - cx, y - cy) / radius;
        if (d > 1) continue;
        const bands =
          d < 0.22 ? 0.13 : d < 0.48 ? 0.095 : d < 0.7 ? 0.055 : 0.025;
        const pattern = (x * 7 + y * 13 + seed) % 5 === 0 ? 0.35 : 1;
        const a = Math.min(0.22, bands * alpha * pattern);
        this.pixel(x, y, [r, g, b, Math.round(a * 255)]);
      }
    }
  }
}

function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function range(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function drawColumn(r, x, s, c, detail) {
  const block = (a, b, w, h, color) =>
    r.rect(a * s, b * s, w * s, h * s, color);
  block(x - 10, 36, 20, 6, c.outline);
  block(x - 9, 36, 18, 4, c.gold);
  block(x - 8, 37, 16, 2, c.goldLight);
  block(x - 7, 42, 14, 76, c.outline);
  block(x - 6, 43, 12, 74, c.wall1);
  block(x - 4, 44, 3, 71, c.wall3);
  block(x + 1, 45, 2, 69, c.wall2);
  block(x + 4, 44, 2, 71, c.shade);
  for (let yy = 47; yy < 114; yy += 12) {
    block(x - 5, yy, 10, 1, c.wall0);
    block(x - 5, yy + 1, 10, 1, c.wall2);
  }
  block(x - 9, 117, 18, 5, c.outline);
  block(x - 8, 117, 16, 3, c.wall2);
  block(x - 7, 118, 14, 1, c.gold);
  for (let yy = 47; yy < 112; yy += detail ? 7 : 14)
    r.pixel((x - 1) * s, yy * s, c.light);
}

function drawTorch(r, x, y, s, c, random, hd) {
  r.bandGlow(x * s, y * s, (hd ? 32 : 20) * s, c.flame, 1, Math.floor(x));
  r.rect((x - 2) * s, (y + 1) * s, 4 * s, 11 * s, c.outline);
  r.rect((x - 1) * s, (y + 1) * s, 2 * s, 8 * s, c.gold);
  r.rect((x - 3) * s, (y + 9) * s, 6 * s, 2 * s, c.shade);
  r.polygon(
    [
      [x * s, (y - 7) * s],
      [(x + 3) * s, (y - 2) * s],
      [(x + 2) * s, y * s],
      [(x - 2) * s, y * s],
      [(x - 3) * s, (y - 2) * s],
    ],
    c.flame,
  );
  r.polygon(
    [
      [x * s, (y - 5) * s],
      [(x + 1) * s, (y - 2) * s],
      [x * s, (y - 1) * s],
      [(x - 1) * s, (y - 2) * s],
    ],
    c.torch,
  );
  for (let i = 0; i < (hd ? 12 : 5); i++) {
    const dx = range(random, -11, 11),
      dy = range(random, 3, 24);
    if (random() < (hd ? 0.5 : 0.3))
      r.pixel((x + dx) * s, (y + dy) * s, c.light);
  }
}

function drawAlcove(r, x, y, w, h, s, c, hd) {
  r.rect(x * s, y * s, w * s, h * s, c.outline);
  r.rect((x + 2) * s, (y + 2) * s, (w - 4) * s, (h - 2) * s, c.shade);
  r.ellipse((x + w / 2) * s, (y + 4) * s, (w / 2 - 2) * s, 8 * s, c.outline);
  r.ellipse((x + w / 2) * s, (y + 5) * s, (w / 2 - 4) * s, 6 * s, c.deep);
  r.rect((x + 4) * s, (y + 5) * s, (w - 8) * s, (h - 7) * s, c.deep);
  r.line((x + 3) * s, (y + 12) * s, (x + 3) * s, (y + h - 2) * s, c.wall3, s);
  r.line(
    (x + w - 4) * s,
    (y + 12) * s,
    (x + w - 4) * s,
    (y + h - 2) * s,
    c.wall0,
    s,
  );
  r.rect((x + 1) * s, (y + h - 4) * s, (w - 2) * s, 3 * s, c.gold);
  if (hd) {
    for (let i = 0; i < 4; i++)
      r.line(
        (x + 8 + i * 5) * s,
        (y + 17) * s,
        (x + 10 + i * 5) * s,
        (y + 31) * s,
        i % 2 ? c.light : c.wall2,
        s,
      );
  }
}

function drawBackground(name) {
  const config = palettes[name],
    s = config.scale,
    c = config.colors,
    hd = name === 'hd';
  const r = new Raster(W * s, H * s, c),
    random = rng(name === 'classic' ? 10291 : 742189);
  r.rect(0, 0, r.width, r.height, c.deep);
  const bands = [c.deep, c.shade, c.wall0, c.wall1, c.wall2, c.wall1, c.wall0];
  bands.forEach((color, i) => r.rect(0, i * 5 * s, r.width, 5 * s, color));
  // Wall backing and large, irregular coursed ashlar blocks.
  r.rect(6 * s, 15 * s, 308 * s, 110 * s, c.wall0);
  const rowHeights = hd
    ? [14, 15, 14, 16, 14, 15, 14]
    : [14, 15, 14, 16, 14, 15, 14];
  let y = 17;
  for (let row = 0; row < rowHeights.length; row++) {
    const rh = rowHeights[row];
    let x = row % 2 ? -18 : -5;
    while (x < 322) {
      const bw = range(random, hd ? 26 : 29, hd ? 58 : 55);
      const base = [c.wall1, c.wall2, c.wall1, c.wall3, c.wall2][
        range(random, 0, 4)
      ];
      r.rect((x + 1) * s, (y + 1) * s, (bw - 1) * s, (rh - 1) * s, c.outline);
      r.rect((x + 2) * s, (y + 2) * s, (bw - 3) * s, (rh - 3) * s, base);
      r.line(
        (x + 3) * s,
        (y + 2) * s,
        (x + bw - 4) * s,
        (y + 2) * s,
        c.light,
        s,
      );
      r.line(
        (x + bw - 3) * s,
        (y + 3) * s,
        (x + bw - 3) * s,
        (y + rh - 3) * s,
        c.shade,
        s,
      );
      r.line(
        (x + 3) * s,
        (y + rh - 3) * s,
        (x + bw - 4) * s,
        (y + rh - 3) * s,
        c.wall0,
        s,
      );
      const specks = hd ? 6 : 2;
      for (let n = 0; n < specks; n++) {
        const px = range(random, x + 4, x + bw - 5),
          py = range(random, y + 4, y + rh - 5);
        if (px > x && px < x + bw && py > y && py < y + rh)
          r.pixel(px * s, py * s, random() > 0.55 ? c.wall3 : c.shade);
      }
      if (random() > (hd ? 0.45 : 0.68)) {
        const crackX = range(random, x + 8, x + bw - 8),
          crackY = y + rh - 5;
        r.line(
          crackX * s,
          crackY * s,
          (crackX - 2) * s,
          (crackY + 2) * s,
          c.outline,
          s,
        );
        if (hd) r.pixel((crackX - 3) * s, (crackY + 3) * s, c.shade);
      }
      x += bw;
    }
    y += rh;
  }
  // Deep arched recesses and the monumental central passage.
  drawAlcove(r, 36, 42, 34, 67, s, c, hd);
  drawAlcove(r, 250, 43, 30, 65, s, c, hd);
  r.rect(128 * s, 55 * s, 64 * s, 73 * s, c.deep);
  r.ellipse(160 * s, 55 * s, 32 * s, 32 * s, c.deep);
  r.rect(130 * s, 62 * s, 60 * s, 66 * s, c.deep);
  // Monumental outer piers, with fine fluting and capital shadow.
  drawColumn(r, 28, s, c, hd);
  drawColumn(r, 292, s, c, hd);
  // The inner chamber walls are darker toward the corners and warmer near the torches.
  drawTorch(r, 46, 35, s, c, random, hd);
  drawTorch(r, 274, 35, s, c, random, hd);
  // Carved horizontal cornice with alternating gold edge and deep cut shadow.
  r.rect(0, 13 * s, 320 * s, 4 * s, c.outline);
  r.rect(0, 14 * s, 320 * s, 1 * s, c.gold);
  r.rect(0, 17 * s, 320 * s, 2 * s, c.wall3);
  r.line(0, 20 * s, 320 * s, 20 * s, c.gleam, s);
  // Broad tile floor, receding to the sealed passage.
  r.polygon(
    [
      [0, 119 * s],
      [320 * s, 119 * s],
      [320 * s, 160 * s],
      [0, 160 * s],
    ],
    c.floor,
  );
  r.line(0, 121 * s, 320 * s, 121 * s, c.gold, 2 * s);
  r.line(0, 124 * s, 320 * s, 124 * s, c.outline, 2 * s);
  for (let row = 0; row < 5; row++) {
    const yy = (128 + row * 7) * s;
    r.line(0, yy, 320 * s, yy, row % 2 ? c.shade : c.wall2, s);
  }
  const vanX = 160 * s,
    vanY = 119 * s;
  for (let x = -160; x <= 480; x += 32)
    r.line(vanX, vanY, x * s, 160 * s, c.shade, s);
  for (let xx = 0; xx < 320; xx += 32) {
    r.line(xx * s, 128 * s, xx * s, 160 * s, c.outline, s);
  }
  // Pixel-lit dust bands and torch reflections pool against the lower wall.
  r.bandGlow(46 * s, 50 * s, (hd ? 43 : 31) * s, c.flame, 0.8, 12);
  r.bandGlow(274 * s, 50 * s, (hd ? 43 : 31) * s, c.flame, 0.8, 72);
  for (let i = 0; i < config.textureCount; i++) {
    const x = range(random, 8, 312),
      yy = range(random, 22, 118);
    if (x > 126 && x < 194 && yy > 43 && yy < 128) continue;
    const color = random() > 0.62 ? c.light : c.shade;
    const len = hd ? range(random, 1, 3) : range(random, 1, 2);
    r.rect(x * s, yy * s, len * s, s, color, hd ? 0.68 : 0.52);
  }
  if (hd) {
    // Fine chipped limestone, tightly controlled so the large architectural forms stay readable.
    for (let i = 0; i < 260; i++) {
      const x = range(random, 12, 308) * s,
        yy = range(random, 22, 118) * s;
      if (x > 128 * s && x < 192 * s && yy > 48 * s) continue;
      r.pixel(x, yy, random() > 0.5 ? c.gleam : c.outline, 0.66);
    }
    // Deliberate ray-shaped torch falloff rather than a blurred gradient.
    for (let ray = 0; ray < config.rayCount; ray++) {
      const xx = (48 + ray * 4) * s;
      for (let yy = 56 * s; yy < 112 * s; yy += 3 * s)
        if ((ray + Math.floor(yy / s)) % 4 === 0)
          r.pixel(xx + ((ray % 3) - 1) * s, yy, c.light, 0.22);
    }
  }
  return r;
}

function drawCorridor(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(64 * s, 90 * s, c),
    hd = name === 'hd';
  r.rect(0, 0, r.width, r.height, c.deep);
  r.ellipse(32 * s, 10 * s, 29 * s, 28 * s, c.outline);
  r.ellipse(32 * s, 10 * s, 26 * s, 25 * s, c.shade);
  r.rect(6 * s, 10 * s, 52 * s, 78 * s, c.shade);
  r.rect(11 * s, 14 * s, 42 * s, 72 * s, c.deep);
  r.rect(17 * s, 20 * s, 30 * s, 62 * s, c.outline);
  r.rect(22 * s, 27 * s, 20 * s, 50 * s, c.deep);
  r.ellipse(32 * s, 35 * s, 7 * s, 9 * s, c.gold, false, 2 * s);
  r.ellipse(32 * s, 35 * s, 3 * s, 5 * s, c.goldLight, false, s);
  r.line(32 * s, 42 * s, 32 * s, 58 * s, c.gold, s);
  r.line(0, 76 * s, 64 * s, 76 * s, c.wall2, s);
  for (let i = 0; i < 4; i++) {
    r.line(32 * s, 76 * s, i * 22 * s, 90 * s, c.shade, s);
    r.line(0, (78 + i * 3) * s, 64 * s, (78 + i * 3) * s, c.outline, s);
  }
  if (hd)
    for (let i = 0; i < 22; i++)
      r.pixel(
        ((i * 17) % 64) * s,
        ((i * 31) % 85) * s,
        i % 2 ? c.light : c.gold,
        0.7,
      );
  return r;
}

function drawFrame(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(W * s, H * s, c),
    hd = name === 'hd';
  const strokeArch = (rx, top, bottom, color, width) => {
    const cx = 160 * s,
      ry = 31 * s;
    for (let i = 0; i <= 44; i++) {
      const a = Math.PI + (Math.PI * i) / 44;
      const x = cx + Math.cos(a) * rx * s,
        y = top * s + Math.sin(a) * ry;
      r.rect(
        x - (width * s) / 2,
        y - (width * s) / 2,
        width * s,
        width * s,
        color,
      );
    }
    r.line(
      (160 - rx) * s,
      (top + 31) * s,
      (160 - rx) * s,
      bottom * s,
      color,
      width * s,
    );
    r.line(
      (160 + rx) * s,
      (top + 31) * s,
      (160 + rx) * s,
      bottom * s,
      color,
      width * s,
    );
  };
  strokeArch(36, 31, 130, c.outline, 8);
  strokeArch(34, 32, 129, c.wall0, 5);
  strokeArch(32, 33, 128, c.gold, 2);
  strokeArch(30, 34, 126, c.gleam, 1);
  // Engraved lintel stones and corner rosettes.
  for (let i = 0; i < 7; i++) {
    const x = 128 + i * 10;
    r.rect(x * s, 28 * s, 8 * s, 5 * s, i % 2 ? c.wall2 : c.gold);
    r.line((x + 1) * s, 29 * s, (x + 6) * s, 29 * s, c.gleam, s);
    r.pixel((x + 4) * s, 31 * s, c.outline);
  }
  for (const x of [124, 196]) {
    r.rect((x - 3) * s, 61 * s, 6 * s, 30 * s, c.wall3);
    for (let i = 0; i < 4; i++)
      r.line(
        (x - 2) * s,
        (64 + i * 7) * s,
        (x + 2) * s,
        (64 + i * 7) * s,
        c.goldLight,
        s,
      );
    r.ellipse(x * s, 113 * s, 4 * s, 4 * s, c.gold);
    r.ellipse(x * s, 113 * s, 2 * s, 2 * s, c.outline);
  }
  // Heavy lateral buttresses conceal the sliding leaves at the end of their travel.
  for (const x of [74, 214]) {
    r.rect(x * s, 45 * s, 32 * s, 77 * s, c.outline);
    r.polygon(
      [
        [(x + 4) * s, 53 * s],
        [(x + 28) * s, 53 * s],
        [(x + 26) * s, 114 * s],
        [(x + 6) * s, 114 * s],
      ],
      c.wall2,
    );
    r.rect((x + 7) * s, 56 * s, 2 * s, 55 * s, c.wall3);
    r.rect((x + 11) * s, 57 * s, s, 54 * s, c.gleam);
    r.rect((x + 22) * s, 56 * s, 2 * s, 57 * s, c.wall0);
    r.rect((x + 25) * s, 54 * s, s, 59 * s, c.shade);
    r.rect((x - 3) * s, 46 * s, 38 * s, 8 * s, c.outline);
    r.rect((x - 2) * s, 46 * s, 36 * s, 5 * s, c.wall3);
    r.rect(x * s, 46 * s, 32 * s, 2 * s, c.gleam);
    r.rect((x - 2) * s, 114 * s, 36 * s, 9 * s, c.outline);
    r.rect(x * s, 116 * s, 32 * s, 4 * s, c.gold);
    if (hd) {
      for (let line = 0; line < 3; line++) {
        const yy = (70 + line * 19) * s;
        r.line((x + 13) * s, yy, (x + 19) * s, yy, c.gold, s);
        r.pixel((x + 16) * s, yy - s, c.gleam);
      }
    }
  }
  r.rect(122 * s, 127 * s, 76 * s, 5 * s, c.outline);
  r.rect(126 * s, 127 * s, 68 * s, 2 * s, c.gold);
  if (hd)
    for (let i = 0; i < 28; i++)
      r.pixel(
        (126 + ((i * 13) % 68)) * s,
        (37 + ((i * 19) % 85)) * s,
        i % 3 ? c.light : c.shade,
      );
  return r;
}

function drawDoorLeaf(name, right = false) {
  const { scale: s, colors: c } = palettes[name],
    w = 30,
    h = 100,
    r = new Raster(w * s, h * s, c),
    hd = name === 'hd';
  const random = rng((right ? 317 : 211) + (hd ? 301 : 101));
  r.rect(0, 0, w * s, h * s, c.outline);
  r.rect(1 * s, 1 * s, (w - 2) * s, (h - 2) * s, c.door);
  r.rect(2 * s, 2 * s, 3 * s, (h - 4) * s, c.shade);
  r.rect(5 * s, 3 * s, 1 * s, (h - 6) * s, c.doorLight);
  r.rect((w - 4) * s, 2 * s, 2 * s, (h - 4) * s, c.deep);
  r.rect(4 * s, 5 * s, (w - 8) * s, 2 * s, c.gold);
  r.rect(4 * s, (h - 7) * s, (w - 8) * s, 2 * s, c.outline);
  r.rect(5 * s, 6 * s, (w - 10) * s, 1 * s, c.gleam);
  r.rect(5 * s, (h - 7) * s, (w - 10) * s, 1 * s, c.wall2);
  r.rect(4 * s, 10 * s, (w - 8) * s, 1 * s, c.outline);
  r.rect(5 * s, 11 * s, (w - 10) * s, 1 * s, c.gold);
  r.rect(4 * s, 88 * s, (w - 8) * s, 1 * s, c.outline);
  // Paired sun discs and stepped rays form one continuous seal across both slabs.
  r.ellipse(15 * s, 40 * s, 9 * s, 11 * s, c.outline);
  r.ellipse(15 * s, 40 * s, 7 * s, 9 * s, c.gold);
  r.ellipse(15 * s, 40 * s, 5 * s, 7 * s, c.doorLight);
  r.ellipse(15 * s, 40 * s, 2 * s, 3 * s, c.goldLight);
  const direction = right ? -1 : 1;
  for (let i = 0; i < 5; i++) {
    const yy = 24 + i * 8;
    const end = 15 + direction * (i % 2 ? 7 : 9);
    r.line(
      (15 + direction * 5) * s,
      yy * s,
      end * s,
      yy * s,
      i % 2 ? c.goldLight : c.outline,
      s,
    );
    if (hd) r.pixel((15 + direction * 7) * s, (yy - 1) * s, c.gleam);
  }
  for (let i = 0; i < (hd ? 70 : 25); i++) {
    const x = range(random, 3, w - 4);
    const y = range(random, 14, 68);
    if (i % (hd ? 3 : 5) === 0)
      r.pixel(x * s, y * s, i % 2 ? c.wall3 : c.shade);
  }
  return r;
}

function drawMechanism(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(44 * s, 40 * s, c),
    hd = name === 'hd';
  r.ellipse(22 * s, 36 * s, 21 * s, 4 * s, c.outline);
  r.polygon(
    [
      [3 * s, 29 * s],
      [8 * s, 11 * s],
      [36 * s, 11 * s],
      [41 * s, 29 * s],
      [35 * s, 35 * s],
      [9 * s, 35 * s],
    ],
    c.outline,
  );
  r.polygon(
    [
      [5 * s, 28 * s],
      [10 * s, 13 * s],
      [34 * s, 13 * s],
      [39 * s, 28 * s],
      [34 * s, 32 * s],
      [10 * s, 32 * s],
    ],
    c.wall0,
  );
  r.line(9 * s, 14 * s, 35 * s, 14 * s, c.light, 2 * s);
  r.line(11 * s, 17 * s, 33 * s, 17 * s, c.gold, s);
  for (let i = 0; i < 3; i++) {
    const x = (10 + i * 12) * s;
    r.rect(x - 2 * s, 19 * s, 10 * s, 2 * s, c.outline);
    r.rect(x - 1 * s, 21 * s, 8 * s, 13 * s, c.deep);
    r.line(x, 22 * s, x + 6 * s, 22 * s, c.wall2, s);
    r.line(x, 32 * s, x + 6 * s, 32 * s, c.gold, s);
  }
  r.rect(2 * s, 30 * s, 40 * s, 4 * s, c.outline);
  r.rect(4 * s, 30 * s, 36 * s, 2 * s, c.gold);
  for (let i = 0; i < 7; i++)
    r.pixel((7 + i * 5) * s, 31 * s, i % 2 ? c.gleam : c.wall0);
  if (hd) {
    for (let i = 0; i < 45; i++) {
      const x = (6 + ((i * 17) % 32)) * s,
        y = (15 + ((i * 23) % 16)) * s;
      r.pixel(x, y, i % 2 ? c.wall3 : c.outline, 0.8);
    }
  }
  return r;
}

function drawRing(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(14 * s, 14 * s, c);
  r.ellipse(7 * s, 7 * s, 6 * s, 6 * s, c.outline);
  r.ellipse(7 * s, 7 * s, 5 * s, 5 * s, c.gold);
  r.ellipse(7 * s, 7 * s, 4 * s, 4 * s, c.doorLight);
  r.ellipse(7 * s, 7 * s, 2 * s, 2 * s, c.outline);
  r.ellipse(7 * s, 7 * s, 1 * s, 1 * s, c.deep);
  r.line(7 * s, 1 * s, 7 * s, 4 * s, c.gleam, s);
  r.line(5 * s, 3 * s, 7 * s, 1 * s, c.gleam, s);
  r.line(9 * s, 3 * s, 7 * s, 1 * s, c.gleam, s);
  for (const [x, y] of [
    [7, 0],
    [13, 7],
    [7, 13],
    [0, 7],
  ])
    r.pixel(x * s, y * s, c.outline);
  return r;
}

function drawClue(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(42 * s, 48 * s, c),
    hd = name === 'hd';
  r.rect(0, 0, 42 * s, 48 * s, c.outline);
  r.rect(2 * s, 2 * s, 38 * s, 44 * s, c.wall0);
  r.rect(4 * s, 4 * s, 34 * s, 40 * s, c.shade);
  r.line(4 * s, 5 * s, 37 * s, 5 * s, c.gold, 2 * s);
  r.line(4 * s, 43 * s, 37 * s, 43 * s, c.outline, 2 * s);
  // Three rebus-like glyphs, with the ray directions encoded as relief rather than text.
  const dirs = [1, 2, 3];
  for (let i = 0; i < 3; i++) {
    const cx = (10 + i * 11) * s,
      cy = 23 * s;
    r.ellipse(cx, cy, 3 * s, 3 * s, c.goldLight);
    r.ellipse(cx, cy, 1 * s, 1 * s, c.outline);
    for (let k = 0; k < 4; k++) {
      const a = (Math.PI / 2) * k;
      const length = k === dirs[i] ? 7 : 4;
      r.line(
        cx + Math.cos(a) * 4 * s,
        cy + Math.sin(a) * 4 * s,
        cx + Math.cos(a) * length * s,
        cy + Math.sin(a) * length * s,
        k === dirs[i] ? c.gleam : c.gold,
        s,
      );
    }
    if (hd) {
      r.line((6 + i * 11) * s, 33 * s, (14 + i * 11) * s, 33 * s, c.gold, s);
      r.pixel((10 + i * 11) * s, 34 * s, c.gleam);
    }
  }
  // A carved channel links sun, river and eye without writing the solution.
  r.line(8 * s, 38 * s, 34 * s, 38 * s, c.wall3, s);
  r.line(20 * s, 37 * s, 20 * s, 40 * s, c.gleam, s);
  return r;
}

function drawVessel(name) {
  const { scale: s, colors: c } = palettes[name],
    r = new Raster(28 * s, 42 * s, c),
    hd = name === 'hd';
  r.ellipse(14 * s, 39 * s, 13 * s, 3 * s, c.outline);
  r.polygon(
    [
      [8 * s, 6 * s],
      [20 * s, 6 * s],
      [22 * s, 13 * s],
      [25 * s, 30 * s],
      [20 * s, 37 * s],
      [8 * s, 37 * s],
      [3 * s, 30 * s],
      [6 * s, 13 * s],
    ],
    c.outline,
  );
  r.polygon(
    [
      [9 * s, 8 * s],
      [19 * s, 8 * s],
      [20 * s, 14 * s],
      [23 * s, 29 * s],
      [19 * s, 34 * s],
      [9 * s, 34 * s],
      [5 * s, 29 * s],
      [8 * s, 14 * s],
    ],
    c.vessel,
  );
  r.line(9 * s, 9 * s, 18 * s, 9 * s, c.gleam, s);
  r.ellipse(14 * s, 9 * s, 7 * s, 3 * s, c.outline);
  r.ellipse(14 * s, 9 * s, 5 * s, 2 * s, c.deep);
  r.line(8 * s, 17 * s, 20 * s, 17 * s, c.gold, s);
  r.line(6 * s, 28 * s, 22 * s, 28 * s, c.outline, s);
  r.line(8 * s, 30 * s, 20 * s, 30 * s, c.gold, s);
  r.polygon(
    [
      [10 * s, 20 * s],
      [14 * s, 17 * s],
      [18 * s, 20 * s],
      [14 * s, 24 * s],
    ],
    c.gold,
  );
  r.line(11 * s, 20 * s, 17 * s, 20 * s, c.gleam, s);
  if (hd) {
    for (let i = 0; i < 30; i++)
      r.pixel(
        (7 + ((i * 11) % 14)) * s,
        (12 + ((i * 13) % 20)) * s,
        i % 2 ? c.wall3 : c.shade,
      );
    r.line(8 * s, 11 * s, 7 * s, 26 * s, c.light, s);
  }
  return r;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const name = Buffer.from(type),
    chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  name.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return chunk;
}
function encodePng(raster) {
  const raw = Buffer.alloc((raster.width * 4 + 1) * raster.height);
  for (let y = 0; y < raster.height; y++) {
    const dest = y * (raster.width * 4 + 1);
    raw[dest] = 0;
    Buffer.from(
      raster.pixels.buffer,
      raster.pixels.byteOffset + y * raster.width * 4,
      raster.width * 4,
    ).copy(raw, dest + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(raster.width, 0);
  header.writeUInt32BE(raster.height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

await mkdir(OUT, { recursive: true });
for (const style of Object.keys(palettes)) {
  const dir = path.join(OUT, style);
  await mkdir(dir, { recursive: true });
  const assets = {
    'background.png': drawBackground(style),
    'corridor.png': drawCorridor(style),
    'door-frame.png': drawFrame(style),
    'door-left.png': drawDoorLeaf(style, false),
    'door-right.png': drawDoorLeaf(style, true),
    'mechanism.png': drawMechanism(style),
    'sun-ring.png': drawRing(style),
    'clue-relief.png': drawClue(style),
    'vessel.png': drawVessel(style),
  };
  for (const [file, art] of Object.entries(assets))
    await writeFile(path.join(dir, file), encodePng(art));
}
console.log(
  `Generated 18 deterministic PNG layers in ${path.relative(ROOT, OUT)}.`,
);
