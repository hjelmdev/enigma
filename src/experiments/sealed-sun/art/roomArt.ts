import {
  DOOR,
  ROOM,
  ROOM_H,
  ROOM_W,
  STELE,
  TORCHES,
  VIEW,
  project,
  scaleAt,
  type Vec3,
} from '../layout.ts';
import { lightAt, tone, crease } from './lighting.ts';
import { Masonry } from './masonry.ts';
import { MaterialMap, NONE, RAMPS, inlayValue } from './materialMap.ts';
import { PALETTE, type RampName, type Rgb } from './palette.ts';
import { PixelCanvas, hash2, quantize } from './pixelCanvas.ts';
import { buildSteleMap, carveGlyph } from './steleArt.ts';
import type { GlyphId } from './glyphs.ts';
import { computeChannel } from './channel.ts';

/**
 * The room layer: walls, floor, painted ceiling, door frame, torch brackets
 * and wall reliefs, with a transparent hole where the granite slab sits. The
 * slab and the corridor are separate layers *behind* this one, so the frame,
 * threshold and floor occlude them by construction.
 */

type Surface = 'back' | 'left' | 'right' | 'floor' | 'ceiling' | 'reveal';

interface Hit {
  surface: Surface;
  p: Vec3;
  n: Vec3;
  /** Surface coordinates. */
  u: number;
  v: number;
}

const NORMALS: Record<Surface, Vec3> = {
  back: { x: 0, y: 0, z: -1 },
  left: { x: 1, y: 0, z: 0 },
  right: { x: -1, y: 0, z: 0 },
  floor: { x: 0, y: -1, z: 0 },
  ceiling: { x: 0, y: 1, z: 0 },
  reveal: { x: 0, y: 0, z: -1 },
};

/** Casts the eye ray through an art pixel into the room box. */
function cast(sx: number, sy: number): Hit | null {
  const dx = (sx - VIEW.vx) / VIEW.focal;
  const dy = (sy - VIEW.vy) / VIEW.focal;
  let z: number = ROOM.backZ;
  let surface: Surface = 'back';
  if (dx < 0 && -ROOM.halfWidth / dx < z) {
    z = -ROOM.halfWidth / dx;
    surface = 'left';
  }
  if (dx > 0 && ROOM.halfWidth / dx < z) {
    z = ROOM.halfWidth / dx;
    surface = 'right';
  }
  if (dy > 0 && ROOM.floorY / dy < z) {
    z = ROOM.floorY / dy;
    surface = 'floor';
  }
  if (dy < 0 && ROOM.ceilingY / dy < z) {
    z = ROOM.ceilingY / dy;
    surface = 'ceiling';
  }
  let x = dx * z;
  let y = dy * z;
  if (surface === 'back' && Math.abs(x) < DOOR.halfWidth && y > DOOR.topY) {
    // Through the doorway: the reveal (wall thickness) up to the slab plane.
    let t: number = DOOR.slabZ;
    let n: Vec3 | null = null;
    if (dx < 0 && -DOOR.halfWidth / dx < t) {
      t = -DOOR.halfWidth / dx;
      n = { x: 1, y: 0, z: 0 };
    }
    if (dx > 0 && DOOR.halfWidth / dx < t) {
      t = DOOR.halfWidth / dx;
      n = { x: -1, y: 0, z: 0 };
    }
    if (dy < 0 && DOOR.topY / dy < t) {
      t = DOOR.topY / dy;
      n = { x: 0, y: 1, z: 0 };
    }
    if (dy > 0 && ROOM.floorY / dy < t) {
      t = ROOM.floorY / dy;
      n = { x: 0, y: -1, z: 0 };
    }
    if (!n) return null; // reached the slab plane: the hole
    z = t;
    x = dx * z;
    y = dy * z;
    return { surface: 'reveal', p: { x, y, z }, n, u: z, v: n.y !== 0 ? x : y };
  }
  const p = { x, y, z };
  switch (surface) {
    case 'back':
      return { surface, p, n: NORMALS.back, u: x, v: y };
    case 'left':
      return { surface, p, n: NORMALS.left, u: z, v: y };
    case 'right':
      return { surface, p, n: NORMALS.right, u: -z, v: y };
    case 'floor':
      return { surface, p, n: NORMALS.floor, u: x, v: z };
    default:
      return { surface, p, n: NORMALS.ceiling, u: x, v: z };
  }
}

