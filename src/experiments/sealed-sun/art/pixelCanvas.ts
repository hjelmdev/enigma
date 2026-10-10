import type { Rgb } from './palette.ts';

/**
 * A plain RGBA pixel buffer. All Sealed Sun art is drawn into these, one art
 * pixel per buffer pixel, so the same generator runs in the browser (uploaded
 * as a nearest-filtered canvas texture) and in Node (written as PNG by
 * tools/export-sealed-sun-art.ts).
 */
export class PixelCanvas {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  inside(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  put(x: number, y: number, color: Rgb, alpha = 255) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (!this.inside(x, y)) return;
    const i = (y * this.width + x) * 4;
    if (alpha >= 255) {
      this.data[i] = color[0];
      this.data[i + 1] = color[1];
      this.data[i + 2] = color[2];
      this.data[i + 3] = 255;
      return;
    }
    // Source-over blend; used sparingly (glows), never for base materials.
    const a = alpha / 255;
    const da = this.data[i + 3] / 255;
    const outA = a + da * (1 - a);
    if (outA <= 0) return;
    for (let c = 0; c < 3; c++) {
      this.data[i + c] =
        (color[c] * a + this.data[i + c] * da * (1 - a)) / outA;
    }
    this.data[i + 3] = outA * 255;
  }

  get(x: number, y: number): [number, number, number, number] {
    if (!this.inside(x, y)) return [0, 0, 0, 0];
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  alphaAt(x: number, y: number) {
    return this.inside(x, y) ? this.data[(y * this.width + x) * 4 + 3] : 0;
  }

  clear(x: number, y: number) {
    if (!this.inside(x, y)) return;
    this.data.fill(0, (y * this.width + x) * 4, (y * this.width + x) * 4 + 4);
  }

  rect(x: number, y: number, w: number, h: number, color: Rgb) {
    for (let yy = Math.floor(y); yy < y + h; yy++) {
      for (let xx = Math.floor(x); xx < x + w; xx++) this.put(xx, yy, color);
    }
  }

  /** Copies another canvas on top (alpha > 0 pixels only). */
  blit(src: PixelCanvas, dx: number, dy: number) {
    for (let y = 0; y < src.height; y++) {
      for (let x = 0; x < src.width; x++) {
        const [r, g, b, a] = src.get(x, y);
        if (a > 0) this.put(dx + x, dy + y, [r, g, b], a);
      }
    }
  }

  /** Draws a 1 px dark outline around every opaque silhouette. */
  outline(color: Rgb) {
    const marks: number[] = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.alphaAt(x, y) > 0) continue;
        if (
          this.alphaAt(x - 1, y) > 128 ||
          this.alphaAt(x + 1, y) > 128 ||
          this.alphaAt(x, y - 1) > 128 ||
          this.alphaAt(x, y + 1) > 128
        ) {
          marks.push(x, y);
        }
      }
    }
    for (let i = 0; i < marks.length; i += 2) {
      this.put(marks[i], marks[i + 1], color);
    }
  }
}

/** Deterministic PRNG (mulberry32). Every generator seeds its own. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min: number, max: number) {
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]) {
      return items[Math.floor(next() * items.length)];
    },
  };
}

/** Stable integer hash for per-block / per-cell decisions without state. */
export function hash2(x: number, y: number, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ seed, 1274126177);
  h ^= h >>> 13;
  h = Math.imul(h, 1103515245);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Ordered-dither threshold in [-0.5, 0.5) for an art pixel. */
export function bayer(x: number, y: number) {
  return BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5 + 1 / 32;
}

/**
 * Converts a continuous light value into a ramp index. The dither spread is
 * deliberately narrow: bands stay mostly solid and only their seams dither,
 * which reads as hand-placed shading rather than noise.
 */
export function quantize(
  x: number,
  y: number,
  value: number,
  steps: number,
  spread = 0.45,
) {
  const v = value * (steps - 1) + bayer(x, y) * spread;
  return Math.max(0, Math.min(steps - 1, Math.round(v)));
}
