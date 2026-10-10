// The entrance hall: a torchlit hypostyle hall seen from its threshold.
// One-point perspective toward the back wall; papyrus columns frame three
// bays: the relief door (left), the map niche with its shaft of daylight
// (centre) and the bronze balance with its door (right).
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
  carveHallGlyph,
  glow,
} from './common.mjs';
import { rampColor } from '../prologue-art/raster.mjs';
import { GLYPHS } from '../prologue-art/glyphs.mjs';

const L = HALL_LAYOUT.hall;
export const W = L.width;
export const H = L.height;
const [VX, VY] = L.vanish;
const TOP = L.wallTop;
const FLOOR = L.floorY;
const BL = L.backLeft;
const BR = L.backRight;
const FO = L.flameOffsets;

const flame = (list, key) =>
  list.map(([x, y]) => ({ x, y: y + FO[key][0], size: FO[key][1] }));
export const FLAMES = [
  ...flame(L.braziers, 'braziers'),
  ...flame(L.torches, 'torches'),
  ...flame(L.lampStands, 'lampStands'),
  ...flame(L.smallLamps, 'smallLamps'),
];

const shaftPool = { x: L.pedestal.x, y: L.pedestal.y - 4 };

/** Light field of the hall interior. */
export const light = makeLight(
  [
    ...L.braziers.map(([x, y]) => ({ x, y: y - 46, r: 105, i: 0.5 })),
    ...L.torches.map(([x, y]) => ({ x, y: y - 10, r: 70, i: 0.42 })),
    ...L.lampStands.map(([x, y]) => ({ x, y: y - 94, r: 84, i: 0.4 })),
    ...L.smallLamps.map(([x, y]) => ({ x, y: y - 8, r: 42, i: 0.3 })),
    { x: shaftPool.x, y: shaftPool.y, r: 40, i: 0.3, sy: 0.5 },
  ],
  0.1,
  (x, y) => {
    // Bounce light from the shaft on the niche and a cool fill high up.
    const s = Math.max(0, 1 - Math.abs(x - VX) / 170) * 0.05;
    const cool = y < 140 ? -0.03 : 0;
    return s * (y > 120 ? 1 : 0.4) + cool;
  },
);

/** Perspective helpers: scale factor of a depth plane by its floor line y. */
export function depthScale(baseY) {
  return (baseY - VY) / (FLOOR - VY);
}
export function project(backX, baseY) {
  return VX + (backX - VX) * depthScale(baseY);
}

// -- Ceiling -------------------------------------------------------------------

function paintCeiling(r) {
  const beams = L.columns.map((x) => VX + (x - VX) / depthScale(360));
  for (let y = 0; y < TOP + 2; y++) {
    const k = (VY - y) / (VY - TOP); // ≥1, grows toward the viewer
    for (let x = 0; x < W; x++) {
      const bx = VX + (x - VX) / k; // x on the back-wall plane
      const onBeam = beams.some((b) => Math.abs(bx - b) < 13);
      const edge = beams.some(
        (b) => Math.abs(Math.abs(bx - b) - 13) < 1.2 / k + 0.6,
      );
      const l = light(x, TOP + 30) * 0.55 + 0.04;
      if (onBeam) {
        let t = l * 0.8 + 0.12;
        if (edge) t -= 0.08;
        r.set(x, y, rampColor(STONE, t, x, y, 0.8));
        continue;
      }
      // Lapis panel with gold stars in perspective rows.
      const depth = 1 / k;
      const sx = bx / 24;
      const sy = depth * 14;
      const cellX = Math.floor(sx);
      const cellY = Math.floor(sy);
      const fx = sx - cellX - 0.5;
      const fy = sy - cellY - 0.5;
      const star =
        (cellX * 3 + cellY) % 4 === 0 &&
        Math.abs(fx) * 24 * k < 1.6 &&
        Math.abs(fy) * 24 * k < 1.6;
      const starArm =
        (cellX * 3 + cellY) % 4 === 0 &&
        ((Math.abs(fx) * 24 * k < 0.6 && Math.abs(fy) * 24 * k < 2.6) ||
          (Math.abs(fy) * 24 * k < 0.6 && Math.abs(fx) * 24 * k < 2.6));
      let c = litColor(
        PAL.lapis[2],
        0.35 + l * 0.9 + (fbm(x / 30, y / 10, 4, 2) - 0.5) * 0.12,
        x,
        y,
        5,
      );
      if (star || starArm) c = litColor(PAL.gold[4], 0.55 + l, x, y, 5);
      r.set(x, y, c);
    }
  }
  // Soot staining above the braziers and torches.
  for (const f of FLAMES)
    for (let y = 0; y < TOP + 4; y++)
      for (let x = f.x - 40; x < f.x + 40; x++) {
        const d = Math.abs(x - f.x) / 40;
        if (d < 1 && r.alpha(x, y))
          r.tint(x, y, '#0b0810', 0.25 * (1 - d) * (1 - y / (TOP + 4)));
      }
}

// -- Back wall -----------------------------------------------------------------

function khekher(r, x0, x1, y0, h) {
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x1; x++) {
      const cell = Math.floor((x - x0) / 9) % 3;
      const inCell = (x - x0) % 9;
      const v = (y - y0) / h;
      let col;
      if (v < 0.12 || v > 0.9) col = '#1a1220';
      else if (inCell > 1 && inCell < 7) {
        // Rounded top of each bundle.
        const round = v < 0.3 && (inCell === 2 || inCell === 6);
        col = round
          ? null
          : [PAL.lapis[3], PAL.ochreRed[3], PAL.turquoise[3]][cell];
        if (v > 0.55 && v < 0.65) col = PAL.gold[4];
      } else col = '#2a2030';
      if (col) r.set(x, y, litColor(col, light(x, y) * 1.05 + 0.08, x, y));
    }
}

