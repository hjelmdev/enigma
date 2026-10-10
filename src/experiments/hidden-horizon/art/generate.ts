import { TARGET } from '../model';
import { Raster, hash, type Point } from './raster';
import type { Material } from './palette';

export const ROOM = { width: 800, height: 450 };
export const GATE = { x: 486, y: 116, width: 128, height: 218 };
export const OBJECTS = {
  relief: { x: 316, y: 180, width: 128, height: 116 },
  mechanism: { x: 422, y: 318, width: 84, height: 93 },
  gate: { x: 550, y: 225, width: 145, height: 240 },
};

function block(
  r: Raster,
  x: number,
  y: number,
  w: number,
  h: number,
  m: Material,
  s: number,
) {
  r.rect(x, y, w, h, m, s);
  r.line(x + 1, y + 1, x + w - 2, y + 1, m, s + 1);
  r.line(x + 1, y + 2, x + 1, y + h - 2, m, s + 1);
  r.line(x, y + h - 1, x + w, y + h - 1, m, s - 2);
  r.line(x + w - 1, y, x + w - 1, y + h - 1, m, s - 1);
  // A few authored chips per stone, never a blanket noise filter.
  if (w > 20) {
    const chip = Math.floor(hash(x, y) * (w - 10));
    r.line(x + chip + 4, y + h - 4, x + chip + 8, y + h - 4, m, s - 1);
    r.pixel(x + chip + 5, y + h - 5, m, s + 1);
  }
  if (h > 20 && w > 25) {
    for (let band = 0; band < 4; band++) {
      const yy = y + 6 + (band * (h - 10)) / 4;
      const xx = x + 6 + hash(x, band + y) * (w * 0.5);
      r.line(xx, yy, Math.min(x + w - 5, xx + w * 0.23), yy, m, s - 1);
      r.line(xx + 2, yy + 1, Math.min(x + w - 5, xx + w * 0.19), yy + 1, m, s);
    }
  }
}

export function emblem(
  r: Raster,
  index: number,
  x: number,
  y: number,
  scale = 1,
  m: Material = 'bronze',
  shade = 5,
) {
  const line = (a: number, b: number, c: number, d: number) =>
    r.line(
      x + a * scale,
      y + b * scale,
      x + c * scale,
      y + d * scale,
      m,
      shade,
      scale,
    );
  if (index === 0) {
    line(0, 7, 0, -7);
    line(-5, 7, -5, -3);
    line(5, 7, 5, -2);
    line(0, -3, -4, -6);
    line(0, -1, 4, -5);
    line(-5, 2, -8, -1);
  } else if (index === 1) {
    r.poly(
      [
        [x - 9 * scale, y],
        [x - 3 * scale, y - 5 * scale],
        [x + 4 * scale, y - 4 * scale],
        [x + 6 * scale, y - 8 * scale],
        [x + 9 * scale, y - 5 * scale],
        [x + 4 * scale, y],
        [x + 1 * scale, y + 5 * scale],
      ],
      m,
      shade,
    );
    line(-5, 1, -8, 7);
    line(1, 5, 1, 8);
    line(1, 8, 5, 8);
    r.pixel(x + 6 * scale, y - 5 * scale, 'basalt', 0);
  } else {
    line(-9, 1, -5, 6);
    line(-5, 6, 6, 6);
    line(6, 6, 10, 1);
    line(-9, 1, 10, 1);
    line(0, 1, 0, -9);
    line(0, -9, 7, -3);
    line(7, -3, 0, -3);
  }
}

