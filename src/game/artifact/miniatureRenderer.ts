import glyphSheet from './glyphs.json';
import type { Vec3 } from '../puzzles/sunEye';
import { FACE_ELEVATION_DEG } from '../puzzles/sunEye';

/**
 * Tiny software rasteriser for the grandfather's miniature pyramid.
 *
 * Renders the canonical engraving sheet (glyphs.json) onto a real pyramid at
 * any yaw/pitch, so every scene shows the same object with the same carvings
 * and the same pixel-art shading. Output is RGBA at a small native size that
 * the scene scales up with nearest-neighbour filtering.
 */

export type GlyphName = keyof typeof glyphSheet.glyphs;

export const GLYPHS = glyphSheet.glyphs as Record<GlyphName, string[]>;
export const GLYPH_SIZE = glyphSheet.size;
/** Faces in object space: eye +z, sun +x, steps -z, moon -x. */
export const FACE_ORDER: GlyphName[] = ['eye', 'sun', 'steps', 'moon'];

export interface MiniatureView {
  size: number;
  /** Azimuth of the eye face normal in degrees (0 = away from viewer). */
  yaw: number;
  /** Extra tilt of the eye face normal in degrees. */
  pitch: number;
  /** Unit vector pointing toward the key light (world space). */
  light: Vec3;
  /** 0..1, extra brightness of the polished inlay (sun caught). */
  glow?: number;
  /** Fraction of the canvas the pyramid's base width spans. */
  scale?: number;
  warmth?: number;
  /** Camera looks down on the object by this many degrees. */
  viewTilt?: number;
}

const HEIGHT = Math.tan((90 - FACE_ELEVATION_DEG) * (Math.PI / 180));
const PIVOT_Y = HEIGHT * 0.32;

const STONE = [
  [8, 9, 13],
  [15, 18, 25],
  [24, 29, 38],
  [35, 42, 53],
  [50, 58, 70],
  [72, 79, 89],
  [88, 93, 101],
  [126, 124, 118],
];
const BRONZE = [
  [44, 26, 14],
  [92, 56, 26],
  [148, 96, 42],
  [205, 146, 66],
  [244, 203, 120],
  [255, 243, 204],
];
const OUTLINE = [5, 6, 9];

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(
  (v) => (v + 0.5) / 16 - 0.5,
);

interface Tri {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  glyph: GlyphName;
  face: number;
  kind: 'side' | 'base';
  /** For base triangles, uv per vertex. */
  uv?: [[number, number], [number, number], [number, number]];
}