const WALL_MASONRY = new Masonry(17, -7, 3.2, 0.78, 1.02, 1.3, 2.6);
const SIDE_MASONRY = new Masonry(29, -7, 3.2, 0.8, 1.0, 1.4, 2.9);
const FLOOR_PAVING = new Masonry(53, 0, 20, 1.15, 1.45, 1.5, 2.6, -10, 10);
const CEILING_BEAMS = new Masonry(71, 0, 20, 0.95, 1.2, 30, 31, -20, 20);

function blockId(hit: Hit) {
  switch (hit.surface) {
    case 'back':
      return 1_000_000 + WALL_MASONRY.id(hit.u + 20, hit.v);
    case 'left':
      return 2_000_000 + SIDE_MASONRY.id(hit.u, hit.v);
    case 'right':
      return 3_000_000 + SIDE_MASONRY.id(hit.u + 40, hit.v);
    case 'floor':
      return 4_000_000 + FLOOR_PAVING.id(hit.u, hit.v);
    case 'ceiling':
      return 5_000_000 + CEILING_BEAMS.id(0, hit.v);
    default:
      return (
        6_000_000 + (hit.n.x > 0 ? 1 : hit.n.x < 0 ? 2 : hit.n.y > 0 ? 3 : 4)
      );
  }
}

// ---------------------------------------------------------------------------
// Decals: material maps placed in surface coordinates.

interface Decal {
  surface: Surface;
  map: MaterialMap;
  /** Surface coordinates of the map's top-left pixel and its pixel size. */
  u0: number;
  v0: number;
  du: number;
  dv: number;
}

function sampleDecal(d: Decal, u: number, v: number) {
  const x = Math.floor((u - d.u0) / d.du);
  const y = Math.floor((v - d.v0) / d.dv);
  const r = d.map.rampAt(x, y);
  return r === NONE
    ? null
    : { x, y, r, delta: d.map.delta[y * d.map.width + x] };
}

const COLUMN_TEXT: GlyphId[] = [
  'ankh',
  'djed',
  'reed',
  'owl',
  'water',
  'bread',
  'house',
  'feather',
  'eye',
  'vase',
  'sedge',
  'hand',
  'lotus',
  'fish',
  'shen',
  'basket',
];

/** Columns of carved, lapis-painted text on a side wall. */
function glyphColumnsDecal(
  surface: Surface,
  u0: number,
  u1: number,
  seed: number,
): Decal {
  const pxPerUnit = 25;
  const w = Math.round((u1 - u0) * pxPerUnit);
  const top = -4.95;
  const h = Math.round((1.95 - top) * pxPerUnit);
  const map = new MaterialMap(w, h);
  const columns = Math.floor((w - 2) / 17);
  for (let c = 0; c < columns; c++) {
    const left = 3 + c * 17;
    for (let r = 0; r * 16 + 13 <= h - 2; r++) {
      const id = COLUMN_TEXT[(c * 5 + r * 3 + seed) % COLUMN_TEXT.length];
      const ramp: RampName = (r + c) % 3 === 0 ? 'ochreRed' : 'lapis';
      carveGlyph(map, id, left, 2 + r * 16, ramp);
    }
  }
  // Column rules: a carved line between columns, drawn on empty stone only.
  for (let c = 0; c <= columns; c++) {
    const x = 1 + c * 17;
    for (let y = 0; y < h; y++) {
      if (map.rampAt(x, y) === NONE) map.set(x, y, 'limestone', -2);
      if (map.rampAt(x + 1, y) === NONE) map.set(x + 1, y, 'limestone', 1);
    }
  }
  return { surface, map, u0, v0: top, du: 1 / pxPerUnit, dv: 1 / pxPerUnit };
}

