// Minimal deterministic pixel-art raster used by the prologue art generator.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

export const BAYER4 = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
].map((v) => (v + 0.5) / 16);

export function bayer(x, y) {
  return BAYER4[(((y % 4) + 4) % 4) * 4 + (((x % 4) + 4) % 4)];
}

export function hex(value) {
  const h = value.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function mix(a, b, t) {
  const ca = typeof a === 'string' ? hex(a) : a;
  const cb = typeof b === 'string' ? hex(b) : b;
  return [0, 1, 2].map((i) => Math.round(ca[i] + (cb[i] - ca[i]) * t));
}

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0,1]. */
export function noise(x, y, seed = 1) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = s(xf);
  const v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, seed = 1, octaves = 3) {
  let total = 0;
  let amp = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    total += noise(x, y, seed + i * 17) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2;
    y *= 2;
  }
  return total / norm;
}

/** Pick a ramp colour for t in [0,1] with ordered dithering. */
export function rampColor(ramp, t, x, y, ditherAmount = 1) {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (ramp.length - 1);
  const base = Math.floor(scaled);
  const frac = scaled - base;
  const threshold = 0.5 + (bayer(x, y) - 0.5) * ditherAmount;
  const index = Math.min(ramp.length - 1, frac > threshold ? base + 1 : base);
  return ramp[index];
}

export class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get(x, y) {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  alpha(x, y) {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  set(x, y, color, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const c = typeof color === 'string' ? hex(color) : color;
    const i = (y * this.width + x) * 4;
    if (alpha >= 255) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const a = alpha / 255;
    const oldA = this.data[i + 3] / 255;
    const outA = a + oldA * (1 - a);
    if (!outA) return;
    for (let k = 0; k < 3; k++)
      this.data[i + k] = Math.round(
        (c[k] * a + this.data[i + k] * oldA * (1 - a)) / outA,
      );
    this.data[i + 3] = Math.round(outA * 255);
  }

  clear(x, y) {
    if (!this.inside(x, y)) return;
    this.data[(y * this.width + x) * 4 + 3] = 0;
  }

  /** Multiply the existing pixel towards a colour (for shading/tinting). */
  tint(x, y, color, amount) {
    if (!this.inside(x, y) || this.alpha(x, y) === 0) return;
    const c = typeof color === 'string' ? hex(color) : color;
    const i = (y * this.width + x) * 4;
    for (let k = 0; k < 3; k++)
      this.data[i + k] = Math.round(
        this.data[i + k] + (c[k] - this.data[i + k]) * amount,
      );
  }

  rect(x, y, w, h, color, alpha = 255) {
    for (let yy = Math.round(y); yy < Math.round(y + h); yy++)
      for (let xx = Math.round(x); xx < Math.round(x + w); xx++)
        this.set(xx, yy, color, alpha);
  }

  line(x0, y0, x1, y1, color, alpha = 255) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, color, alpha);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Scanline polygon fill; `shader(x, y)` returns a colour or null. */
  fillPolygon(points, shader) {
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
    const maxY = Math.min(
      this.height - 1,
      Math.ceil(Math.max(...points.map((p) => p[1]))),
    );
    for (let y = minY; y <= maxY; y++) {
      const cy = y + 0.5;
      const cuts = [];
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const [xi, yi] = points[i];
        const [xj, yj] = points[j];
        if (yi > cy !== yj > cy)
          cuts.push(xi + ((cy - yi) * (xj - xi)) / (yj - yi));
      }
      cuts.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cuts.length; k += 2) {
        const x0 = Math.max(0, Math.round(cuts[k]));
        const x1 = Math.min(this.width - 1, Math.round(cuts[k + 1]) - 1);
        for (let x = x0; x <= x1; x++) {
          const c = typeof shader === 'function' ? shader(x, y) : shader;
          if (c) this.set(x, y, c, c.length === 4 ? c[3] : 255);
        }
      }
    }
  }

  ellipse(cx, cy, rx, ry, shader) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
        if (d > 1) continue;
        const c = typeof shader === 'function' ? shader(x, y, d) : shader;
        if (c) this.set(x, y, c, c.length === 4 ? c[3] : 255);
      }
  }

  /** Add a 1px outline of `color` around opaque pixels (outside only). */
  outline(color, threshold = 128) {
    const add = [];
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (this.alpha(x, y) >= threshold) continue;
        if (
          this.alpha(x - 1, y) >= threshold ||
          this.alpha(x + 1, y) >= threshold ||
          this.alpha(x, y - 1) >= threshold ||
          this.alpha(x, y + 1) >= threshold
        )
          add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, color);
  }

  crop(x, y, w, h) {
    const out = new Raster(w, h);
    for (let yy = 0; yy < h; yy++)
      for (let xx = 0; xx < w; xx++) {
        const c = this.get(x + xx, y + yy);
        if (c[3]) out.set(xx, yy, c, c[3]);
      }
    return out;
  }

  draw(other, ox, oy) {
    for (let y = 0; y < other.height; y++)
      for (let x = 0; x < other.width; x++) {
        const c = other.get(x, y);
        if (c[3]) this.set(ox + x, oy + y, c, c[3]);
      }
  }

  savePng(file) {
    writeFileSync(file, encodePng(this.width, this.height, this.data));
  }
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, payload) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(payload.length);
  const body = Buffer.concat([Buffer.from(type), payload]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