function glyphRegister(r, x0, x1, y0) {
  // A painted band of the canonical signs, repeated as a litany.
  for (let y = y0; y < y0 + 22; y++)
    for (let x = x0; x < x1; x++) {
      const t = y === y0 || y === y0 + 21 ? '#1a1220' : '#d9c39a';
      r.set(x, y, litColor(t, light(x, y) + 0.12, x, y));
    }
  const names = ['sun', 'eye', 'steps', 'moon'];
  let i = 0;
  for (let x = x0 + 6; x + 16 < x1; x += 22, i++) {
    const rows = GLYPHS[names[i % 4]];
    for (let gy = 0; gy < 16; gy++)
      for (let gx = 0; gx < 16; gx++) {
        const c = rows[gy][gx];
        if (c === '.') continue;
        const px = x + gx;
        const py = y0 + 3 + gy;
        r.set(
          px,
          py,
          litColor(
            c === '*' ? PAL.gold[4] : PAL.lapis[3],
            light(px, py) + 0.1,
            px,
            py,
          ),
        );
      }
  }
}

function dado(r, x0, x1) {
  for (let y = FLOOR - 26; y < FLOOR; y++)
    for (let x = x0; x < x1; x++) {
      const v = y - (FLOOR - 26);
      let col = PAL.ochreRed[2];
      if (v < 2) col = '#1a1220';
      else if (v < 4) col = PAL.gold[3];
      else if (v > 22) col = '#1a1220';
      r.set(
        x,
        y,
        litColor(
          col,
          light(x, y) + 0.1 + (fbm(x / 12, y / 4, 5, 2) - 0.5) * 0.15,
          x,
          y,
        ),
      );
    }
}

function plasterLoss(r, seed, count, area) {
  const rand = rng(seed);
  for (let i = 0; i < count; i++) {
    const cx = area.x + rand() * area.w;
    const cy = area.y + rand() * area.h;
    const rx = 6 + rand() * 18;
    const ry = 3 + rand() * 8;
    for (let y = Math.floor(cy - ry); y < cy + ry; y++)
      for (let x = Math.floor(cx - rx); x < cx + rx; x++) {
        const d =
          ((x - cx) / rx) ** 2 +
          ((y - cy) / ry) ** 2 +
          (fbm(x / 4, y / 4, seed + i, 2) - 0.5) * 0.9;
        if (d > 1 || !r.alpha(x, y)) continue;
        r.tint(x, y, '#140f1c', d > 0.8 ? 0.2 : 0.07);
      }
  }
}

function crack(r, x, y, len, seed) {
  const rand = rng(seed);
  let cx = x;
  let cy = y;
  for (let i = 0; i < len; i++) {
    r.tint(Math.round(cx), Math.round(cy), '#0c0812', 0.65);
    r.tint(Math.round(cx) + 1, Math.round(cy), '#f0d0a0', 0.12);
    cy += 1;
    cx += (rand() - 0.5) * 1.6;
  }
}