function buildDecals(): Decal[] {
  const steleMap = buildSteleMap();
  const stele: Decal = {
    surface: 'left',
    map: steleMap,
    u0: STELE.z0,
    v0: STELE.topY,
    du: (STELE.z1 - STELE.z0) / STELE.artW,
    dv: (STELE.bottomY - STELE.topY) / STELE.artH,
  };
  return [
    stele,
    glyphColumnsDecal('left', 11.85, 12.6, 4),
    // Right wall: u = -z, so near columns have the larger u.
    glyphColumnsDecal('right', -12.9, -11.85, 7),
    glyphColumnsDecal('right', -7.6, -6.85, 9),
  ];
}

// ---------------------------------------------------------------------------
// Painted bands: kheker frieze under the ceiling, dado above the floor.

function paintedBand(
  u: number,
  v: number,
): { ramp: RampName; delta: number } | null {
  const top = ROOM.ceilingY;
  if (v < top + 0.52) {
    const period = 0.34;
    const k = Math.floor(u / period);
    const fu = u / period - k;
    const fv = (v - top) / 0.52;
    const knob = (fu - 0.5) ** 2 / 0.05 + (fv - 0.2) ** 2 / 0.018 < 1;
    const body =
      Math.abs(fu - 0.5) < 0.24 - fv * 0.06 && fv > 0.26 && fv < 0.92;
    const waist = Math.abs(fu - 0.5) < 0.12 && fv > 0.16 && fv < 0.3;
    if (knob || body || waist) {
      const ramps: RampName[] = ['lapis', 'ochreRed', 'turquoise', 'ochreRed'];
      return { ramp: ramps[((k % 4) + 4) % 4], delta: fv > 0.8 ? -1 : 0 };
    }
    if (fv > 0.94) return { ramp: 'lapis', delta: -1 };
    return null;
  }
  if (v < top + 0.74) {
    const seg = Math.floor(u / 0.3);
    const ramps: RampName[] = [
      'lapis',
      'gold',
      'ochreRed',
      'turquoise',
      'gold',
    ];
    const edge = v < top + 0.56 || v > top + 0.7;
    return edge
      ? { ramp: 'limestone', delta: -2 }
      : { ramp: ramps[((seg % 5) + 5) % 5], delta: 0 };
  }
  if (v > ROOM.floorY - 0.44) {
    if (v < ROOM.floorY - 0.38) return { ramp: 'lapis', delta: 0 };
    return { ramp: 'ochreRed', delta: v > ROOM.floorY - 0.06 ? -1 : 0 };
  }
  return null;
}

// ---------------------------------------------------------------------------
// The door frame, torch brackets and back wall reliefs, authored directly in
// screen pixels (the back wall is parallel to the screen at scale ~20.7).

export interface FrameGeometry {
  outerL: number;
  outerR: number;
  openL: number;
  openR: number;
  openTop: number;
  lintelTop: number;
  corniceTop: number;
  floor: number;
}

export function frameGeometry(): FrameGeometry {
  const outerA = project(-DOOR.frameHalfWidth, DOOR.corniceTopY, ROOM.backZ);
  const outerB = project(DOOR.frameHalfWidth, ROOM.floorY, ROOM.backZ);
  const open = project(-DOOR.halfWidth, DOOR.topY, ROOM.backZ);
  const openB = project(DOOR.halfWidth, ROOM.floorY, ROOM.backZ);
  const lintel = project(0, DOOR.lintelTopY, ROOM.backZ);
  return {
    outerL: Math.round(outerA.x),
    outerR: Math.round(outerB.x),
    openL: Math.round(open.x),
    openR: Math.round(openB.x),
    openTop: Math.round(open.y),
    lintelTop: Math.round(lintel.y),
    corniceTop: Math.round(outerA.y),
    floor: Math.round(outerB.y),
  };
}

const JAMB_TEXT: GlyphId[] = [
  'ankh',
  'djed',
  'shen',
  'reed',
  'sun',
  'feather',
  'lotus',
  'water',
  'ankh',
];

