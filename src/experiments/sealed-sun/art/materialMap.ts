import { PALETTE, type RampName, type Rgb } from './palette.ts';
import { quantize } from './pixelCanvas.ts';

/**
 * A flat relief described by material, not colour: each pixel names a ramp
 * and a step offset (carving edges, inlay depth). The same map is shaded
 * flatly for a close-up, or sampled in perspective and lit by the room's
 * torches when it sits on a wall. That is what keeps the clue in the room and
 * the clue in the close-up the same object.
 */
export const RAMPS: RampName[] = [
  'limestone',
  'sandstone',
  'granite',
  'gold',
  'lapis',
  'turquoise',
  'ochreRed',
  'bronze',
  'void',
  'sand',
  'ceiling',
  'fire',
];

export const NONE = 255;

export class MaterialMap {
  readonly width: number;
  readonly height: number;
  readonly ramp: Uint8Array;
  readonly delta: Int8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ramp = new Uint8Array(width * height).fill(NONE);
    this.delta = new Int8Array(width * height);
  }

  set(x: number, y: number, ramp: RampName, delta = 0) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    this.ramp[i] = RAMPS.indexOf(ramp);
    this.delta[i] = delta;
  }

  /** Adjusts the step offset of an existing pixel (carving, bevels). */
  shift(x: number, y: number, by: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    if (this.ramp[i] !== NONE) this.delta[i] += by;
  }

  rampAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return NONE;
    return this.ramp[y * this.width + x];
  }

  /** Colour of a pixel under a light value in 0..1, or null if empty. */
  shade(
    x: number,
    y: number,
    value: number,
    ditherX = x,
    ditherY = y,
  ): Rgb | null {
    const r = this.rampAt(x, y);
    if (r === NONE) return null;
    const colors = PALETTE[RAMPS[r]];
    const base = quantize(ditherX, ditherY, value, colors.length);
    const idx = base + this.delta[y * this.width + x];
    return colors[Math.max(0, Math.min(colors.length - 1, idx))];
  }
}

/** Painted value bias for inlay ramps, so pigments read at a mid value. */
export function inlayValue(ramp: RampName, light: number) {
  if (ramp === 'gold') return 0.25 + light * 0.75;
  if (ramp === 'lapis' || ramp === 'turquoise' || ramp === 'ochreRed') {
    return 0.18 + light * 0.72;
  }
  return light;
}
