// Story stills: grandfather's attic, the heirloom box, the note, the travel
// map and the desert crossing. Warm interior light versus cool shadows.
import {
  Raster,
  rampColor,
  fbm,
  rng,
  hex,
  bayer,
  mix,
  noise,
} from './raster.mjs';
import { carveGlyph, forEachGlyphPixel } from './glyphs.mjs';
import { PAL, paintSky, paintFar, paintJeep } from './exterior.mjs';

const WOOD = [
  '#140d12',
  '#1f141a',
  '#2c1c1e',
  '#3d2822',
  '#523426',
  '#6b442d',
  '#8a5a37',
  '#ab7444',
  '#cc9356',
  '#e8b673',
];
const COOL = '#151629';
const PAPER = [
  '#8f7556',
  '#a88b65',
  '#bfa175',
  '#d2b588',
  '#e2c99b',
  '#eedbb0',
];
const INK = '#2b1d1b';

function lightAt(x, y, wx, wy) {
  // Warm pool from the window plus a falloff into cool darkness.
  const d = Math.hypot((x - wx) / 260, (y - wy) / 210);
  return Math.max(0, 1 - d);
}

export function paintAttic() {
  const W = 640;
  const H = 360;
  const r = new Raster(W, H);
  const win = { x: 430, y: 104, r: 24 };
  const pool = { x: 300, y: 300 };
  const vp = { x: 320, y: 176 };
  const shade = (x, y, base) => {
    const l = Math.max(
      lightAt(x, y, win.x, win.y) * 0.7,
      lightAt(x, y, pool.x, pool.y) * 0.8,
    );
    return Math.max(0, Math.min(1, base + l * 0.55));
  };
  // Back gable wall: vertical boards.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const board = Math.floor((x - 4) / 22);
      const edge = (x - 4) % 22 === 0;
      let t = shade(x, y, 0.16 + (noise(board, 3, 5) - 0.5) * 0.08);
      t += (fbm(x / 3, y / 40, board, 2) - 0.5) * 0.06;
      if (edge) t -= 0.12;
      r.set(x, y, rampColor(WOOD, t, x, y, 0.8));
    }
  // Floor in perspective.
  const floorTop = 232;
  for (let y = floorTop; y < H; y++) {
    const depth = (y - floorTop) / (H - floorTop);
    for (let x = 0; x < W; x++) {
      const u = (x - vp.x) / (y - vp.y);
      const plank = Math.floor(u * 6);
      const seam = Math.abs(u * 6 - Math.round(u * 6)) < 0.05 / (0.3 + depth);
      let t = shade(
        x,
        y,
        0.2 + depth * 0.08 + (noise(plank, 1, 9) - 0.5) * 0.1,
      );
      t += (fbm(u * 30, y / 30, plank + 40, 2) - 0.5) * 0.06;
      if (seam) t -= 0.14;
      r.set(x, y, rampColor(WOOD, t, x, y, 0.8));
    }
  }
  for (let x = 0; x < W; x++) r.set(x, floorTop, '#140d12');
  // Sloped roof planes on both sides with rafters.
  const slope = (side) =>
    side < 0
      ? [
          [0, 0],
          [150, 0],
          [150, 70],
          [0, 250],
        ]
      : [
          [490, 0],
          [640, 0],
          [640, 250],
          [490, 70],
        ];
  for (const side of [-1, 1]) {
    r.fillPolygon(slope(side), (x, y) => {
      const t = shade(x, y, 0.08) * 0.8;
      const along = side < 0 ? x + y * 0.83 : W - x + y * 0.83;
      const rafter = Math.floor(along / 46) % 2 === 0 && along % 46 < 9;
      return rampColor(WOOD, rafter ? t + 0.18 : t, x, y, 0.8);
    });
    // Purlin edge where the slope meets the gable wall.
    const x0 = side < 0 ? 150 : 490;
    for (let y = 0; y < 72; y++)
      r.rect(x0 - 3, y, 6, 1, rampColor(WOOD, shade(x0, y, 0.3), x0, y, 0.6));
    for (let k = 0; k < 6; k++)
      r.line(
        x0,
        70 + k,
        side < 0 ? 0 : W,
        250 + k,
        rampColor(WOOD, 0.3 - k * 0.03, x0, k, 0),
      );
  }
  // Collar beam across the top.
  for (let y = 30; y < 44; y++)
    for (let x = 0; x < W; x++)
      r.set(
        x,
        y,
        rampColor(WOOD, shade(x, y, y < 33 ? 0.36 : 0.18), x, y, 0.6),
      );
  // Round window with warm sky.
  r.ellipse(win.x, win.y, win.r + 6, win.r + 6, (x, y) =>
    rampColor(WOOD, 0.62, x, y, 0.5),
  );
  r.ellipse(win.x, win.y, win.r, win.r, (x, y) => {
    const t = (y - (win.y - win.r)) / (win.r * 2);
    return mix('#ffe8b8', '#f7b766', t * 0.8);
  });
  r.rect(win.x - 1, win.y - win.r, 2, win.r * 2, '#3d2822');
  r.rect(win.x - win.r, win.y - 1, win.r * 2, 2, '#3d2822');

  // Props: travel trunk, stacked books, sheeted chair, globe, lantern, rolled maps.
  const trunk = { x: 40, y: 262, w: 124, h: 64 };
  for (let y = trunk.y; y < trunk.y + trunk.h; y++)
    for (let x = trunk.x; x < trunk.x + trunk.w; x++) {
      let t = shade(x, y, 0.25);
      if (y < trunk.y + 16) t += 0.06;
      if ((x - trunk.x) % 40 < 3 || y === trunk.y + 16) t -= 0.12;
      r.set(
        x,
        y,
        rampColor(
          ['#1b1517', '#2d2324', '#45322b', '#5e4433', '#7b5a3e', '#9a7449'],
          t,
          x,
          y,
          0.7,
        ),
      );
    }
  for (const [sx, sy, c] of [
    [52, 280, '#7d5b49'],
    [118, 290, '#5f6f68'],
  ])
    r.rect(sx, sy, 22, 14, mix(c, '#000000', 0.2));
  r.rect(trunk.x + trunk.w / 2 - 5, trunk.y + 14, 10, 8, '#b2884a');
  // Books.
  const bookColors = ['#5b2f2a', '#2f4a4c', '#6d5530', '#3b2e46', '#4f3a24'];
  let by = 324;
  for (let i = 0; i < 6; i++) {
    const w = 46 - (i % 3) * 6;
    const h = 7 + (i % 2) * 2;
    by -= h;
    const bx = 182 + (i % 2) * 4;
    for (let y = by; y < by + h; y++)
      for (let x = bx; x < bx + w; x++)
        r.set(
          x,
          y,
          mix(bookColors[i % 5], '#000000', 0.5 - shade(x, y, 0) * 0.6),
        );
    r.rect(bx + 2, by + 1, w - 4, 1, mix('#e8d6b0', '#000000', 0.55));
  }
  // Sheeted armchair silhouette on the right.
  r.fillPolygon(
    [
      [492, 330],
      [486, 250],
      [500, 214],
      [552, 206],
      [586, 222],
      [596, 330],
    ],
    (x, y) =>
      rampColor(
        ['#2a2834', '#3b3946', '#57545d', '#7a7477', '#a79a8f', '#cbb9a2'],
        shade(x, y, 0.18) + (fbm(x / 12, y / 9, 3, 2) - 0.5) * 0.2,
        x,
        y,
        0.8,
      ),
  );
  // Globe.
  r.ellipse(452, 300, 17, 17, (x, y) => {
    const land = fbm(x / 7, y / 7, 11, 2) > 0.55;
    const t = shade(x, y, 0.15) + (452 - x + 300 - y) / 70;
    return rampColor(
      land
        ? ['#2b2a1e', '#4d4a30', '#7a7446', '#a19a62']
        : ['#16202a', '#22384a', '#36586c', '#5a8592'],
      t,
      x,
      y,
      0.7,
    );
  });
  r.rect(450, 316, 4, 12, '#5e4433');
  r.rect(440, 328, 24, 3, '#7b5a3e');
  // Lantern on the trunk.
  r.rect(140, 244, 12, 18, '#3a2f29');
  r.rect(142, 247, 8, 12, '#d39a4a');
  r.rect(138, 241, 16, 3, '#2a2220');
  // Rolled maps leaning on the wall.
  for (let i = 0; i < 3; i++)
    r.line(
      566 + i * 6,
      330,
      584 + i * 8,
      250 - i * 5,
      mix('#d8c296', '#000000', 0.45 - i * 0.05),
    );

  // Cool shadow vignette to the edges.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = Math.hypot((x - 320) / 360, (y - 220) / 230);
      if (v > 0.7) r.tint(x, y, COOL, Math.min(0.75, (v - 0.7) * 1.3));
    }
  return r;
}