/** Monumental doorway frame: jambs with glyph columns, cavetto cornice. */
function doorFrame(r, d, emblem) {
  const jw = 14;
  const x0 = d.x - jw;
  const x1 = d.x + d.width + jw;
  const top = d.y - 12;
  // Jambs and lintel block, slightly proud of the wall (lighter, with shadow).
  for (let y = top; y < FLOOR; y++)
    for (let x = x0; x < x1; x++) {
      if (x >= d.x && x < d.x + d.width && y >= d.y) continue;
      let t = light(x, y) + 0.08 + (fbm(x / 7, y / 9, 61, 2) - 0.5) * 0.05;
      if (x === x0 || y === top) t += 0.08;
      if (x === x1 - 1) t -= 0.12;
      // Inner reveal (depth of the doorway): dark on the side away from light.
      if (x >= d.x - 3 && x < d.x && y >= d.y) t -= 0.18;
      if (x >= d.x + d.width && x < d.x + d.width + 3 && y >= d.y) t -= 0.25;
      if (y >= d.y - 3 && y < d.y && x >= d.x - 3 && x < d.x + d.width + 3)
        t -= 0.2;
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  // Glyph columns on the jambs (eye / steps / sun, carved).
  for (const jx of [x0 + 3, d.x + d.width + 3]) {
    ['eye', 'steps', 'sun', 'eye', 'steps'].forEach((name, i) => {
      const gy = d.y + 6 + i * 23;
      if (gy + 16 > FLOOR - 4) return;
      const rows = GLYPHS[name];
      for (let yy = 0; yy < 16; yy++)
        for (let xx = 0; xx < 16; xx += 2) {
          const on = rows[yy][xx] !== '.' || rows[yy][xx + 1] !== '.';
          if (!on) continue;
          const px = jx + xx / 2;
          const py = gy + yy;
          r.tint(px, py, '#140f1c', 0.5);
          r.tint(px + 1, py, '#ffe0b0', 0.08);
        }
    });
  }
  // Torus moulding and cavetto cornice with painted leaves.
  const cTop = top - 30;
  for (let y = cTop; y < top; y++)
    for (let x = x0 - 8; x < x1 + 8; x++) {
      const v = (y - cTop) / 30;
      // Cavetto: flares outward at the top.
      const flare = Math.round((1 - v) ** 2 * 8);
      if (x < x0 - flare || x >= x1 + flare) continue;
      let col;
      if (v > 0.82)
        col = (((x - x0) % 6) + 6) % 6 < 3 ? PAL.lapis[3] : PAL.gold[3]; // torus binding
      else if (v < 0.1) col = '#d8c29a';
      else {
        const leaf = ((Math.floor((x - x0 + 2) / 6) % 3) + 3) % 3;
        const inLeaf = (((x - x0 + 2) % 6) + 6) % 6;
        col =
          inLeaf === 0
            ? '#1a1220'
            : [PAL.lapis[3], PAL.turquoise[3], PAL.ochreRed[3]][leaf];
      }
      const shade = 0.12 + (1 - v) * 0.1;
      r.set(x, y, litColor(col, light(x, y) + shade, x, y));
    }
  // Shadow under the cornice.
  for (let y = top; y < top + 3; y++)
    for (let x = x0; x < x1; x++)
      r.tint(x, y, '#0c0812', 0.4 - (y - top) * 0.12);
  // Winged sun on the lintel.
  const cx = d.x + d.width / 2;
  const cy = top + 6;
  for (let x = cx - 34; x <= cx + 34; x++) {
    const span = Math.abs(x - cx) / 34;
    if (span < 0.12) continue;
    for (let k = 0; k < 4 - Math.round(span * 2); k++) {
      const y = cy - 2 + k + Math.round(span * 2);
      const col =
        k === 0 ? PAL.lapis[3] : k === 1 ? PAL.turquoise[3] : PAL.gold[4];
      r.set(x, y, litColor(col, light(x, y) + 0.2, x, y));
    }
  }
  r.ellipse(cx, cy, 4, 4, (x, y) =>
    litColor(PAL.ochreRed[4], light(x, y) + 0.3, x, y),
  );
  void emblem;
}

/** The niche: stepped recess with a great carved pyramid map relief. */
function paintNiche(r) {
  const n = L.niche;
  const steps = 3;
  for (let s = 0; s < steps; s++) {
    const inset = s * 12;
    const x0 = n.x + inset;
    const x1 = n.x + n.width - inset;
    const y0 = n.y + inset;
    for (let y = y0; y < FLOOR; y++)
      for (let x = x0; x < x1; x++) {
        const nx = x - x0;
        const ny = y - y0;
        const border = nx < 12 || x1 - 1 - x < 12 || ny < 12;
        if (!border && s < steps - 1) continue;
        let t =
          light(x, y) * (0.8 - s * 0.18) +
          0.03 -
          s * 0.03 +
          Math.max(0, 1 - Math.hypot((x - VX) / 120, (y - 200) / 110)) * 0.22;
        if (border) {
          // Each step's inner face: lit on the side facing the shaft.
          if (nx < 2 || ny < 2) t += 0.06;
          if (nx >= 10 && nx < 12) t -= 0.1;
          if (x1 - 1 - x < 2) t -= 0.1;
        }
        t += (fbm(x / 8, y / 8, 70 + s, 2) - 0.5) * 0.05;
        r.set(x, y, rampColor(STONE, t, x, y, 0.85));
      }
  }
  // The great relief: pyramid outline with the maze of the underside map.
  const apex = [VX, n.y + 52];
  const baseY = FLOOR - 40;
  const half = 92;
  const inTri = (x, y) => {
    if (y < apex[1] || y > baseY) return false;
    const w = ((y - apex[1]) / (baseY - apex[1])) * half;
    return Math.abs(x - VX) <= w;
  };
  for (let y = apex[1]; y <= baseY; y++)
    for (let x = VX - half; x <= VX + half; x++) {
      if (!inTri(x, y)) continue;
      const edge =
        !inTri(x - 2, y) ||
        !inTri(x + 2, y) ||
        !inTri(x, y - 2) ||
        y > baseY - 2;
      if (edge) {
        r.tint(x, y, '#120c18', 0.55);
        if (!inTri(x + 3, y) && x > VX) r.tint(x, y, '#ffe0a8', 0.1);
      } else r.tint(x, y, '#2a2038', 0.1);
    }
  // Maze pattern (scaled underside map glyph) inside the triangle.
  const map = GLYPHS.map;
  const ms = 6;
  const mx = VX - 8 * ms;
  const my = baseY - 16 * ms - 6;
  for (let gy = 0; gy < 16; gy++)
    for (let gx = 0; gx < 16; gx++) {
      if (map[gy][gx] === '.') continue;
      for (let yy = 0; yy < ms; yy++)
        for (let xx = 0; xx < ms; xx++) {
          const x = mx + gx * ms + xx;
          const y = my + gy * ms + yy;
          if (!inTri(x, y)) continue;
          const groove = yy >= 2 && yy <= 3 && xx >= 2 && xx <= 3;
          const horiz =
            (gx + 1 < 16 &&
              map[gy][gx + 1] !== '.' &&
              yy >= 2 &&
              yy <= 3 &&
              xx >= 2) ||
            (gx > 0 &&
              map[gy][gx - 1] !== '.' &&
              yy >= 2 &&
              yy <= 3 &&
              xx <= 3);
          const vert =
            (gy + 1 < 16 &&
              map[gy + 1][gx] !== '.' &&
              xx >= 2 &&
              xx <= 3 &&
              yy >= 2) ||
            (gy > 0 &&
              map[gy - 1][gx] !== '.' &&
              xx >= 2 &&
              xx <= 3 &&
              yy <= 3);
          if (groove || horiz || vert) r.tint(x, y, '#120c18', 0.5);
        }
    }
  // Eye at the apex, carved, with a lapis pupil.
  const eye = GLYPHS.eye;
  const es = 2;
  const ex = VX - 8 * es;
  const ey = apex[1] + 14;
  for (let gy = 0; gy < 16; gy++)
    for (let gx = 0; gx < 16; gx++) {
      const c = eye[gy][gx];
      if (c === '.') continue;
      for (let yy = 0; yy < es; yy++)
        for (let xx = 0; xx < es; xx++) {
          const x = ex + gx * es + xx;
          const y = ey + gy * es + yy;
          if (c === '*')
            r.set(x, y, litColor(PAL.lapis[3], light(x, y) + 0.2, x, y));
          else r.tint(x, y, '#120c18', 0.55);
        }
    }
  // Three-step dais in front of the niche.
  for (let s = 0; s < 3; s++) {
    const y0 = FLOOR - (3 - s) * 6;
    const x0 = n.x + 20 - s * 10;
    const x1 = n.x + n.width - 20 + s * 10;
    for (let y = y0; y < y0 + 6; y++)
      for (let x = x0; x < x1; x++) {
        let t = light(x, y) + 0.1;
        if (y === y0) t += 0.12;
        if (y === y0 + 5) t -= 0.12;
        r.set(x, y, rampColor(STONE, t, x, y, 0.8));
      }
  }
}

export function nicheMapLines() {
  // Gold inlay lines that light up when the map awakens (additive layer).
  const r = new Raster(W, H);
  const n = L.niche;
  const apex = [VX, n.y + 52];
  const baseY = FLOOR - 40;
  const half = 92;
  const inTri = (x, y) => {
    if (y < apex[1] || y > baseY) return false;
    const w = ((y - apex[1]) / (baseY - apex[1])) * half;
    return Math.abs(x - VX) <= w;
  };
  for (let y = apex[1]; y <= baseY; y++)
    for (let x = VX - half; x <= VX + half; x++) {
      if (!inTri(x, y)) continue;
      const edge = !inTri(x - 2, y) || !inTri(x + 2, y) || y > baseY - 2;
      if (edge) r.set(x, y, '#ffd46e', 200);
    }
  const map = GLYPHS.map;
  const ms = 6;
  const mx = VX - 8 * ms;
  const my = baseY - 16 * ms - 6;
  for (let gy = 0; gy < 16; gy++)
    for (let gx = 0; gx < 16; gx++) {
      if (map[gy][gx] === '.') continue;
      for (let yy = 2; yy <= 3; yy++)
        for (let xx = -1; xx <= ms; xx++) {
          const right = gx + 1 < 16 && map[gy][gx + 1] !== '.';
          if (xx > 3 && !right) continue;
          if (xx < 2) continue;
          r.set(mx + gx * ms + xx, my + gy * ms + yy, '#ffcf6a', 170);
        }
      for (let xx = 2; xx <= 3; xx++)
        for (let yy = 2; yy <= ms + 1; yy++) {
          const down = gy + 1 < 16 && map[gy + 1][gx] !== '.';
          if (yy > 3 && !down) continue;
          r.set(mx + gx * ms + xx, my + gy * ms + yy, '#ffcf6a', 170);
        }
    }
  glow(r, VX, apex[1] + 30, 40, '#ffc860', 0.35);
  return r;
}

function paintRecessFrame(r) {
  // Recess for the sliding relief (tiles are drawn by the game on top).
  const p = L.reliefPanel;
  const size = p.tile * 3;
  const f = p.frame;
  for (let y = p.y - f; y < p.y + size + f; y++)
    for (let x = p.x - f; x < p.x + size + f; x++) {
      const inner = x >= p.x && x < p.x + size && y >= p.y && y < p.y + size;
      let t;
      if (inner) t = 0.04 + light(x, y) * 0.1;
      else {
        const d = Math.min(
          x - (p.x - f),
          y - (p.y - f),
          p.x + size + f - 1 - x,
          p.y + size + f - 1 - y,
        );
        t = light(x, y) + 0.12;
        if (d === 0) t -= 0.2;
        if (d === 1) t += 0.08;
        if (d >= f - 3) t -= 0.14;
        if (d === f - 4) {
          r.set(
            x,
            y,
            rampColor(PAL.bronze, 0.3 + light(x, y) * 0.7, x, y, 0.8),
          );
          continue;
        }
      }
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
}

function paintReference(r, picture) {
  const ref = L.reference;
  // Plaster panel, then the painting, then wear.
  for (let y = ref.y - 4; y < ref.y + ref.height + 4; y++)
    for (let x = ref.x - 4; x < ref.x + ref.width + 4; x++) {
      const d = Math.min(
        x - (ref.x - 4),
        y - (ref.y - 4),
        ref.x + ref.width + 3 - x,
        ref.y + ref.height + 3 - y,
      );
      r.set(
        x,
        y,
        litColor(d === 0 ? '#1a1220' : '#c9b48e', light(x, y) + 0.2, x, y),
      );
    }
  for (let y = 0; y < picture.height; y++)
    for (let x = 0; x < picture.width; x++) {
      const c = picture.get(x, y);
      const px = ref.x + x;
      const py = ref.y + y;
      const l = Math.min(1.15, light(px, py) + 0.55);
      r.set(px, py, litColor(c, l, px, py, 7));
    }
  // Flaking at the edges only, so the picture stays legible.
  const rand = rng(14);
  for (let i = 0; i < 9; i++) {
    const side = Math.floor(rand() * 4);
    const along = rand();
    const cx =
      side % 2 === 0
        ? ref.x + along * ref.width
        : side === 1
          ? ref.x + ref.width
          : ref.x;
    const cy =
      side % 2 === 1
        ? ref.y + along * ref.height
        : side === 0
          ? ref.y
          : ref.y + ref.height;
    const rr = 2 + rand() * 3;
    for (let y = Math.floor(cy - rr); y < cy + rr; y++)
      for (let x = Math.floor(cx - rr); x < cx + rr; x++)
        if (Math.hypot(x - cx, y - cy) < rr)
          r.set(x, y, rampColor(STONE, light(x, y) - 0.05, x, y, 0.8));
  }
}

function paintBalance(r) {
  const b = L.balance;
  const cx = b.x;
  const BW = 54; // half beam
  const CH = 40; // chain length
  const PW = 17; // half pan
  // Dais: two broad steps.
  for (let s = 0; s < 2; s++) {
    const y0 = FLOOR - 8 + s * 7;
    for (let y = y0; y < y0 + 8; y++)
      for (let x = cx - 84 - s * 8; x < cx + 84 + s * 8; x++) {
        let t = light(x, y) + 0.06;
        if (y === y0) t += 0.12;
        if (y === y0 + 7) t -= 0.15;
        r.set(x, y, rampColor(STONE, t, x, y, 0.8));
      }
  }
  const base = FLOOR - 8;
  const bronze = (x, y, t = 0) =>
    rampColor(PAL.bronze, 0.22 + light(x, y) * 0.7 + t, x, y, 0.8);
  // Weight shelf: a low stone bench at the left of the dais.
  for (let y = base - 14; y < base; y++)
    for (let x = cx - 80; x < cx - 36; x++) {
      let t = light(x, y) + 0.08;
      if (y === base - 14) t += 0.14;
      if (x === cx - 37) t -= 0.12;
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  for (let i = 0; i < 6; i++)
    r.ellipse(cx - 74 + i * 7, base - 17, 3, 3, (x, y, d) =>
      bronze(x, y, 0.2 - d * 0.35),
    );
  // Post: square bronze shaft on a stepped foot, falcon finial.
  for (let y = b.beamY - 6; y < base; y++)
    for (let x = cx - 4; x <= cx + 4; x++) {
      const u = (x - cx) / 4;
      r.set(x, y, bronze(x, y, u < -0.5 ? -0.2 : u > 0.5 ? 0.12 : 0.02));
    }
  for (let k = 0; k < 2; k++)
    for (let y = base - 6 + k * 3; y < base - 3 + k * 3; y++)
      for (let x = cx - 10 - k * 4; x <= cx + 10 + k * 4; x++)
        r.set(x, y, bronze(x, y, y === base - 6 + k * 3 ? 0.2 : -0.05));
  carveHallGlyph(r, 'falcon', cx - 16, b.beamY - 36, 2, {
    fill: (x, y) =>
      bronze(cx - 16 + x, b.beamY - 36 + y, 0.08 + (x > 16 ? 0.08 : -0.05)),
  });
  // Beam (level, locked by a pin).
  for (let x = cx - BW; x <= cx + BW; x++)
    for (let y = b.beamY - 3; y <= b.beamY + 2; y++) {
      const edge = Math.abs(x - cx) > BW - 3;
      r.set(
        x,
        y,
        bronze(
          x,
          y,
          y === b.beamY - 3 ? 0.25 : y === b.beamY + 2 ? -0.2 : edge ? 0.1 : 0,
        ),
      );
    }
  r.ellipse(cx, b.beamY, 4, 4, (x, y, d) =>
    d < 0.35 ? hex('#1a1210') : bronze(x, y, 0.25),
  );
  // Chains and pans.
  for (const side of [-1, 1]) {
    const px = cx + side * (BW - 4);
    for (let y = b.beamY + 3; y < b.beamY + CH; y++)
      for (const dx of [-PW + 3, PW - 3]) {
        const t = (y - b.beamY) / CH;
        const x = Math.round(px + dx * t);
        r.set(x, y, bronze(x, y, (y % 2) * 0.12 - 0.08));
      }
    for (let y = b.beamY + CH; y < b.beamY + CH + 7; y++) {
      const w = PW - (y - b.beamY - CH) * 1.7;
      for (let x = Math.round(px - w); x <= px + w; x++)
        r.set(
          x,
          y,
          bronze(x, y, y === b.beamY + CH ? 0.3 : -0.06 + (x - px) / 60),
        );
    }
  }
  // Sealed vessel on the left pan.
  const vx = cx - (BW - 4) - 16;
  const vy = b.beamY + CH - 29;
  carveHallGlyph(r, 'vessel', vx, vy, 2, {
    fill: (x, y) =>
      litColor(
        x > 16 ? '#cdb895' : '#a8957c',
        light(vx + x, vy + y) + 0.25,
        vx + x,
        vy + y,
      ),
  });
  // Lever: a long bronze handle with a lapis knob beside the dais.
  const lx = cx + 76;
  for (let i = 0; i < 58; i++) {
    const x = Math.round(lx + i * 0.16);
    const y = base - 2 - i;
    r.set(x, y, bronze(x, y, 0.08));
    r.set(x + 1, y, bronze(x + 1, y, -0.12));
  }
  r.ellipse(lx, base - 2, 5, 3, (x, y) => bronze(x, y, -0.05));
  r.ellipse(lx + 10, base - 63, 4, 4, (x, y, d) =>
    d < 0.6
      ? litColor(PAL.lapis[3], light(x, y) + 0.3, x, y)
      : bronze(x, y, 0.2),
  );
  // Carved relations above (tiny balances: readable only in the close-up).
  for (let i = 0; i < 3; i++) {
    const ox = cx - 54 + i * 38;
    const oy = 168;
    for (let x = ox; x < ox + 30; x++) r.tint(x, oy, '#140f1c', 0.5);
    for (let y = oy; y < oy + 12; y++) r.tint(ox + 15, y, '#140f1c', 0.5);
    for (let k = 0; k < 3; k++) {
      r.tint(ox + 2 + k * 4, oy + 3, '#140f1c', 0.45);
      r.tint(ox + 20 + k * 4, oy + 3, '#140f1c', 0.45);
    }
  }
}

function paintBrazier(r, x, base) {
  const bronze = (xx, yy, t = 0) =>
    rampColor(PAL.bronze, 0.2 + light(xx, yy) * 0.7 + t, xx, yy, 0.8);
  // Tripod legs.
  for (let i = 0; i < 40; i++) {
    const y = base - i;
    const spread = 9 - i * 0.12;
    r.set(Math.round(x - spread), y, bronze(x - spread, y, -0.1));
    r.set(Math.round(x + spread), y, bronze(x + spread, y, 0.1));
    r.set(x, y, bronze(x, y, -0.2));
  }
  // Bowl.
  for (let y = base - 50; y < base - 38; y++) {
    const v = (y - (base - 50)) / 12;
    const w = 16 - v * v * 10;
    for (let xx = Math.round(x - w); xx <= x + w; xx++) {
      const s = (xx - x) / w;
      r.set(xx, y, bronze(xx, y, 0.2 * s - (y === base - 50 ? -0.25 : 0)));
    }
  }
  // Embers in the bowl.
  for (let xx = x - 13; xx <= x + 13; xx++)
    r.set(xx, base - 50, (xx * 7) % 3 ? '#ffb24a' : '#ff7a2e');
}

function paintTorch(r, x, y) {
  // Bronze sconce with a bound torch.
  const bronze = (xx, yy, t = 0) =>
    rampColor(PAL.bronze, 0.25 + light(xx, yy) * 0.6 + t, xx, yy, 0.8);
  for (let yy = y; yy < y + 10; yy++) r.set(x, yy, bronze(x, yy));
  for (let xx = x - 3; xx <= x + 3; xx++)
    r.set(xx, y + 9, bronze(xx, y + 9, 0.15));
  for (let yy = y - 10; yy < y + 2; yy++) {
    r.set(x - 1, yy, '#3a2416');
    r.set(x, yy, '#5a3a20');
    r.set(x + 1, yy, yy % 3 === 0 ? '#2a1a10' : '#4a2e18');
  }
}

function paintLampStand(r, x, base) {
  const bronze = (xx, yy, t = 0) =>
    rampColor(PAL.bronze, 0.25 + light(xx, yy) * 0.6 + t, xx, yy, 0.8);
  for (let yy = base - 92; yy < base; yy++) {
    r.set(x - 1, yy, bronze(x - 1, yy, -0.15));
    r.set(x, yy, bronze(x, yy, 0.1));
  }
  // Papyrus-umbel bowl.
  for (let yy = base - 100; yy < base - 92; yy++) {
    const w = 2 + (base - 92 - yy) * 0.9;
    for (let xx = Math.round(x - w); xx <= x + w; xx++)
      r.set(xx, yy, bronze(xx, yy, (xx - x) / 12));
  }
  // Foot.
  for (let yy = base - 4; yy < base; yy++)
    for (let xx = x - 8; xx <= x + 8; xx++)
      r.set(xx, yy, bronze(xx, yy, yy === base - 4 ? 0.2 : -0.1));
}

function paintSmallLamp(r, x, base) {
  // Low offering stand with an oil lamp.
  for (let yy = base - 2; yy < FLOOR; yy++)
    for (let xx = x - 10; xx <= x + 10; xx++) {
      let t = light(xx, yy) + 0.12;
      if (yy === base - 2) t += 0.12;
      r.set(xx, yy, rampColor(STONE, t, xx, yy, 0.8));
    }
  r.ellipse(x, base - 4, 5, 2.5, (xx, yy) =>
    rampColor(PAL.ochreRed, 0.4 + light(xx, yy) * 0.5, xx, yy, 0.8),
  );
}

function paintPedestal(r) {
  const p = L.pedestal;
  const bronze = (xx, yy, t = 0) =>
    rampColor(PAL.bronze, 0.25 + light(xx, yy) * 0.65 + t, xx, yy, 0.8);
  // Drum.
  for (let y = p.y - 34; y < p.y; y++)
    for (let x = p.x - 32; x <= p.x + 32; x++) {
      const s = (x - p.x) / 32;
      let t = light(x, y) + 0.1 - Math.abs(s) * 0.15;
      if (y < p.y - 30) t += 0.12;
      if ((y - (p.y - 34)) % 11 === 0) t -= 0.1;
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  // Bronze basin top with pyramid socket.
  r.ellipse(p.x, p.y - 36, 36, 7, (x, y, d) =>
    bronze(x, y, d < 0.5 ? -0.25 : 0.15 - d * 0.1),
  );
  r.fillPolygon(
    [
      [p.x - 8, p.y - 36],
      [p.x, p.y - 40],
      [p.x + 8, p.y - 36],
      [p.x, p.y - 33],
    ],
    () => hex('#140c08'),
  );
  // Carved eye on the drum.
  const eye = GLYPHS.eye;
  for (let gy = 0; gy < 16; gy++)
    for (let gx = 0; gx < 16; gx++)
      if (eye[gy][gx] !== '.')
        r.tint(p.x - 8 + gx, p.y - 24 + gy * 0.9, '#140f1c', 0.5);
}

function paintColumn(r, cx, base) {
  const s = depthScale(base);
  const w = Math.round(22 * s);
  for (let y = 0; y < base; y++)
    for (let x = cx - w; x <= cx + w; x++) {
      const u = (x - cx) / w; // -1..1 across the cylinder
      const lightL = light(cx - w * 1.6, y);
      const lightR = light(cx + w * 1.6, y);
      const facing = ((1 - u) / 2) * lightL + ((1 + u) / 2) * lightR;
      const rim = Math.sqrt(Math.max(0, 1 - u * u));
      // Papyrus-bundle ribs.
      const rib =
        Math.abs(Math.sin((Math.asin(u) / Math.PI) * 8 * Math.PI)) < 0.25
          ? -0.06
          : 0;
      let t =
        -0.04 +
        facing * (0.25 + rim * 0.85) +
        rib +
        (fbm(x / 6, y / 14, cx, 2) - 0.5) * 0.05;
      if (Math.abs(u) > 0.93) t -= 0.12;
      if (Math.abs(u - 0.35) < 0.08 && facing > 0.25) t += 0.06;
      let col = null;
      // Painted bands at the neck and a cartouche band at eye height.
      if (y > 14 && y < 40) {
        const band = Math.floor((y - 14) / 5);
        col = [
          PAL.lapis[3],
          PAL.gold[4],
          PAL.ochreRed[3],
          PAL.gold[4],
          PAL.turquoise[3],
        ][band % 5];
      }
      if (col) r.set(x, y, litColor(col, t + 0.25, x, y));
      else r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  // Base drum.
  for (let y = base - 8; y < base + 2; y++)
    for (let x = cx - w - 6; x <= cx + w + 6; x++) {
      const u = (x - cx) / (w + 6);
      let t = 0.1 + light(x, y) * (0.6 + (1 - Math.abs(u)) * 0.4);
      if (y === base - 8) t += 0.15;
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  // Shadow cast on the floor away from the brightest nearby light.
  const dir = cx < VX ? -1 : 1;
  for (let y = base + 2; y < Math.min(H, base + 40); y++)
    for (let x = cx - w; x <= cx + w + 40; x++) {
      const dy = y - base - 2;
      const sx = cx + dir * dy * 1.3;
      if (Math.abs(x - sx) < w - dy * 0.3)
        r.tint(x, y, '#0a0812', 0.35 - dy * 0.007);
    }
}

function paintFloor(r) {
  for (let y = FLOOR; y < H; y++) {
    const k = (y - VY) / (FLOOR - VY);
    for (let x = 0; x < W; x++) {
      const bx = VX + (x - VX) / k; // back-plane x of this floor point
      const depth = 1 / k;
      const flag = Math.floor(bx / 58);
      const row = Math.floor(depth * 9 + 0.0);
      const fx = bx / 58 - flag;
      const fy = depth * 9 - row;
      let t = light(x, y) * 0.8 + 0.04;
      t += ((flag * 7 + row * 13) % 5) * 0.012;
      if (fx < 0.03 * k || fy > 1 - 0.05 * k) t -= 0.12;
      t += (fbm(bx / 20, depth * 30, 9, 2) - 0.5) * 0.06;
      r.set(x, y, rampColor(STONE, t, x, y, 0.85));
    }
  }
  // Polished-stone reflections under the flames.
  for (const f of FLAMES) {
    for (let y = FLOOR + 2; y < H; y++)
      for (let x = f.x - 5; x <= f.x + 5; x++) {
        const fall = 1 - (y - FLOOR) / (H - FLOOR);
        const a = (1 - Math.abs(x - f.x) / 6) * fall * 0.25 * (f.size / 6);
        if (a > bayer(x, y) * 0.5) r.tint(x, y, '#ffb050', a);
      }
  }
  // Wind-blown sand along the wall base and in the corners.
  for (let x = 0; x < W; x++) {
    const h =
      Math.max(0, fbm(x / 50, 3, 12, 3) - 0.45) * 22 +
      (x < 200 || x > 1400 ? 6 : 0);
    for (let y = FLOOR; y < FLOOR + h; y++) {
      const t = 0.35 + light(x, y) * 0.6 - (y - FLOOR) / 60;
      r.set(
        x,
        y,
        rampColor(
          ['#4a3b3a', '#6b5444', '#8f7050', '#b38e62', '#d2ac78'],
          t,
          x,
          y,
          0.9,
        ),
      );
    }
  }
}

function paintSideWalls(r) {
  for (const side of [-1, 1]) {
    const edge = side < 0 ? BL : BR;
    for (let x = side < 0 ? 0 : BR; side < 0 ? x < BL : x < W; x++) {
      const k = Math.abs(x - VX) / Math.abs(edge - VX);
      const yt = VY - (VY - TOP) * k;
      const yb = VY + (FLOOR - VY) * k;
      for (let y = Math.floor(yt); y < Math.ceil(yb); y++) {
        let t =
          light(x, y) * 0.6 + 0.02 + (fbm(x / 5, y / 18, 40, 2) - 0.5) * 0.05;
        if (Math.abs(x - edge) < 2) t -= 0.08;
        r.set(x, y, rampColor(STONE, t, x, y, 0.8));
      }
    }
  }
}

/** Static base layer with transparent holes for both doorways. */
export function paintHallBack(reference) {
  const r = new Raster(W, H);
  paintCeiling(r);
  paintSideWalls(r);
  paintAshlar(r, BL, TOP, BR - BL, FLOOR - TOP, light, 101, {
    courseH: 24,
    blockW: 56,
  });
  khekher(r, BL, BR, TOP, 18);
  glyphRegister(r, BL, BR, TOP + 24);
  dado(r, BL, BR);
  plasterLoss(r, 3, 9, { x: BL, y: TOP + 50, w: BR - BL, h: FLOOR - TOP - 80 });
  crack(r, 520, 132, 70, 2);
  crack(r, 1342, 120, 90, 3);
  crack(r, 980, 150, 40, 4);
  paintFloor(r);
  for (const [id, d] of Object.entries(L.doors)) doorFrame(r, d, id);
  paintNiche(r);
  paintRecessFrame(r);
  paintReference(r, reference);
  paintBalance(r);
  for (const [x, y] of L.torches) paintTorch(r, x, y);
  for (const [x, y] of L.lampStands) paintLampStand(r, x, y);
  for (const [x, y] of L.smallLamps) paintSmallLamp(r, x, y);
  paintPedestal(r);
  for (const [x, y] of L.braziers) paintBrazier(r, x, y);
  for (const x of L.columns) paintColumn(r, x, 360);
  // Door openings are transparent: the dark passage and slab layers sit
  // behind this one, so the wall itself occludes a moving slab.
  for (const d of Object.values(L.doors))
    for (let y = d.y; y < FLOOR; y++)
      for (let x = d.x; x < d.x + d.width; x++) r.clear(x, y);
  return r;
}

/** Sealed slab for a doorway, painted to fit its opening exactly. */
export function paintSlab(id) {
  const d = L.doors[id];
  // Taller than the opening so it can travel without exposing an edge.
  const r = new Raster(d.width, d.height);
  const cx = d.x + d.width / 2;
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const wx = d.x + x;
      const wy = d.y + y;
      let t =
        light(wx, wy) * 0.85 +
        0.06 +
        (fbm(x / 8, y / 10, id.length * 7, 2) - 0.5) * 0.06;
      if (x === 0 || y === 0) t += 0.06;
      if (x === d.width - 1) t -= 0.12;
      // Two vertical seams suggest a huge monolith with dressed edges.
      if (x === 3 || x === d.width - 4) t -= 0.05;
      r.set(x, y, rampColor(STONE, t, x, y, 0.85));
    }
  // Emblem: the relief door bears the kneeling-offering sign (pyramid with
  // eye); the balance door bears a scale.
  const ex = d.width / 2;
  if (d.motion === 'sink') {
    const apexY = 30;
    for (let y = apexY; y < apexY + 34; y++) {
      const w = (y - apexY) * 0.75;
      for (let x = Math.round(ex - w); x <= ex + w; x++) {
        const edge = Math.abs(Math.abs(x - ex) - w) < 1.2 || y === apexY + 33;
        if (edge) r.tint(x, y, '#120c18', 0.6);
        else if ((y - apexY) % 6 === 0) r.tint(x, y, '#120c18', 0.25);
      }
    }
    r.ellipse(ex, apexY + 14, 4, 2, (x, y, dd) =>
      dd < 0.4 ? hex('#22407c') : null,
    );
  } else {
    const by = 34;
    for (let x = ex - 18; x <= ex + 18; x++) r.tint(x, by, '#120c18', 0.6);
    for (let y = by - 6; y < by + 34; y++) r.tint(ex, y, '#120c18', 0.6);
    for (const s of [-1, 1]) {
      for (let y = by; y < by + 12; y++) r.tint(ex + s * 16, y, '#120c18', 0.4);
      for (let x = ex + s * 16 - 6; x <= ex + s * 16 + 6; x++)
        r.tint(x, by + 12, '#120c18', 0.6);
    }
    for (let x = ex - 8; x <= ex + 8; x++) r.tint(x, by + 34, '#120c18', 0.6);
  }
  void cx;
  return r;
}

/**
 * What lies behind a doorway: a short stair receding into darkness, down
 * (teal, relief door) or up (red-amber, balance door). Ray-cast so the walls,
 * steps and lintels converge properly inside the opening.
 */
export function paintPassage(id) {
  const d = L.doors[id];
  const r = new Raster(d.width, d.height);
  const down = d.motion === 'sink';
  const vx = d.width / 2;
  const vy = d.height * 0.42;
  const f = 40;
  const tint = down ? PAL.turquoise : PAL.ochreRed;
  const far = 7;
  for (let y = 0; y < d.height; y++)
    for (let x = 0; x < d.width; x++) {
      const dx = (x + 0.5 - vx) / f;
      const dy = (y + 0.5 - vy) / f;
      let z = far;
      let kind = 'end';
      const zw = dx !== 0 ? 0.8 / Math.abs(dx) : Infinity;
      if (zw < z) {
        z = zw;
        kind = 'wall';
      }
      if (dy < 0) {
        const zc = 1.1 / -dy;
        if (zc < z) {
          z = zc;
          kind = 'ceil';
        }
      }
      // Stepped floor: each step 0.5 deep, dropping (or rising) 0.18.
      let zf = Infinity;
      let stepEdge = false;
      for (let k = 0; k < 14; k++) {
        const h = 1.55 + (down ? 1 : -1) * k * 0.18;
        if (dy <= 0) break;
        const zz = h / dy;
        if (zz >= k * 0.5 && zz < (k + 1) * 0.5) {
          zf = zz;
          stepEdge = zz - k * 0.5 < 0.06;
          break;
        }
        // Riser face of the next step (vertical) for stairs going up.
        if (!down) {
          const zr = (k + 1) * 0.5;
          const yr = dy * zr;
          if (yr > h - 0.18 && yr <= h) {
            zf = zr;
            stepEdge = true;
            break;
          }
        }
      }
      if (zf < z) {
        z = zf;
        kind = 'floor';
      }
      const fade = Math.exp(-z / 2);
      let t = 0.04 + fade * 0.42;
      if (kind === 'wall')
        t += (Math.floor(z * 2 + (dy * z + 3) * 3) % 2) * 0.03 - 0.02;
      if (kind === 'ceil') t -= 0.04;
      if (kind === 'floor' && stepEdge) t += 0.1;
      let c = rampColor(STONE, t, x, y, 0.85);
      // Cold or warm air colours the depths.
      const deep = Math.min(1, z / far);
      c = mix(c, hex(tint[1]), deep * 0.45);
      if (kind === 'end')
        c = mix(
          hex('#07060c'),
          hex(tint[2]),
          0.25 + Math.max(0, 1 - Math.hypot(dx * 6, dy * 4)) * 0.5,
        );
      r.set(x, y, c);
    }
  glow(r, vx, vy + (down ? 10 : 0), 12, tint[3], 0.16);
  return r;
}

/** Additive light: flames' halos, the daylight shaft and its floor pool. */
export function paintHallGlow() {
  const r = new Raster(W, H);
  for (const f of FLAMES) {
    glow(r, f.x, f.y, f.size * 8, '#ff9a48', 0.28);
    glow(r, f.x, f.y, f.size * 3.5, '#ffd27a', 0.6);
  }
  const s = L.shaft;
  const [tx, ty] = s.top;
  const by = L.pedestal.y - 4;
  for (let y = ty; y < by; y++) {
    const v = (y - ty) / (by - ty);
    const half = (s.topWidth + (s.bottomWidth - s.topWidth) * v) / 2;
    for (let x = Math.round(tx - half); x <= tx + half; x++) {
      const u = Math.abs(x - tx) / half;
      const a = (1 - u * u) * (0.08 + v * 0.07);
      const q = Math.floor(a * 10 + bayer(x, y) * 0.9) / 10;
      if (q > 0) r.set(x, y, '#ffe9b8', Math.round(q * 255));
    }
  }
  glow(r, L.pedestal.x, by, 56, '#ffe2a0', 0.16, 0.35);
  return r;
}

/** Glow around the pedestal when the miniature resonates (additive). */
export function paintPedestalLit() {
  const r = new Raster(W, H);
  const p = L.pedestal;
  glow(r, p.x, p.y - 37, 46, '#ffcf6a', 0.55, 0.6);
  glow(r, p.x, p.y - 37, 12, '#fff2c0', 0.9, 0.7);
  return r;
}

/** Near foreground: architrave silhouette and rubble, wider for parallax. */
export const FRONT_PAD = 140;
export function paintHallFront() {
  const r = new Raster(W + FRONT_PAD * 2, H);
  const rand = rng(88);
  // Architrave across the top.
  for (let x = 0; x < r.width; x++) {
    const h = 20 + Math.round(fbm(x / 60, 1, 5, 2) * 3);
    for (let y = 0; y < h; y++) {
      let t = 0.04 + (y / h) * 0.08;
      if (y === h - 1) t += 0.18; // warm underside edge
      r.set(x, y, rampColor(STONE, t, x, y, 0.8));
    }
  }
  // Rubble blocks along the bottom corners.
  for (let i = 0; i < 9; i++) {
    const left = i < 5;
    const x = left
      ? FRONT_PAD + 10 + rand() * 210
      : FRONT_PAD + W - 230 + rand() * 210;
    const w = 14 + rand() * 30;
    const h = 8 + rand() * 16;
    const y = H - h + rand() * 6;
    r.fillPolygon(
      [
        [x, y + h],
        [x + 3, y + 2],
        [x + w * 0.6, y],
        [x + w, y + 4],
        [x + w + 2, y + h],
      ],
      (xx, yy) => {
        const t =
          0.06 +
          light(xx - FRONT_PAD, yy) * 0.35 +
          (yy - y < 2 ? 0.08 : 0) +
          (fbm(xx / 5, yy / 5, i, 2) - 0.5) * 0.06;
        return rampColor(STONE, t, xx, yy, 0.8);
      },
    );
  }
  void noise;
  return r;
}