function buildFrontMap(): MaterialMap {
  const map = new MaterialMap(ROOM_W, ROOM_H);
  const f = frameGeometry();
  const cx = VIEW.vx;

  // Jambs, with a bound torus moulding on the outer edge.
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? f.outerL : f.openR;
    const x1 = side < 0 ? f.openL : f.outerR;
    for (let y = f.lintelTop; y < f.floor; y++) {
      for (let x = x0; x < x1; x++) {
        let delta = 0;
        const fromOuter = side < 0 ? x - x0 : x1 - 1 - x;
        if (fromOuter === 0) delta = side < 0 ? 1 : -1;
        else if (fromOuter === 1) delta = (x + y) % 6 < 2 ? -1 : 1;
        else if (fromOuter === 2) delta = -1;
        const fromInner = side < 0 ? x1 - 1 - x : x - x0;
        if (fromInner === 0) delta = -2;
        map.set(x, y, 'sandstone', delta);
      }
    }
    // Inscription column centred in the jamb.
    const colLeft = side < 0 ? f.outerL + 4 : f.openR + 1;
    for (let r = 0; r < JAMB_TEXT.length; r++) {
      const top = f.openTop - 6 + r * 16;
      if (top + 13 > f.floor - 6) break;
      carveGlyph(
        map,
        JAMB_TEXT[(r + (side > 0 ? 3 : 0)) % JAMB_TEXT.length],
        colLeft,
        top,
        'lapis',
      );
    }
    // Sand-lock vents at the foot of each jamb (sand pours out when released).
    const vx = side < 0 ? f.openL - 9 : f.openR + 4;
    for (let y = f.floor - 9; y < f.floor - 4; y++) {
      for (let x = vx; x < vx + 5; x++)
        map.set(x, y, 'void', y === f.floor - 9 ? 1 : 0);
    }
    for (let x = vx - 1; x < vx + 6; x++) map.shift(x, f.floor - 4, 2);
  }

  // Lintel with the winged sun disc.
  for (let y = f.lintelTop; y < f.openTop; y++) {
    for (let x = f.outerL; x < f.outerR; x++) {
      let delta = 0;
      if (y < f.lintelTop + 2) delta = -2; // cornice shadow
      if (y === f.openTop - 1) delta = -1;
      map.set(x, y, 'sandstone', delta);
    }
  }
  drawWingedSun(
    map,
    cx,
    Math.round((f.lintelTop + f.openTop) / 2) + 1,
    (f.outerR - f.outerL) / 2 - 6,
  );

  // Torus between lintel and cornice.
  for (let x = f.outerL - 1; x < f.outerR + 1; x++) {
    map.set(x, f.lintelTop - 2, 'sandstone', 1);
    map.set(x, f.lintelTop - 1, 'sandstone', x % 6 < 2 ? -2 : -1);
  }

  // Cavetto cornice: flared, painted with palm fronds, shaded as a concave curve.
  const corniceH = f.lintelTop - 2 - f.corniceTop;
  for (let r = 0; r < corniceH; r++) {
    const y = f.corniceTop + r;
    const t = r / Math.max(1, corniceH - 1);
    const flare = Math.round(5 * (1 - t) ** 2);
    for (let x = f.outerL - 1 - flare; x < f.outerR + 1 + flare; x++) {
      if (r < 3) {
        map.set(x, y, 'sandstone', r === 0 ? 2 : r === 1 ? 1 : -2);
        continue;
      }
      const rel = x - cx + 300;
      const k = Math.floor(rel / 6);
      const fx = rel - k * 6;
      const shadeDelta = t < 0.45 ? -2 : t < 0.7 ? -1 : 0;
      if (fx === 5) {
        map.set(x, y, 'sandstone', shadeDelta - 1);
      } else {
        const ramps: RampName[] = [
          'lapis',
          'sandstone',
          'turquoise',
          'sandstone',
        ];
        const ramp = ramps[k % 4];
        const tip = r < 5 && (fx === 0 || fx === 4);
        map.set(x, y, tip ? 'sandstone' : ramp, shadeDelta);
      }
    }
  }

  // Torch brackets (bronze cup, stem, wall plate) and their soot shadow.
  for (const torch of TORCHES) {
    const p = project(torch.x, torch.y, torch.z);
    const tx = Math.round(p.x);
    const ty = Math.round(p.y);
    for (let y = ty; y < ty + 4; y++) {
      const half = 5 - (y - ty);
      for (let x = tx - half; x <= tx + half; x++) {
        map.set(x, y, 'bronze', y === ty ? 2 : x < tx ? 0 : -1);
      }
    }
    for (let y = ty + 4; y < ty + 13; y++) {
      map.set(tx - 1, y, 'bronze', 0);
      map.set(tx, y, 'bronze', -1);
    }
    for (let y = ty + 12; y < ty + 20; y++) {
      for (let x = tx - 3; x <= tx + 3; x++) {
        const edge =
          x === tx - 3 || x === tx + 3 || y === ty + 12 || y === ty + 19;
        map.set(x, y, 'bronze', edge ? -2 : x === tx - 2 ? 1 : 0);
      }
    }
    map.set(tx, ty + 15, 'gold', 1);
  }
  return map;
}