/** Heirloom box: dark wood with brass corners. `open` shows lid and lining. */
export function paintBox(open) {
  const W = 140;
  const H = open ? 120 : 70;
  const r = new Raster(W, H);
  const bx = 20;
  const bw = 100;
  const bodyTop = H - 46;
  const front = (x, y) => {
    const t =
      0.38 + ((x - bx) / bw) * 0.25 + (fbm(x / 3, y / 18, 4, 2) - 0.5) * 0.12;
    return rampColor(WOOD, t, x, y, 0.6);
  };
  // Body front.
  for (let y = bodyTop; y < H - 4; y++)
    for (let x = bx; x < bx + bw; x++) r.set(x, y, front(x, y));
  // Top rim / interior.
  const rimTop = bodyTop - 14;
  r.fillPolygon(
    [
      [bx, bodyTop],
      [bx + 10, rimTop],
      [bx + bw - 10, rimTop],
      [bx + bw, bodyTop],
    ],
    (x, y) =>
      open
        ? rampColor(
            ['#0d1020', '#151a33', '#1f2748', '#2a3560'],
            0.2 + (y - rimTop) / 30 + (x - bx) / 400,
            x,
            y,
            0.8,
          )
        : rampColor(WOOD, 0.62 + ((x - bx) / bw) * 0.2, x, y, 0.6),
  );
  // Brass corners and clasp.
  for (const cx of [bx, bx + bw - 6]) {
    r.rect(cx, bodyTop, 6, 6, '#c99147');
    r.rect(cx, H - 10, 6, 6, '#9c6a33');
  }
  r.rect(bx + bw / 2 - 4, bodyTop + 2, 8, 9, '#ebbd6a');
  r.rect(bx + bw / 2 - 2, bodyTop + 5, 4, 3, '#6b4421');
  if (!open) {
    // Small carved eye on the lid hints at what is inside.
    carveGlyph(r, 'eye', bx + bw / 2 - 8, rimTop + 0, 1, {
      depth: 0.35,
      shadow: hex('#1f141a'),
    });
  } else {
    // Lid swung back.
    r.fillPolygon(
      [
        [bx + 10, rimTop],
        [bx + bw - 10, rimTop],
        [bx + bw - 4, 6],
        [bx + 4, 6],
      ],
      (x, y) => {
        const inset = Math.min(
          y - 6,
          rimTop - y,
          x - (bx + 4) - (rimTop - y) * 0.08,
          bx + bw - 4 - x - (rimTop - y) * 0.08,
        );
        if (inset < 5)
          return rampColor(WOOD, 0.45 + ((x - bx) / bw) * 0.2, x, y, 0.6);
        return rampColor(
          ['#090b17', '#0f1428', '#171f3d'],
          0.15 + (y - 6) / 160 + fbm(x / 4, y / 4, 6, 2) * 0.2,
          x,
          y,
          0.8,
        );
      },
    );
    for (let x = bx + 4; x < bx + bw - 4; x++) {
      r.set(x, 6, '#6b442d');
      r.set(x, 7, '#3d2822');
    }
  }
  // Shadow under the box.
  for (let x = bx - 6; x < bx + bw + 10; x++)
    for (let y = H - 4; y < H; y++)
      if ((y - H + 5) / 5 < bayer(x, y) + 0.4) r.set(x, y, '#100b0f', 180);
  r.outline(hex('#0b080b'));
  return r;
}

