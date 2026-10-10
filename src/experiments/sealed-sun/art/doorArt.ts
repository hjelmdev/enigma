import {
  DOOR,
  DOOR_HOLE,
  DOOR_SLAB,
  ROOM,
  ROOM_H,
  ROOM_W,
  VIEW,
  type Vec3,
} from '../layout.ts';
import { carveGlyph } from './steleArt.ts';
import { lightAt, tone, type PointLight } from './lighting.ts';
import { Masonry } from './masonry.ts';
import { MaterialMap, RAMPS, inlayValue } from './materialMap.ts';
import { PALETTE, type RampName } from './palette.ts';
import { PixelCanvas, bayer, hash2, quantize } from './pixelCanvas.ts';

/**
 * Door layers, back to front:
 *   corridor  the ascending passage behind the slab, lit from above
 *   slab      the rose-granite slab that sinks into its floor slot
 *   slabGlow  the slab's gold inlay at full brightness (activation)
 * plus light data the scene animates: the sunlit spill on the room floor and
 * the dusty beam, both keyed to how far the slab has dropped.
 */

const SLOPE = 0.36; // rise per unit of depth
const RISE_START = 18.5;

/** The light at the top of the passage: warm daylight from an upper shaft. */
const SKY: PointLight = {
  pos: {
    x: 0,
    y: -3.05 - (DOOR.corridorEndZ - 1.5 - RISE_START) * SLOPE + 0.8,
    z: DOOR.corridorEndZ - 1.5,
  },
  intensity: 5.5,
  reach: 9,
};

function screenToSlab(sx: number, sy: number): Vec3 {
  const z = DOOR.slabZ;
  return {
    x: ((sx - VIEW.vx) * z) / VIEW.focal,
    y: ((sy - VIEW.vy) * z) / VIEW.focal,
    z,
  };
}

// ---------------------------------------------------------------------------
// Slab

export function slabSunCenter() {
  // In slab-local pixels.
  return {
    x: DOOR_HOLE.x - DOOR_SLAB.x + Math.floor(DOOR_HOLE.w / 2),
    y: DOOR_HOLE.y - DOOR_SLAB.y + 26,
  };
}