export function reliefArt(): Raster {
  const r = new Raster(150, 144);
  block(r, 0, 0, 150, 144, 'sandstone', 4);
  block(r, 6, 6, 138, 132, 'basalt', 2);
  r.rect(12, 12, 126, 96, 'basalt', 1);
  r.line(15, 97, 135, 97, 'faience', 5, 2);
  for (let i = 0; i < 3; i++) {
    const x = 34 + i * 41;
    r.line(x, 26, x, 97, 'basalt', 2);
    for (let level = 0; level <= 4; level++)
      r.line(x - 5, 97 - level * 17, x + 5, 97 - level * 17, 'basalt', 4);
    r.star(x, 97 - TARGET[i] * 17, 7);
    emblem(r, i, x, 120, 1, 'bronze', 5);
  }
  // Faint satellite stars and a celestial arch give the measurement carving
  // the character of a sky tablet rather than a modern chart.
  r.line(16, 20, 27, 14, 'bronze', 3);
  r.line(27, 14, 124, 14, 'bronze', 3);
  r.line(124, 14, 135, 20, 'bronze', 3);
  for (const [x, y] of [
    [21, 36],
    [52, 24],
    [95, 43],
    [125, 28],
    [58, 78],
    [129, 79],
  ])
    r.star(x, y, 1, 'basalt', 4);
  r.line(15, 106, 135, 106, 'bronze', 3);
  for (let x = 16; x < 137; x += 10) {
    r.rect(x, 130, 4, 2, 'bronze', 3);
    r.pixel(x + 1, 129, 'bronze', 5);
  }
  // A broken corner and chisel damage are placed deliberately.
  r.poly(
    [
      [0, 127],
      [8, 132],
      [5, 144],
      [0, 144],
    ],
    'limestone',
    2,
  );
  r.line(141, 1, 131, 10, 'sandstone', 2);
  return r;
}

export function mechanismArt(): Raster {
  const r = new Raster(90, 106);
  r.ellipse(45, 97, 44, 7, 'basalt', 0);
  r.poly(
    [
      [10, 81],
      [65, 81],
      [83, 90],
      [28, 90],
    ],
    'basalt',
    5,
  );
  r.poly(
    [
      [28, 90],
      [83, 90],
      [83, 98],
      [28, 98],
    ],
    'basalt',
    2,
  );
  r.poly(
    [
      [10, 81],
      [28, 90],
      [28, 98],
      [10, 89],
    ],
    'basalt',
    1,
  );
  r.poly(
    [
      [21, 40],
      [68, 40],
      [64, 81],
      [25, 81],
    ],
    'basalt',
    3,
  );
  r.poly(
    [
      [68, 40],
      [76, 44],
      [71, 85],
      [64, 81],
    ],
    'basalt',
    1,
  );
  r.poly(
    [
      [15, 32],
      [65, 27],
      [76, 38],
      [23, 44],
    ],
    'bronze',
    5,
  );
  r.poly(
    [
      [23, 44],
      [76, 38],
      [76, 43],
      [23, 49],
    ],
    'bronze',
    2,
  );
  r.poly(
    [
      [22, 32],
      [64, 29],
      [69, 37],
      [28, 41],
    ],
    'faience',
    2,
  );
  for (let i = 0; i < 3; i++) {
    r.line(33 + i * 12, 32, 38 + i * 12, 39, 'bronze', 5);
    r.star(35 + i * 12, 33 + (i % 2) * 3, 3, 'bronze', 7);
    emblem(r, i, 34 + i * 11, 59, 0.7, 'bronze', 4);
  }
  r.rect(27, 70, 36, 3, 'faience', 3);
  r.line(32, 76, 59, 76, 'bronze', 4);
  return r;
}