/** Light shaft from the round window, drawn additively in-engine. */
export function paintShaft() {
  const W = 640;
  const H = 360;
  const r = new Raster(W, H);
  const poly = [
    [410, 86],
    [452, 122],
    [372, 344],
    [214, 326],
  ];
  r.fillPolygon(poly, (x, y) => {
    const along = (y - 86) / 260;
    const across = Math.abs((x - 330 + (y - 210) * 0.55) / 140);
    const a = Math.max(0, 0.55 - across * 0.4) * (0.4 + along * 0.6);
    return a * 1.2 > bayer(x, y) * 0.8
      ? [255, 214, 150, Math.round(70 * a + 20)]
      : null;
  });
  return r;
}

export function paintNote() {
  const W = 300;
  const H = 200;
  const r = new Raster(W, H);
  const rand = rng(17);
  const edge = (x, y) => {
    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
    return e < 3 + noise(x / 4 + y / 4, 0, 3) * 4;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (edge(x, y)) continue;
      let t = 0.72 + (fbm(x / 30, y / 30, 5, 3) - 0.5) * 0.35;
      // Fold creases.
      if (Math.abs(x - 150) < 1) t -= 0.18;
      if (Math.abs(y - 100) < 1) t -= 0.12;
      // Foxing spots and a tea stain.
      const stain = Math.hypot(x - 238, y - 46) / 30;
      if (stain < 1 && stain > 0.86) t -= 0.18;
      else if (stain < 0.86) t -= 0.06;
      r.set(x, y, rampColor(PAPER, t, x, y, 0.8));
    }
  for (let i = 0; i < 40; i++) r.set(rand() * W, rand() * H, '#8f7556');
  // Grandfather's ink sketch of the eye and a small pyramid with a ray.
  forEachGlyphPixel('eye', 2, (x, y, n) => {
    if (n.code !== '.') r.set(236 + x, 132 + y, INK, 210);
  });
  for (let i = 0; i < 26; i++) {
    r.set(196 + i, 176 - i * 0.9, INK, 200);
    r.set(222 + i * 0.9, 152 + i * 0.9, INK, 200);
  }
  r.line(178, 176, 246, 176, INK, 200);
  for (let i = 0; i < 18; i++)
    if (i % 3 !== 2) r.set(222 + i * 1.1, 152 - i * 0.6, '#7a4a2a', 220);
  return r;
}