function buildSlabMap() {
  const w = DOOR_SLAB.w;
  const h = DOOR_SLAB.h;
  const map = new MaterialMap(w, h);
  const ox = DOOR_HOLE.x - DOOR_SLAB.x;
  const oy = DOOR_HOLE.y - DOOR_SLAB.y;
  const hw = DOOR_HOLE.w;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Granite: sparse 2×2 crystal clusters, not per-pixel noise.
      const c = hash2(x >> 1, y >> 1, 301);
      const d = c < 0.05 ? 2 : c > 0.955 ? -2 : c > 0.9 ? -1 : 0;
      map.set(x, y, 'granite', d);
    }
  }
  // Slab edges: a lit arris on top, dark seams on the sides.
  for (let x = 0; x < w; x++) {
    map.set(x, oy, 'granite', 2);
    map.set(x, oy + 1, 'granite', 1);
  }
  // Incised border.
  const inset = 5;
  for (let x = ox + inset; x < ox + hw - inset; x++) {
    map.shift(x, oy + inset, -2);
    map.shift(x, oy + inset + 1, 1);
    map.shift(x, h - 12, -2);
    map.shift(x, h - 11, 1);
  }
  for (let y = oy + inset; y < h - 11; y++) {
    map.shift(ox + inset, y, -2);
    map.shift(ox + inset + 1, y, 1);
    map.shift(ox + hw - inset - 1, y, -2);
    map.shift(ox + hw - inset, y, 1);
  }
  // Sun disc with Aten rays fanning downwards.
  const sun = slabSunCenter();
  const r = 9;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.18 + (0.64 * i) / 8);
    for (let t = r + 2; t < r + 30; t++) {
      const x = Math.round(sun.x + Math.cos(a) * t);
      const y = Math.round(sun.y + Math.sin(a) * t * 1.05);
      map.set(x, y, 'gold', -1);
    }
    const ex = Math.round(sun.x + Math.cos(a) * (r + 31));
    const ey = Math.round(sun.y + Math.sin(a) * (r + 31) * 1.05);
    map.set(ex, ey, 'gold', 0);
    map.set(ex + 1, ey, 'gold', -1);
  }
  for (let y = -r - 1; y <= r + 1; y++) {
    for (let x = -r - 1; x <= r + 1; x++) {
      const d2 = x * x + y * y;
      if (d2 <= r * r)
        map.set(
          sun.x + x,
          sun.y + y,
          'gold',
          x + y < -6 ? 1 : x + y > 6 ? -1 : 0,
        );
      else if (d2 <= (r + 1.5) ** 2)
        map.shift(sun.x + x, sun.y + y, x + y < 0 ? -2 : 1);
    }
  }
  // Cartouche below the rays.
  const cw = 21;
  const top = sun.y + 46;
  const bottom = Math.min(h - 16, top + 36);
  const cl = sun.x - Math.floor(cw / 2);
  for (let y = top; y <= bottom; y++) {
    const round = y - top < 3 || bottom - y < 3;
    const inset2 = round ? 3 - Math.min(y - top, bottom - y) : 0;
    map.shift(cl + inset2, y, -2);
    map.shift(cl + cw - 1 - inset2, y, 1);
  }
  for (let x = cl + 3; x < cl + cw - 3; x++) {
    map.shift(x, top, -2);
    map.shift(x, bottom, 1);
  }
  for (let x = cl - 2; x < cl + cw + 2; x++) {
    map.shift(x, bottom + 2, -2);
    map.shift(x, bottom + 3, 1);
  }
  const glyphs = ['ankh', 'djed'] as const;
  glyphs.forEach((g, i) =>
    carveGlyph(map, g, sun.x - 6, top + 4 + i * 15, 'gold'),
  );
  return map;
}

export function renderSlab() {
  const map = buildSlabMap();
  const slab = new PixelCanvas(map.width, map.height);
  const glow = new PixelCanvas(map.width, map.height);
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const p = screenToSlab(DOOR_SLAB.x + x + 0.5, DOOR_SLAB.y + y + 0.5);
      let value = tone(lightAt(p, { x: 0, y: 0, z: -1 }));
      // Polished granite: soft vertical sheens towards each torch.
      value += 0.07 * Math.exp(-((Math.abs(p.x) - 1.05) ** 2) / 0.06);
      // The recess shades the slab's top and edges.
      value *= 0.78 + 0.22 * Math.min(1, (p.y - DOOR.topY) / 1.4);
      const ramp = RAMPS[map.rampAt(x, y)];
      const c = map.shade(x, y, inlayValue(ramp, Math.min(1, value)));
      if (c) slab.put(x, y, c);
      if (ramp === 'gold') {
        const g = PALETTE.gold;
        glow.put(
          x,
          y,
          g[Math.min(g.length - 1, 5 + map.delta[y * map.width + x] + 1)],
        );
      }
    }
  }
  // Soft halo around the lit inlay.
  const halo = new PixelCanvas(glow.width, glow.height);
  for (let y = 0; y < glow.height; y++) {
    for (let x = 0; x < glow.width; x++) {
      if (glow.alphaAt(x, y)) continue;
      let near = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++)
          if (glow.alphaAt(x + dx, y + dy)) near++;
      }
      if (near > 0 && bayer(x, y) + near / 12 > 0.15)
        halo.put(x, y, PALETTE.gold[4], 150);
    }
  }
  halo.blit(glow, 0, 0);
  return { slab, slabGlow: halo };
}

// ---------------------------------------------------------------------------
// Corridor: an ascending passage, ray-cast analytically.

const CORRIDOR_MASONRY = new Masonry(113, -20, 6, 0.85, 1.05, 1.3, 2.4, 10, 60);