/** Winged sun disc: gold disc, two uraei, three tiers of feathers per wing. */
function drawWingedSun(map: MaterialMap, cx: number, cy: number, span: number) {
  const discR = 6;
  // Wings first so the disc overlaps their roots.
  for (const side of [-1, 1] as const) {
    for (let d = discR - 1; d <= span; d++) {
      const x = cx + side * d;
      const t = d / span;
      const top =
        cy - 5 - Math.round(Math.sin(Math.PI * Math.min(1, t * 1.1)) * 2);
      const bottom = cy + 5 - Math.round(t * t * 7);
      if (bottom <= top + 1) continue;
      for (let y = top; y <= bottom; y++) {
        const row = y - top;
        let ramp: RampName;
        let delta = 0;
        if (row <= 1) {
          ramp = 'gold';
          delta = row === 0 ? 1 : 0;
        } else if (row <= 4) {
          ramp = 'lapis';
          if (d % 3 === 0) delta = -2;
        } else {
          ramp = Math.floor(d / 4) % 2 === 0 ? 'turquoise' : 'lapis';
          if (d % 4 === 0) delta = -2;
          if (y === bottom) delta = -1;
        }
        map.set(x, y, ramp, delta);
      }
      map.shift(x, top - 1, -2);
      map.shift(x, bottom + 1, -1);
    }
  }
  for (let y = -discR; y <= discR; y++) {
    for (let x = -discR; x <= discR; x++) {
      const d2 = x * x + y * y;
      if (d2 > discR * discR + 2) continue;
      const lit = x + y < -3;
      const dark = x + y > 4;
      map.set(cx + x, cy - 1 + y, 'gold', lit ? 2 : dark ? -1 : 1);
    }
  }
  // Uraei: small rearing cobras hanging from the disc.
  for (const side of [-1, 1] as const) {
    const ux = cx + side * (discR + 1);
    for (let y = 0; y < 7; y++)
      map.set(ux, cy - 2 + y, 'turquoise', y === 0 ? 1 : 0);
    map.set(ux + side, cy - 2, 'turquoise', 1);
    map.set(ux, cy + 5, 'gold', 0);
  }
}

// ---------------------------------------------------------------------------

export interface RoomArt {
  room: PixelCanvas;
}

const STAR_CELLS = 0.62;