function column(
  r: Raster,
  x: number,
  top: number,
  bottom: number,
  width: number,
  lit: boolean,
) {
  const s = lit ? 5 : 3;
  r.shadow(
    [
      [x + width / 2, top + 10],
      [x + width, bottom + 5],
      [x + width + 48, bottom + 16],
      [x + width + 17, top],
    ],
    0.6,
  );
  for (let yy = top + 28; yy < bottom - 14; yy += 30) {
    for (let strip = 0; strip < width; strip++) {
      const facet =
        strip < width * 0.16
          ? s - 1
          : strip < width * 0.4
            ? s + 1
            : strip < width * 0.6
              ? s
              : strip < width * 0.82
                ? s - 1
                : s - 2;
      r.rect(x + strip, yy, 1, 29, 'limestone', facet);
    }
    r.line(x + 3, yy, x + width - 3, yy, 'limestone', s + 1);
    r.line(x, yy + 29, x + width, yy + 29, 'limestone', 1);
  }
  for (let k = 0; k < 5; k++)
    r.line(
      x + 8 + (k * (width - 16)) / 4,
      top + 30,
      x + 8 + (k * (width - 16)) / 4,
      bottom - 15,
      'limestone',
      s - 1,
    );
  block(r, x - 10, bottom - 15, width + 20, 13, 'sandstone', s);
  block(r, x - 16, bottom - 2, width + 32, 8, 'sandstone', s - 1);
  r.poly(
    [
      [x - 15, top + 5],
      [x + width + 15, top + 5],
      [x + width - 2, top + 30],
      [x + 2, top + 30],
    ],
    'faience',
    lit ? 4 : 2,
  );
  for (let k = 0; k < 7; k++)
    r.line(
      x - 10 + (k * (width + 20)) / 6,
      top + 7,
      x + width / 2,
      top + 28,
      'bronze',
      lit ? 4 : 2,
    );
  block(r, x - 19, top - 4, width + 38, 10, 'sandstone', s);
  r.rect(x + 3, bottom - 60, width - 6, 6, 'faience', lit ? 4 : 2);
  r.rect(x + 3, bottom - 53, width - 6, 2, 'bronze', s);
  if (width > 35) {
    // Carved cartouches on the foreground shafts, with a bevel on each glyph.
    const mid = x + width * 0.48;
    r.line(mid - 12, top + 86, mid - 12, bottom - 84, 'limestone', s - 2);
    r.line(mid + 13, top + 86, mid + 13, bottom - 84, 'limestone', s + 1);
    r.line(mid - 12, top + 85, mid + 13, top + 85, 'limestone', s - 2);
    for (let yy = top + 107, index = 0; yy < bottom - 90; yy += 31, index++) {
      emblem(r, index % 3, mid + 1, yy + 1, 1, 'limestone', s + 1);
      emblem(r, index % 3, mid, yy, 1, 'limestone', s - 2);
    }
  }
}

function falcon(r: Raster, cx: number, cy: number, span: number) {
  for (const side of [-1, 1]) {
    r.poly(
      [
        [cx, cy],
        [cx + side * span, cy - 15],
        [cx + side * (span - 7), cy + 8],
        [cx + side * 13, cy + 14],
      ],
      'bronze',
      3,
    );
    for (let i = 0; i < 12; i++) {
      const dx = 13 + (i * (span - 18)) / 12;
      r.line(
        cx + side * dx,
        cy - dx * 0.16 + 2,
        cx + side * (dx - 4),
        cy + 10,
        'bronze',
        5,
      );
      r.line(
        cx + side * (dx + 2),
        cy - dx * 0.16 + 3,
        cx + side * (dx - 2),
        cy + 10,
        'faience',
        2,
      );
    }
  }
  r.ellipse(cx, cy, 10, 13, 'bronze', 4);
  r.ellipse(cx - 2, cy - 2, 6, 9, 'bronze', 6);
  r.poly(
    [
      [cx - 6, cy + 12],
      [cx, cy + 23],
      [cx + 6, cy + 12],
    ],
    'bronze',
    5,
  );
}