export function renderCorridor() {
  const w = DOOR_HOLE.w;
  const h = DOOR_HOLE.h;
  const out = new PixelCanvas(w, h);
  const lights: PointLight[] = [
    SKY,
    { pos: { x: 0, y: -1.5, z: 13.6 }, intensity: 0.5, reach: 3 },
  ];
  const ids = new Int32Array(w * h);
  const info: { p: Vec3; n: Vec3; kind: string; stepT: number }[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (DOOR_HOLE.x + x + 0.5 - VIEW.vx) / VIEW.focal;
      const dy = (DOOR_HOLE.y + y + 0.5 - VIEW.vy) / VIEW.focal;
      let z: number = DOOR.corridorEndZ;
      let kind = 'end';
      let n: Vec3 = { x: 0, y: 0, z: -1 };
      const hw = DOOR.halfWidth;
      if (dx < 0 && -hw / dx < z) {
        z = -hw / dx;
        kind = 'wallL';
        n = { x: 1, y: 0, z: 0 };
      }
      if (dx > 0 && hw / dx < z) {
        z = hw / dx;
        kind = 'wallR';
        n = { x: -1, y: 0, z: 0 };
      }
      // Floor: flat, then rising.
      let fz = dy > 0 ? ROOM.floorY / dy : Infinity;
      if (fz > RISE_START) {
        const k = dy + SLOPE;
        fz = k > 0 ? (ROOM.floorY + RISE_START * SLOPE) / k : Infinity;
        if (fz < RISE_START) fz = Infinity;
      }
      if (fz < z) {
        z = fz;
        kind = 'floor';
        n = { x: 0, y: -1, z: 0 };
      }
      let cz = dy < 0 ? DOOR.topY / dy : Infinity;
      if (!(cz <= RISE_START)) {
        const k = dy + SLOPE;
        cz = k > 0 ? (DOOR.topY + RISE_START * SLOPE) / k : Infinity;
        if (cz < RISE_START) cz = Infinity;
      }
      if (cz < z) {
        z = cz;
        kind = 'ceiling';
        n = { x: 0, y: 1, z: 0 };
      }
      const p = { x: dx * z, y: dy * z, z };
      let id = 0;
      let stepT = 0;
      if (kind === 'wallL' || kind === 'wallR') {
        id =
          (kind === 'wallL' ? 1 : 2) * 100000 +
          CORRIDOR_MASONRY.id(z, p.y + Math.max(0, z - RISE_START) * SLOPE);
      } else if (kind === 'floor') {
        const s = Math.floor(Math.max(0, z - RISE_START) / 0.55);
        stepT = (Math.max(0, z - RISE_START) / 0.55) % 1;
        id = 300000 + (z < RISE_START ? Math.floor(z / 1.3) : 1000 + s);
      } else if (kind === 'ceiling') {
        id = 400000 + Math.floor(z / 1.1);
      }
      ids[y * w + x] = id;
      info.push({ p, n, kind, stepT });
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const { p, n, kind, stepT } = info[i];
      if (kind === 'end') {
        // The top of the passage: overexposed daylight.
        const c = PALETTE.gold;
        out.put(x, y, c[quantize(x, y, 0.88, c.length)]);
        continue;
      }
      let light = lightAt(p, n, lights, 0.03);
      // Stair treads catch the light from above; risers face us and stay dim.
      let normalBoost = 1;
      if (kind === 'floor' && p.z > RISE_START)
        normalBoost = stepT < 0.42 ? 0.55 : 1.15;
      light *= normalBoost;
      // Depth haze: the far passage glows faintly warm.
      const haze = Math.max(0, (p.z - 20) / (DOOR.corridorEndZ - 20));
      let value =
        tone(light, 1.1) * (p.z < DOOR.wallBackZ ? 0.85 : 1) + haze * 0.18;
      value = Math.min(1, value);
      const id = ids[i];
      const joint =
        (x + 1 < w && ids[i + 1] !== id) || (y + 1 < h && ids[i + w] !== id);
      const edgeUp = y > 0 && ids[i - w] !== id;
      const ramp: RampName = p.z < DOOR.wallBackZ ? 'sandstone' : 'limestone';
      const colors = PALETTE[ramp];
      let idx = quantize(x, y, joint ? value * 0.45 : value, colors.length);
      if (!joint && edgeUp) idx += 1;
      out.put(x, y, colors[Math.max(0, Math.min(colors.length - 1, idx))]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Light that pours out once the slab drops.

export interface SpillPixel {
  x: number;
  y: number;
  /**
   * World y the slab's top must sink below before this pixel is lit (the
   * light ray crosses the door plane here).
   */
  threshold: number;
  strength: number;
}

/**
 * Sunlight from the top of the passage, through the doorway, onto the room
 * floor. Each pixel stores where its ray crosses the doorway, so the lit
 * patch grows correctly as the slab sinks.
 */
export function computeSpill(): SpillPixel[] {
  const out: SpillPixel[] = [];
  const L = SKY.pos;
  for (let sy = Math.floor(VIEW.vy) + 1; sy < ROOM_H; sy++) {
    for (let sx = 0; sx < ROOM_W; sx++) {
      const dy = (sy + 0.5 - VIEW.vy) / VIEW.focal;
      const dx = (sx + 0.5 - VIEW.vx) / VIEW.focal;
      const z = ROOM.floorY / dy;
      if (z > ROOM.backZ || z < 4) continue;
      const x = dx * z;
      if (Math.abs(x) > ROOM.halfWidth) continue;
      const s = (DOOR.slabZ - L.z) / (z - L.z);
      const X = L.x + s * (x - L.x);
      const Y = L.y + s * (ROOM.floorY - L.y);
      const edge = DOOR.halfWidth - Math.abs(X);
      if (edge < 0 || Y < DOOR.topY) continue;
      const fade =
        Math.min(1, edge / 0.25) * Math.min(1, (Y - DOOR.topY) / 0.3);
      const dist = ROOM.backZ - z;
      const strength = fade * (0.95 - dist * 0.07);
      if (strength <= 0.02) continue;
      out.push({ x: sx, y: sy, threshold: Y, strength });
    }
  }
  return out;
}

/** The dusty shaft of light through the doorway (screen-space, full open). */
export function renderBeam() {
  const canvas = new PixelCanvas(ROOM_W, ROOM_H);
  const L = SKY.pos;
  for (let sy = 0; sy < ROOM_H; sy++) {
    for (let sx = 0; sx < ROOM_W; sx++) {
      const dx = (sx + 0.5 - VIEW.vx) / VIEW.focal;
      const dy = (sy + 0.5 - VIEW.vy) / VIEW.focal;
      let density = 0;
      // March the eye ray through the room in front of the door.
      for (let z = 6; z < DOOR.slabZ; z += 0.25) {
        const x = dx * z;
        const y = dy * z;
        if (y > ROOM.floorY || Math.abs(x) > ROOM.halfWidth) break;
        const s = (DOOR.slabZ - L.z) / (z - L.z);
        const X = L.x + s * (x - L.x);
        const Y = L.y + s * (y - L.y);
        if (Math.abs(X) < DOOR.halfWidth && Y > DOOR.topY && Y < ROOM.floorY) {
          density += 0.25 * (0.4 + 0.6 * ((z - 6) / (DOOR.slabZ - 6)));
        }
      }
      if (density <= 0) continue;
      const v = Math.min(1, density / 3.2) + bayer(sx, sy) * 0.18;
      if (v < 0.12) continue;
      const level = v > 0.62 ? 5 : v > 0.36 ? 4 : 3;
      canvas.put(sx, sy, PALETTE.gold[level], Math.round(40 + v * 70));
    }
  }
  return canvas;
}