function buildTriangles(): Tri[] {
  const apex: [number, number, number] = [0, HEIGHT, 0];
  const corners: Record<string, [number, number, number]> = {
    fl: [-1, 0, 1],
    fr: [1, 0, 1],
    br: [1, 0, -1],
    bl: [-1, 0, -1],
  };
  // Each side: bottom-left, bottom-right as seen from outside that face.
  const sides: Array<[string, string]> = [
    ['fr', 'fl'], // eye face (+z): seen from +z, left is +x
    ['br', 'fr'], // sun face (+x)
    ['bl', 'br'], // steps face (-z)
    ['fl', 'bl'], // moon face (-x)
  ];
  const tris: Tri[] = sides.map(([l, r], face) => ({
    a: corners[l],
    b: corners[r],
    c: apex,
    glyph: FACE_ORDER[face],
    face,
    kind: 'side',
  }));
  // Underside, viewed from below: u along +x, v along +z.
  tris.push({
    a: corners.bl,
    b: corners.br,
    c: corners.fr,
    glyph: glyphSheet.underside as GlyphName,
    face: 4,
    kind: 'base',
    uv: [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
  });
  tris.push({
    a: corners.bl,
    b: corners.fr,
    c: corners.fl,
    glyph: glyphSheet.underside as GlyphName,
    face: 4,
    kind: 'base',
    uv: [
      [0, 0],
      [1, 1],
      [0, 1],
    ],
  });
  return tris;
}

const TRIANGLES = buildTriangles();

type V3 = [number, number, number];

function tiltX(v: V3, degrees: number): V3 {
  const t = (degrees * Math.PI) / 180;
  return [
    v[0],
    v[1] * Math.cos(t) + v[2] * Math.sin(t),
    -v[1] * Math.sin(t) + v[2] * Math.cos(t),
  ];
}

function rotate(v: V3, yaw: number, pitch: number, viewTilt = 0): V3 {
  const [x0, y0, z0] = [v[0], v[1] - PIVOT_Y, v[2]];
  const p = (pitch * Math.PI) / 180;
  const y1 = y0 * Math.cos(p) + z0 * Math.sin(p);
  const z1 = -y0 * Math.sin(p) + z0 * Math.cos(p);
  const a = (yaw * Math.PI) / 180;
  const x2 = x0 * Math.cos(a) + z1 * Math.sin(a);
  const z2 = -x0 * Math.sin(a) + z1 * Math.cos(a);
  return viewTilt ? tiltX([x2, y1, z2], viewTilt) : [x2, y1, z2];
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(v: V3): V3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

function glyphAt(glyph: GlyphName, col: number, row: number) {
  if (col < 0 || row < 0 || col >= GLYPH_SIZE || row >= GLYPH_SIZE) return '.';
  return GLYPHS[glyph][row][col];
}

/** Surface code for a side face at barycentric (u along base, v up). */
function sideTexel(glyph: GlyphName, u: number, v: number) {
  const span = 0.46;
  const u0 = 0.5 - span / 2;
  const v0 = 0.07;
  const vSpan = 0.5;
  if (glyph === 'eye' && v > v0 + vSpan * 0.93) {
    // Polished seam running from the eye up to the apex.
    if (Math.abs(u - 0.5) * (1 - v) * 2 < 0.028)
      return { code: '*', below: '.', above: '.' };
  }
  const col = Math.floor(((u - u0) / span) * GLYPH_SIZE);
  const row = GLYPH_SIZE - 1 - Math.floor(((v - v0) / vSpan) * GLYPH_SIZE);
  return {
    code: glyphAt(glyph, col, row),
    above: glyphAt(glyph, col, row - 1),
    below: glyphAt(glyph, col, row + 1),
  };
}

function baseTexel(glyph: GlyphName, u: number, v: number) {
  const margin = 0.1;
  const col = Math.floor(((u - margin) / (1 - margin * 2)) * GLYPH_SIZE);
  const row = Math.floor(((v - margin) / (1 - margin * 2)) * GLYPH_SIZE);
  return {
    code: glyphAt(glyph, col, row),
    above: glyphAt(glyph, col, row - 1),
    below: glyphAt(glyph, col, row + 1),
  };
}

export interface MiniatureRender {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Screen position of the seam/apex highlight in output pixels. */
  apex: { x: number; y: number };
}

export function renderMiniature(view: MiniatureView): MiniatureRender {
  const size = Math.max(8, Math.round(view.size));
  const data = new Uint8ClampedArray(size * size * 4);
  const faceBuffer = new Int8Array(size * size).fill(-1);
  const depth = new Float32Array(size * size).fill(Infinity);
  const scale = (size * (view.scale ?? 0.36)) / 1;
  const cx = size / 2;
  const cy = size * 0.56;
  const tilt = view.viewTilt ?? 16;
  const light = norm(tiltX([view.light.x, view.light.y, view.light.z], tilt));
  const viewDir: V3 = [0, 0, -1];
  const half = norm([
    light[0] + viewDir[0],
    light[1] + viewDir[1],
    light[2] + viewDir[2],
  ]);
  const glow = Math.max(0, Math.min(1, view.glow ?? 0));
  const warmth = view.warmth ?? 1;

  const projected = TRIANGLES.map((tri) => {
    const a = rotate(tri.a, view.yaw, view.pitch, tilt);
    const b = rotate(tri.b, view.yaw, view.pitch, tilt);
    const c = rotate(tri.c, view.yaw, view.pitch, tilt);
    let normal = norm(cross(sub(b, a), sub(c, a)));
    // Ensure outward normals (centroid test against the pivot).
    const centroid: V3 = [
      (a[0] + b[0] + c[0]) / 3,
      (a[1] + b[1] + c[1]) / 3,
      (a[2] + b[2] + c[2]) / 3,
    ];
    const pivotToCentroid = sub(
      centroid,
      rotate([0, HEIGHT * 0.25, 0], view.yaw, view.pitch, tilt),
    );
    if (
      normal[0] * pivotToCentroid[0] +
        normal[1] * pivotToCentroid[1] +
        normal[2] * pivotToCentroid[2] <
      0
    )
      normal = [-normal[0], -normal[1], -normal[2]];
    const toScreen = (p: V3) => [cx + p[0] * scale, cy - p[1] * scale, p[2]];
    return {
      tri,
      normal,
      pa: toScreen(a),
      pb: toScreen(b),
      pc: toScreen(c),
    };
  });

  const samples: Array<
    | { shade: number; code: string; lip: number; spec: number; face: number }
    | undefined
  > = new Array(size * size);

  for (const p of projected) {
    if (p.normal[2] > 0.02) continue; // back-facing
    const [ax, ay, az] = p.pa;
    const [bx, by, bz] = p.pb;
    const [qx, qy, qz] = p.pc;
    const minX = Math.max(0, Math.floor(Math.min(ax, bx, qx)));
    const maxX = Math.min(size - 1, Math.ceil(Math.max(ax, bx, qx)));
    const minY = Math.max(0, Math.floor(Math.min(ay, by, qy)));
    const maxY = Math.min(size - 1, Math.ceil(Math.max(ay, by, qy)));
    const area = (bx - ax) * (qy - ay) - (qx - ax) * (by - ay);
    if (Math.abs(area) < 1e-6) continue;
    const lambert = Math.max(
      0,
      p.normal[0] * light[0] + p.normal[1] * light[1] + p.normal[2] * light[2],
    );
    const sky = 0.5 + 0.5 * p.normal[1];
    const spec = Math.pow(
      Math.max(
        0,
        p.normal[0] * half[0] + p.normal[1] * half[1] + p.normal[2] * half[2],
      ),
      18,
    );
    for (let y = minY; y <= maxY; y++)
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((bx - px) * (qy - py) - (qx - px) * (by - py)) / area;
        const w1 = ((qx - px) * (ay - py) - (ax - px) * (qy - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * az + w1 * bz + w2 * qz;
        const i = y * size + x;
        if (z >= depth[i]) continue;
        depth[i] = z;
        let texel;
        if (p.tri.kind === 'side') {
          const v = w2;
          const u = v >= 0.999 ? 0.5 : (w1 + w2 * 0.5 - v * 0.5) / (1 - v);
          texel = sideTexel(p.tri.glyph, u, v);
        } else {
          const uv = p.tri.uv!;
          const u = w0 * uv[0][0] + w1 * uv[1][0] + w2 * uv[2][0];
          const v = w0 * uv[0][1] + w1 * uv[1][1] + w2 * uv[2][1];
          texel = baseTexel(p.tri.glyph, u, v);
        }
        let shade = 0.08 + 0.12 * sky + 0.42 * lambert;
        let lip = 0;
        if (texel.code === '#') {
          shade *= texel.above === '#' ? 0.55 : 0.32;
          if (texel.below !== '#') lip = 1;
        } else if (texel.code === '.' && texel.below === '#') {
          shade *= 0.88;
        }
        faceBuffer[i] = p.tri.face;
        samples[i] = { shade, code: texel.code, lip, spec, face: p.tri.face };
      }
  }

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const s = samples[i];
      const o = i * 4;
      if (!s) {
        const neighbour =
          (x > 0 && samples[i - 1]) ||
          (x < size - 1 && samples[i + 1]) ||
          (y > 0 && samples[i - size]) ||
          (y < size - 1 && samples[i + size]);
        if (neighbour) {
          data[o] = OUTLINE[0];
          data[o + 1] = OUTLINE[1];
          data[o + 2] = OUTLINE[2];
          data[o + 3] = 255;
        }
        continue;
      }
      const dither = BAYER[(y % 4) * 4 + (x % 4)];
      let color: number[];
      if (s.code === '*') {
        const level = 0.3 + 0.45 * s.shade + 0.6 * s.spec + glow * 0.75;
        const idx = Math.max(
          0,
          Math.min(
            BRONZE.length - 1,
            Math.floor(level * (BRONZE.length - 1) + dither),
          ),
        );
        color = BRONZE[idx];
      } else {
        // Ridge highlight where two visible faces meet.
        const ridge =
          (x > 0 && faceBuffer[i - 1] >= 0 && faceBuffer[i - 1] !== s.face) ||
          (y > 0 &&
            faceBuffer[i - size] >= 0 &&
            faceBuffer[i - size] !== s.face);
        let level = s.shade + s.spec * 0.55 + (s.lip ? 0.1 : 0);
        if (ridge) level += 0.1;
        const idx = Math.max(
          0,
          Math.min(
            STONE.length - 1,
            Math.floor(level * (STONE.length - 2) + dither * 0.18 + 0.5),
          ),
        );
        color = STONE[idx];
        // Warm key light tint on lit surfaces, cool in shadow.
        const warm = Math.max(0, level - 0.35) * 48 * warmth;
        color = [
          Math.min(255, color[0] + warm),
          Math.min(255, color[1] + warm * 0.6),
          Math.max(0, color[2] - warm * 0.2),
        ];
      }
      data[o] = color[0];
      data[o + 1] = color[1];
      data[o + 2] = color[2];
      data[o + 3] = 255;
    }

  const apex = rotate([0, HEIGHT, 0], view.yaw, view.pitch, tilt);
  return {
    width: size,
    height: size,
    data,
    apex: { x: cx + apex[0] * scale, y: cy - apex[1] * scale },
  };
}