export function paintMap() {
  const W = 640;
  const H = 360;
  const r = new Raster(W, H);
  const land = (x, y) => {
    const n = fbm(x / 120, y / 90, 8, 4);
    const g = (cx, cy, rx, ry) =>
      Math.exp(-(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2));
    // Homeland in the north-west, open sea between, desert in the south-east.
    const bias =
      0.22 * g(140, 100, 170, 120) +
      0.26 * g(530, 280, 200, 130) -
      0.16 * g(340, 190, 120, 260);
    return n + bias;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = land(x, y);
      const paper = 0.66 + (fbm(x / 40, y / 40, 2, 3) - 0.5) * 0.3;
      if (v < 0.47) {
        // Sea: ink wash with hatched waves.
        let c = rampColor(
          ['#5f7f7c', '#7b968d', '#97ab98', '#b2bc9f'],
          0.4 + (v - 0.4) * 3,
          x,
          y,
          0.7,
        );
        if ((y % 9 === 0 && Math.sin(x / 5 + y) > 0.6) || v > 0.462)
          c = mix(c, '#3e5655', 0.5);
        r.set(x, y, c);
      } else {
        let t = paper;
        // Desert stipple in the south-east.
        const desert =
          Math.max(0, (x - 360) / 280) * Math.max(0, (y - 170) / 190);
        if (desert > 0.05 && bayer(x * 3, y * 2) < desert * 0.5) t -= 0.25;
        // Mountains as small inked chevrons.
        if (fbm(x / 50, y / 50, 33, 2) > 0.66 && x % 14 === 7 && y % 12 === 5) {
          r.set(x, y, rampColor(PAPER, t, x, y, 0.6));
          continue;
        }
        r.set(x, y, rampColor(PAPER, t, x, y, 0.6));
        if (v < 0.485) r.set(x, y, INK, 200);
      }
    }
  // Mountain marks.
  const rand = rng(9);
  for (let i = 0; i < 40; i++) {
    const x = Math.round(rand() * W);
    const y = Math.round(rand() * H);
    if (land(x, y) < 0.53) continue;
    r.line(x - 3, y + 2, x, y - 2, INK, 170);
    r.line(x, y - 2, x + 3, y + 2, INK, 170);
  }
  // Compass rose.
  const cx = 74;
  const cy = 290;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    r.line(cx, cy, cx + Math.sin(a) * 22, cy - Math.cos(a) * 22, INK, 200);
    r.line(
      cx,
      cy,
      cx + Math.sin(a + Math.PI / 4) * 10,
      cy - Math.cos(a + Math.PI / 4) * 10,
      INK,
      160,
    );
  }
  r.ellipse(cx, cy, 4, 4, '#7a4a2a');
  r.line(cx - 2, cy - 30, cx + 2, cy - 26, INK);
  r.line(cx + 2, cy - 30, cx - 2, cy - 26, INK);
  // Border.
  for (let x = 6; x < W - 6; x++) {
    r.set(x, 6, INK, 180);
    r.set(x, H - 7, INK, 180);
  }
  for (let y = 6; y < H - 6; y++) {
    r.set(6, y, INK, 180);
    r.set(W - 7, y, INK, 180);
  }
  // Paper edge darkening.
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e < 18) r.tint(x, y, '#3e2a1c', (1 - e / 18) * 0.45);
    }
  return r;
}