export function generateArt() {
  const room = new Raster(ROOM.width, ROOM.height);
  // Perspective ray intersections with a 6-unit deep room. Texture coordinates
  // live on the actual wall/floor planes so masonry shrinks with distance.
  for (let y = 0; y < room.height; y++)
    for (let x = 0; x < room.width; x++) {
      const dx = (x - 400) / 500,
        dy = (y - 212) / 500;
      let depth = 6,
        plane = 'back';
      const wallDepth = 3 / Math.abs(dx);
      if (wallDepth < depth) {
        depth = wallDepth;
        plane = 'side';
      }
      const verticalDepth = (dy > 0 ? 1.45 : -1.7) / dy;
      if (verticalDepth > 0 && verticalDepth < depth) {
        depth = verticalDepth;
        plane = dy > 0 ? 'floor' : 'ceiling';
      }
      const wx = dx * depth,
        wy = dy * depth;
      const u = plane === 'side' ? depth : wx + 3;
      const v = plane === 'floor' || plane === 'ceiling' ? depth : wy + 1.7;
      const row = Math.floor(v / 0.39);
      const su = (u + (row % 2) * 0.46) / 0.92;
      const sv = v / 0.39;
      const fu = su - Math.floor(su),
        fv = sv - Math.floor(sv);
      const key = hash(Math.floor(su), row);
      let shade = 2.9 + key * 0.8;
      shade +=
        2.5 *
        Math.exp(-((wx + 1.7) ** 2 + (wy + 0.1) ** 2 + (depth - 4.8) ** 2) / 3);
      shade += Math.max(0, 0.5 - wy * 0.18);
      shade -= plane === 'ceiling' ? 1.8 : plane === 'side' ? 0.7 : 0;
      shade -= Math.max(0, 3 - depth) * 0.55;
      shade -= Math.exp(-Math.abs(wy - 1.45) * 18) * 0.8;
      shade -= Math.exp(-Math.abs(Math.abs(wx) - 3) * 14) * 0.6;
      if (fv < 0.022 || fu < 0.009) shade -= 2;
      else if (fv < 0.04 || fu < 0.018) shade += 1;
      else if (fv > 0.97 || fu > 0.987) shade -= 0.8;
      // Sparse elongated wear follows the stone courses.
      const strata = fv + Math.sin(fu * 9 + key * 8) * 0.012;
      if (
        (strata > 0.68 && strata < 0.694 && fu > 0.46 && fu < 0.82) ||
        (strata > 0.34 && strata < 0.35 && fu > 0.18 && fu < 0.51 && key > 0.3)
      )
        shade -= 0.7;
      if (fv > 0.1 && fv < 0.15 && fu > 0.1 && fu < 0.2 && key > 0.75)
        shade += 0.6;
      if (fv > 0.85 && fv < 0.93 && fu > 0.78 && fu < 0.83 && key < 0.25)
        shade -= 1.3;
      // Worn bevelled stones have narrow quantized transitions. Ordered clusters
      // occur only at ramp boundaries, not as random speckles over the surface.
      const dither =
        [
          [0, 2],
          [3, 1],
        ][y % 2][x % 2] /
          4 -
        0.375;
      shade += dither * 0.12;
      let material: Material = plane === 'ceiling' ? 'basalt' : 'limestone';
      if (plane === 'floor') {
        if (Math.abs(wx - 1.75) < 0.48) material = 'basalt';
        if (Math.abs(Math.abs(wx - 1.75) - 0.49) < 0.025) {
          material = 'bronze';
          shade = 4;
        }
      }
      room.pixel(x, y, material, shade);
    }
  // Painted ceiling ribs, recessed fascia and alternating lotus tiles.
  room.poly(
    [
      [0, 0],
      [800, 0],
      [650, 70],
      [150, 70],
    ],
    'basalt',
    1,
  );
  for (const x of [100, 245, 400, 555, 700]) {
    room.poly(
      [
        [x - 12, 0],
        [x + 12, 0],
        [400 + (x - 400) * 0.63 + 7, 70],
        [400 + (x - 400) * 0.63 - 7, 70],
      ],
      'basalt',
      3,
    );
    room.line(x, 0, 400 + (x - 400) * 0.63, 68, 'bronze', 3);
  }
  for (let x = 185; x < 642; x += 27) {
    room.star(x, 47 + (x % 3) * 3, 2, 'bronze', 4);
  }
  block(room, 151, 70, 499, 23, 'sandstone', 4);
  room.rect(154, 79, 493, 9, 'faience', 2);
  for (let x = 160; x < 644; x += 18) {
    room.poly(
      [
        [x, 86],
        [x - 5, 80],
        [x + 5, 80],
      ],
      'bronze',
      4,
    );
    room.pixel(x, 78, 'ochre', 4);
  }
  // Incised offering procession beneath the sky band. Outlines and chisel
  // highlights share an offset so the decoration reads as shallow relief.
  for (let x = 252; x < 392; x += 25) {
    emblem(room, Math.floor(x / 25) % 3, x + 1, 103, 0.75, 'sandstone', 6);
    emblem(room, Math.floor(x / 25) % 3, x, 102, 0.75, 'sandstone', 2);
  }
  for (let x = 246; x < 390; x += 12)
    room.line(x, 262, x + 5, 262, 'limestone', 2);
  // Recessed wall panels and narrow, independent back-wall pilasters.
  block(room, 238, 116, 154, 136, 'limestone', 2);
  block(room, 245, 121, 140, 126, 'sandstone', 5);
  for (const x of [197, 399, 639]) column(room, x, 88, 337, 19, x < 400);
  // Door jambs are permanently in the foreground over the moving gate.
  block(room, 463, 103, 23, 237, 'sandstone', 5);
  block(room, 614, 103, 24, 237, 'sandstone', 3);
  block(room, 455, 91, 190, 25, 'sandstone', 5);
  room.rect(461, 96, 177, 4, 'bronze', 4);
  falcon(room, 550, 80, 70);
  for (let y = 124; y < 322; y += 29) {
    emblem(room, Math.floor(y / 29) % 3, 474, y, 0.65, 'bronze', 4);
    emblem(room, Math.floor(y / 29) % 3, 625, y, 0.65, 'bronze', 3);
  }
  // Threshold projects into the room; a slab cannot slide over its front face.
  room.poly(
    [
      [475, 334],
      [625, 334],
      [639, 347],
      [468, 347],
    ],
    'limestone',
    5,
  );
  block(room, 468, 347, 171, 8, 'limestone', 2);
  room.line(475, 335, 625, 335, 'bronze', 4);
  // A star mosaic guides the eye to the mechanism without adding a new object.
  room.poly(
    [
      [416, 348],
      [444, 348],
      [461, 359],
      [423, 360],
    ],
    'faience',
    2,
  );
  room.line(418, 349, 443, 349, 'bronze', 5);
  room.line(426, 354, 449, 354, 'bronze', 4);
  // Shallow offering pool, off-axis in the foreground.
  const pool: Point[] = [
    [133, 348],
    [302, 348],
    [354, 402],
    [77, 402],
  ];
  room.poly(pool, 'sandstone', 4);
  room.poly(
    [
      [143, 355],
      [294, 355],
      [330, 391],
      [102, 391],
    ],
    'basalt',
    0,
  );
  room.poly(
    [
      [147, 358],
      [290, 358],
      [325, 388],
      [108, 388],
    ],
    'water',
    2,
  );
  room.poly(
    [
      [77, 402],
      [354, 402],
      [354, 412],
      [77, 412],
    ],
    'basalt',
    2,
  );
  room.line(80, 402, 350, 402, 'sandstone', 6, 2);
  for (let i = 0; i < 15; i++) {
    const y = 360 + i * 1.6;
    const x = 163 + Math.sin(i * 1.3) * 6;
    room.line(x, y, x + 16 + i * 2, y, 'water', i % 3 === 0 ? 5 : 3);
  }
  room.line(112, 387, 323, 387, 'water', 4);
  for (let i = 0; i < 11; i++) {
    const yy = 360 + i * 2;
    room.line(131 - i, yy, 142 - i + (i % 2) * 4, yy, 'water', 3 + (i % 2));
  }
  for (let i = 0; i < 4; i++) {
    const x = 269 + i * 7,
      y = 377 - i * 3;
    room.ellipse(x, y, 6, 2, 'faience', 3);
    room.poly(
      [
        [x, y - 2],
        [x - 3, y - 7],
        [x, y - 5],
        [x + 3, y - 7],
      ],
      'limestone',
      6,
    );
  }
  // A brazier: bright ceramic bowl, black iron tripod, tiny live flame layer.
  room.ellipse(217, 335, 33, 5, 'basalt', 0);
  room.line(216, 289, 201, 333, 'bronze', 2, 3);
  room.line(220, 289, 235, 332, 'bronze', 2, 3);
  room.line(218, 289, 218, 338, 'bronze', 3, 3);
  room.poly(
    [
      [194, 278],
      [240, 278],
      [233, 291],
      [203, 291],
    ],
    'ochre',
    4,
  );
  room.ellipse(217, 279, 23, 4, 'bronze', 6);
  room.ellipse(217, 278, 19, 2, 'basalt', 0);
  // Foreground columns provide scale, framing and real near/far overlap.
  column(room, 48, 15, 419, 57, true);
  column(room, 720, 8, 439, 66, false);
  // Broken offering vessel and controlled sand drifts.
  room.poly(
    [
      [649, 374],
      [675, 365],
      [694, 376],
      [684, 383],
    ],
    'ochre',
    3,
  );
  room.line(655, 372, 666, 367, 'ochre', 6, 2);
  room.poly(
    [
      [675, 368],
      [679, 350],
      [688, 352],
      [696, 376],
    ],
    'ochre',
    2,
  );
  for (const [x, y] of [
    [113, 421],
    [655, 367],
    [698, 412],
  ]) {
    for (let i = 0; i < 26; i++)
      room.line(
        x + i * 1.1,
        y + Math.floor(i / 9),
        x + i * 1.1 + 6,
        y + Math.floor(i / 9),
        'sandstone',
        3 + (i % 2),
      );
  }
  // Aperture is erased last. All surrounding stone occludes the entire slab
  // at every lift height, including the lintel and threshold.
  for (let y = GATE.y; y < GATE.y + GATE.height; y++)
    for (let x = GATE.x; x < GATE.x + GATE.width; x++)
      room.pixels[(y * room.width + x) * 4 + 3] = 0;

  const slab = new Raster(GATE.width, GATE.height);
  for (let y = 0; y < slab.height; y++)
    for (let x = 0; x < slab.width; x++) {
      const edge = Math.min(x, slab.width - 1 - x, y, slab.height - 1 - y);
      slab.pixel(
        x,
        y,
        'basalt',
        edge < 3 ? 0 : edge < 6 ? 5 : 2.5 + (1 - x / slab.width) * 0.8,
      );
    }
  block(slab, 12, 12, 104, 194, 'basalt', 3);
  block(slab, 17, 17, 94, 184, 'basalt', 2);
  slab.line(21, 22, 106, 22, 'bronze', 4);
  slab.line(21, 193, 106, 193, 'bronze', 3);
  for (let yy = 28; yy < 192; yy += 9) {
    slab.rect(21, yy, 3, 3, 'bronze', 3);
    slab.pixel(21, yy, 'bronze', 5);
    slab.rect(104, yy, 3, 3, 'bronze', 2);
    slab.pixel(104, yy, 'bronze', 4);
  }
  for (let yy = 25; yy < 198; yy++)
    for (let xx = 26; xx < 102; xx++) {
      const band = yy + Math.sin(xx / 14) * 4;
      if ((band % 31 < 1 && xx % 47 > 12) || (band % 51 < 1 && xx < 51))
        slab.pixel(xx, yy, 'basalt', 3);
    }
  falcon(slab, 64, 71, 38);
  slab.ellipse(64, 121, 18, 23, 'basalt', 0);
  slab.ellipse(64, 118, 16, 22, 'bronze', 3);
  slab.ellipse(64, 118, 13, 19, 'basalt', 1);
  slab.star(64, 118, 9, 'faience', 4);
  for (let i = 0; i < 3; i++) emblem(slab, i, 37 + i * 27, 163, 1, 'bronze', 4);
  slab.line(27, 41, 32, 54, 'basalt', 1);
  slab.line(32, 54, 30, 62, 'basalt', 1);
  slab.line(91, 179, 98, 189, 'basalt', 1);
  // Tall stylized papyrus stalks etched beside the central sacred cartouche.
  for (const side of [-1, 1]) {
    const xx = 64 + side * 31;
    slab.line(xx, 95, xx, 144, 'basalt', 4);
    for (let j = 0; j < 5; j++)
      slab.line(xx, 101 + j * 8, xx + side * 6, 96 + j * 8, 'basalt', 4);
  }

  const passage = new Raster(GATE.width, GATE.height);
  passage.rect(0, 0, passage.width, passage.height, 'basalt', 0);
  passage.poly(
    [
      [0, 0],
      [51, 69],
      [51, 157],
      [0, 218],
    ],
    'basalt',
    2,
  );
  passage.poly(
    [
      [128, 0],
      [78, 69],
      [78, 157],
      [128, 218],
    ],
    'basalt',
    1,
  );
  for (let i = 0; i < 7; i++) {
    const y = 157 + (i / 6) ** 1.8 * 61;
    const half = 14 + (i / 6) ** 1.4 * 51;
    passage.poly(
      [
        [64 - half, y],
        [64 + half, y],
        [65 + half + 5, y + 5],
        [59 - half, y + 5],
      ],
      'limestone',
      3 + (i % 2),
    );
    passage.line(64 - half, y, 64 + half, y, 'bronze', 4);
    passage.line(59 - half, y + 5, 65 + half + 5, y + 5, 'basalt', 0, 3);
  }
  passage.rect(51, 70, 27, 87, 'basalt', 0);
  passage.rect(60, 89, 7, 57, 'faience', 4);
  passage.rect(62, 89, 2, 57, 'faience', 7);
  passage.star(64, 85, 6, 'bronze', 6);
  const spill = new Raster(800, 450);
  spill.poly(
    [
      [488, 334],
      [612, 334],
      [717, 450],
      [379, 450],
    ],
    'faience',
    5,
  );
  for (let i = 3; i < spill.pixels.length; i += 4)
    if (spill.pixels[i]) spill.pixels[i] = 30;
  const atmosphere = new Raster(800, 450);
  // A narrow ventilation slit catches moonlight. The beam is a separate
  // transparent layer, feathered in discrete pixel steps rather than blur.
  for (let y = 72; y < 350; y++) {
    const t = (y - 72) / 278;
    const center = 280 + t * 78;
    const half = 3 + t * 40;
    for (let x = Math.floor(center - half); x < center + half; x++) {
      const edge = Math.max(0, 1 - Math.abs(x - center) / half);
      atmosphere.pixel(
        x,
        y,
        'limestone',
        7,
        Math.floor(edge * (1 - t * 0.4) * 3) * 5,
      );
    }
  }
  room.line(274, 71, 286, 71, 'limestone', 7, 2);
  const activation = new Raster(70, 50);
  for (let y = 0; y < activation.height; y++)
    for (let x = 0; x < activation.width; x++) {
      const radius = Math.sqrt(((x - 35) / 35) ** 2 + ((y - 25) / 25) ** 2);
      activation.pixel(
        x,
        y,
        'faience',
        6,
        Math.floor(Math.max(0, 1 - radius) ** 2 * 70),
      );
    }
  return {
    room,
    slab,
    passage,
    spill,
    atmosphere,
    activation,
    relief: reliefArt(),
    mechanism: mechanismArt(),
  };
}