function starAt(hit: Hit, sx: number, sy: number) {
  const s = scaleAt(hit.p.z);
  const kx = Math.round(hit.u / STAR_CELLS);
  const kz = Math.round(hit.v / STAR_CELLS);
  if (hash2(kx, kz, 991) > 0.62) return 0;
  const c = project(
    kx * STAR_CELLS + (hash2(kx, kz, 5) - 0.5) * 0.2,
    ROOM.ceilingY,
    kz * STAR_CELLS,
  );
  const ox = Math.round(sx - 0.5 - Math.round(c.x));
  const oy = Math.round(sy - 0.5 - Math.round(c.y));
  if (s > 24) {
    if (ox === 0 && oy === 0) return 2;
    if ((Math.abs(ox) === 1 && oy === 0) || (ox === 0 && Math.abs(oy) === 1))
      return 1;
    return 0;
  }
  return ox === 0 && oy === 0 ? 1 : 0;
}

export function renderRoom(): RoomArt {
  const W = ROOM_W;
  const H = ROOM_H;
  const room = new PixelCanvas(W, H);
  const hits: (Hit | null)[] = new Array(W * H);
  const ids = new Int32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hit = cast(x + 0.5, y + 0.5);
      hits[y * W + x] = hit;
      ids[y * W + x] = hit ? blockId(hit) : -1;
    }
  }
  const idAt = (x: number, y: number) =>
    x < 0 || y < 0 || x >= W || y >= H ? -2 : ids[y * W + x];

  const front = buildFrontMap();
  const decals = buildDecals();
  const frame = frameGeometry();

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const hit = hits[y * W + x];
      if (!hit) continue; // the slab hole stays transparent
      const { p, n } = hit;
      let light = lightAt(p, n);

      // Ambient occlusion along creases.
      let ao = 1;
      if (
        hit.surface === 'back' ||
        hit.surface === 'left' ||
        hit.surface === 'right'
      ) {
        ao *=
          crease(ROOM.floorY - p.y, 0.42, 0.45) *
          crease(p.y - ROOM.ceilingY, 0.35, 0.5);
        if (hit.surface !== 'back') ao *= crease(ROOM.backZ - p.z, 0.4, 0.5);
        else ao *= crease(ROOM.halfWidth - Math.abs(p.x), 0.4, 0.5);
        // Contact shadow around the door frame on the back wall.
        if (hit.surface === 'back') {
          const fx = Math.min(
            Math.abs(x - frame.outerL),
            Math.abs(x - frame.outerR),
          );
          if (y > frame.corniceTop && fx < 4) ao *= 0.86 + fx * 0.035;
        }
      } else if (hit.surface === 'floor') {
        ao *=
          crease(ROOM.halfWidth - Math.abs(p.x), 0.45, 0.45) *
          crease(ROOM.backZ - p.z, 0.45, 0.4);
      } else if (hit.surface === 'reveal') {
        ao *= 0.55;
      }
      light *= ao;
      // Foreground falls into shadow so the lit doorway holds the eye.
      const depth = Math.min(1, Math.max(0, (p.z - 5.5) / 6.5));
      light *= 0.5 + 0.5 * depth * depth * (3 - 2 * depth);
      let value = tone(light);

      // 1) Screen-space front map: frame, brackets.
      if (hit.surface === 'back' || hit.surface === 'reveal') {
        const fr = front.rampAt(x, y);
        if (fr !== NONE && hit.surface === 'back') {
          const ramp = RAMPS[fr];
          const c = front.shade(
            x,
            y,
            inlayValue(ramp, value * (ramp === 'sandstone' ? 1.05 : 1)),
          );
          if (c) room.put(x, y, c);
          continue;
        }
      }
      if (hit.surface === 'reveal') {
        const c = shadeStep(
          'sandstone',
          x,
          y,
          value * 0.9,
          hit.n.y > 0 ? -1 : 0,
        );
        room.put(x, y, c);
        continue;
      }

      // 2) Decals on side walls (stele, inscription columns).
      let decalHit = false;
      for (const d of decals) {
        if (d.surface !== hit.surface) continue;
        const s = sampleDecal(d, hit.u, hit.v);
        if (!s) continue;
        const ramp = RAMPS[s.r];
        const colors = PALETTE[ramp];
        const idx =
          quantize(x, y, inlayValue(ramp, value), colors.length) + s.delta;
        room.put(x, y, colors[Math.max(0, Math.min(colors.length - 1, idx))]);
        decalHit = true;
        break;
      }
      if (decalHit) continue;

      // 3) Masonry and painted surfaces.
      const id = ids[y * W + x];
      const jointRight = idAt(x + 1, y) !== id;
      const jointDown = idAt(x, y + 1) !== id;
      const edgeUp = idAt(x, y - 1) !== id;
      const edgeLeft = idAt(x - 1, y) !== id;
      const blockVar = hash2(id, 3, 77);
      let delta = blockVar < 0.16 ? -1 : blockVar > 0.86 ? 1 : 0;

      if (hit.surface === 'ceiling') {
        const star = starAt(hit, x + 0.5, y + 0.5);
        if (star > 0) {
          room.put(x, y, shadeStep('gold', x, y, 0.35 + value * 0.6, star - 1));
          continue;
        }
        const c = shadeStep(
          'ceiling',
          x,
          y,
          Math.min(1, value * 1.5),
          jointDown ? -1 : 0,
        );
        room.put(x, y, c);
        continue;
      }

      let ramp: RampName = 'limestone';
      let paint: { ramp: RampName; delta: number } | null = null;
      if (hit.surface !== 'floor') paint = paintedBand(hit.u, hit.v);
      if (hit.surface === 'floor') {
        value *= 0.93;
        // Wind-blown sand drifts along the wall feet and in corners.
        const wallGap = ROOM.halfWidth - Math.abs(p.x);
        const backGap = ROOM.backZ - p.z;
        const drift =
          0.42 +
          0.22 * Math.sin(p.z * 1.9 + p.x) +
          0.12 * Math.sin(p.z * 5.3) -
          wallGap;
        const backDrift =
          0.25 +
          0.1 * Math.sin(p.x * 2.7) -
          backGap -
          Math.max(0, 2.5 - wallGap) * 0.4;
        const doorClear = Math.abs(p.x) < DOOR.frameHalfWidth + 0.6;
        if (drift > 0 || (backDrift > 0 && !doorClear)) {
          const top = drift > 0 ? drift < 0.06 : backDrift < 0.05;
          room.put(x, y, shadeStep('sand', x, y, value * 1.05, top ? 1 : 0));
          continue;
        }
      }
      if (jointRight || jointDown) {
        const jr = paint ? paint.ramp : ramp;
        room.put(
          x,
          y,
          shadeStep(
            jr === 'limestone' ? 'limestone' : jr,
            x,
            y,
            value * 0.42,
            0,
          ),
        );
        continue;
      }
      if (edgeUp) delta += 1;
      else if (edgeLeft && hit.surface === 'back') delta += x < VIEW.vx ? 0 : 1;
      else if (edgeLeft) delta += hit.surface === 'left' ? 1 : 0;
      // Lower course edge: a soft shade line one pixel above the joint.
      if (idAt(x, y + 2) !== id && !jointDown && hit.surface !== 'floor')
        delta -= 1;
      // Sparse, structured wear: chips sit near block corners, never scattered.
      const cu = hash2(id, Math.floor(hit.u * 9), 13);
      if (cu > 0.985 && !edgeUp) delta -= 2;
      if (paint) {
        ramp = paint.ramp;
        delta = paint.delta + (edgeUp ? 1 : 0);
        value = inlayValue(ramp, value);
      }
      room.put(x, y, shadeStep(ramp, x, y, value, delta));
    }
  }
  // The inlaid groove from the stand to the door, dull until the seal wakes it.
  for (const c of computeChannel()) {
    room.put(c.x, c.y, c.core ? PALETTE.gold[2] : PALETTE.gold[1]);
  }
  return { room };
}

function shadeStep(
  ramp: RampName,
  x: number,
  y: number,
  value: number,
  delta: number,
): Rgb {
  const colors = PALETTE[ramp];
  const idx =
    quantize(x, y, Math.max(0, Math.min(1, value)), colors.length) + delta;
  return colors[Math.max(0, Math.min(colors.length - 1, idx))];
}

export { cast as castRoomRay, shadeStep };