export function mapMarkers() {
  // Home (north-west) and the destination sign (south-east desert).
  return { home: { x: 150, y: 96 }, destination: { x: 520, y: 282 } };
}

export function paintMapPins() {
  const r = new Raster(64, 24);
  // House glyph.
  r.fillPolygon(
    [
      [2, 10],
      [10, 2],
      [18, 10],
    ],
    hex(INK),
  );
  r.rect(4, 10, 12, 9, INK);
  r.rect(9, 13, 3, 6, '#d2b588');
  // Destination: the steps sign in red ink.
  forEachGlyphPixel('steps', 1, (x, y, n) => {
    if (n.code === '#') r.set(40 + x, 4 + y, '#7a2a1e');
  });
  return r;
}

export function paintTravelDunes() {
  // Seamless (horizontally tiling) dune belt for the desert crossing.
  const W = 1280;
  const H = 360;
  const r = new Raster(W, H);
  const wrapFbm = (x, y, seed) => {
    const a = (x / W) * Math.PI * 2;
    return fbm(Math.cos(a) * 3 + 10, Math.sin(a) * 3 + y, seed, 3);
  };
  for (let x = 0; x < W; x++) {
    const crest = 248 + (wrapFbm(x, 0.3, 4) - 0.5) * 50;
    const crest2 = 285 + (wrapFbm(x, 2.3, 9) - 0.5) * 30;
    for (let y = Math.floor(crest); y < H; y++) {
      const near = y >= crest2;
      const local = near ? (y - crest2) / 70 : (y - crest) / 60;
      const slope =
        wrapFbm(x + 12, near ? 2.3 : 0.3, near ? 9 : 4) -
        wrapFbm(x - 12, near ? 2.3 : 0.3, near ? 9 : 4);
      const fade = Math.max(0, 1 - local * 2.2);
      let t =
        (near ? 0.72 : 0.6) -
        local * 0.25 +
        Math.max(-0.25, Math.min(0.18, -slope * 3)) * fade;
      if (near && Math.sin(y * 1.3 + wrapFbm(x, y / 20, 2) * 8) > 0.92)
        t -= 0.12;
      r.set(
        x,
        y,
        rampColor(
          near ? PAL.sandLit : PAL.farDune.concat(PAL.sandLit.slice(3)),
          t,
          x,
          y,
          1,
        ),
      );
      if (Math.abs(y - crest2) < 1 && near) r.tint(x, y, '#ffe6b3', 0.35);
    }
  }
  return r;
}

export function paintTravelJeep() {
  const r = new Raster(80, 40);
  paintJeep(r, 40, 36, 1);
  r.outline(hex('#2a1d22'));
  return r;
}

export function paintPlane() {
  const r = new Raster(56, 22);
  const c = hex('#1f2638');
  r.fillPolygon(
    [
      [2, 11],
      [46, 9],
      [54, 11],
      [46, 13],
      [6, 13],
    ],
    c,
  );
  r.fillPolygon(
    [
      [22, 11],
      [32, 11],
      [18, 21],
      [14, 21],
    ],
    c,
  );
  r.fillPolygon(
    [
      [22, 11],
      [32, 11],
      [22, 2],
      [18, 2],
    ],
    c,
  );
  r.fillPolygon(
    [
      [2, 11],
      [9, 11],
      [4, 4],
      [1, 4],
    ],
    c,
  );
  return r;
}

export { paintSky, paintFar };
