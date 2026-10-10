/**
 * The Sealed Sun palette. Every pixel of the chamber comes from one of these
 * ramps; nothing is tinted at random. Ramps run dark → light and are
 * hue-shifted: shadows lean towards indigo/slate, lights towards warm ochre or
 * cream. That keeps the stone from collapsing into one brown and lets the
 * room's depth be read from temperature as well as value.
 *
 * Material roles (see docs/SEALED_SUN_EXPERIMENT.md):
 *   limestone  walls and floor — the main surface, cool shadows → cream lights
 *   sandstone  door frame, plinths — warmer, more saturated, sets the frame apart
 *   granite    the sealed door — Aswan rose granite, cooler and darker than walls
 *   ceiling    lapis-painted vault with gold stars
 *   gold       inlay, sun disc, stars, the activation light
 *   lapis      painted bands, deep accents
 *   turquoise  faience inlay on the seal stand and frieze
 *   bronze     torch brackets
 *   fire       flames and their glow
 *   void       recesses, the corridor beyond the door
 */
export type Rgb = readonly [number, number, number];

export function hex(value: string): Rgb {
  const n = parseInt(value.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const ramp = (...values: string[]) => values.map(hex);

export const PALETTE = {
  limestone: ramp(
    '#100e1c',
    '#1d1a2e',
    '#2c283f',
    '#3f364b',
    '#594853',
    '#765d5a',
    '#957660',
    '#b3916c',
    '#ceae80',
    '#e6cc9c',
    '#f5e3b8',
  ),
  sandstone: ramp(
    '#170f17',
    '#2a1a1f',
    '#432826',
    '#5e372b',
    '#7d4a31',
    '#9c6136',
    '#b97b3f',
    '#d2984e',
    '#e6b766',
    '#f4d48a',
  ),
  granite: ramp(
    '#120c16',
    '#1f1320',
    '#2f1b29',
    '#432532',
    '#59303a',
    '#713e43',
    '#8a5050',
    '#a3665e',
    '#bb8070',
  ),
  ceiling: ramp('#060814', '#0b1027', '#121a3c', '#1b2752', '#263667'),
  gold: ramp(
    '#2b1708',
    '#55300d',
    '#865014',
    '#b8761c',
    '#e0a630',
    '#f6d35e',
    '#fff2b0',
  ),
  lapis: ramp('#0a0f26', '#14204a', '#1f3271', '#2e4a9a', '#4b6cc0', '#7d9be0'),
  turquoise: ramp(
    '#0a2626',
    '#11423f',
    '#1b6660',
    '#2a8f84',
    '#4cb8a4',
    '#8fe0c8',
  ),
  ochreRed: ramp('#2a0f12', '#4a1a17', '#6e2a1e', '#923d25', '#b4573a'),
  bronze: ramp(
    '#1a1010',
    '#3a2117',
    '#5f3a20',
    '#8a5a2c',
    '#b8843e',
    '#e0b264',
  ),
  fire: ramp('#3d1206', '#8a2a0a', '#d9590f', '#f7a12a', '#ffe07a', '#fffbe0'),
  void: ramp('#040309', '#08070f', '#0e0c18', '#161322', '#201b2e'),
  sand: ramp('#3a2a2a', '#5e4436', '#86643f', '#ad8a54', '#cfb070', '#ead095'),
  ink: hex('#07050b'),
} as const;

export type RampName = Exclude<keyof typeof PALETTE, 'ink'>;

/** Picks a ramp colour from a 0..1 position (no dithering). */
export function rampAt(name: RampName, t: number): Rgb {
  const r = PALETTE[name];
  return r[Math.max(0, Math.min(r.length - 1, Math.round(t * (r.length - 1))))];
}

/** CSS form of a palette colour, for the DOM overlay. */
export function css(color: Rgb, alpha = 1) {
  return alpha >= 1
    ? `rgb(${color[0]} ${color[1]} ${color[2]})`
    : `rgb(${color[0]} ${color[1]} ${color[2]} / ${alpha})`;
}

export function toHexNumber(color: Rgb) {
  return (color[0] << 16) | (color[1] << 8) | color[2];
}
