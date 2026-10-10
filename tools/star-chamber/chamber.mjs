import { Raster, rng, hex, mix, fbm } from '../hall-art/common.mjs';

const W = 1600;
const H = 720;
const C = {
  ink: '#090d20', deep: '#101831', shadow: '#161e3a', lapis: '#21335f',
  blue: '#304b7c', lit: '#48699a', limestone: '#8d806f', pale: '#d6c19a',
  gold: '#c99a4b', bright: '#f2d181', bronze: '#87542b', bronzeLit: '#d6a45d',
  teal: '#3d9296', star: '#f7e6b4',
};

function roundRect(r, x, y, w, h, fill, edge = C.bronze, edgeW = 4) {
  r.rect(x, y, w, h, edge);
  r.rect(x + edgeW, y + edgeW, w - edgeW * 2, h - edgeW * 2, fill);
}

function star(r, x, y, radius, color, rays = 4) {
  r.ellipse(x, y, radius, radius, color);
  if (radius >= 3) {
    r.line(x - radius - 2, y, x + radius + 2, y, color);
    r.line(x, y - radius - 2, x, y + radius + 2, color);
    if (rays === 8) {
      r.line(x - radius, y - radius, x + radius, y + radius, color);
      r.line(x + radius, y - radius, x - radius, y + radius, color);
    }
  }
}

function paintRoom() {
  const r = new Raster(W, H);
  const rand = rng(0x51a7cafe);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edgeShade = Math.abs(x - W / 2) / (W / 2);
      const ceiling = y < 150 ? 0.08 : y < 300 ? 0.19 : y < 500 ? 0.31 : 0.42;
      const grain = (fbm(x / 48, y / 33, 193, 2) - 0.5) * 0.13;
      const block = ((Math.floor(y / 36) * 7 + Math.floor(x / 76) * 3) % 5) * 0.012;
      const light = Math.max(0, Math.min(1, ceiling + 0.18 - edgeShade * 0.18 + grain + block));
      const ramp = ['#11172f', '#182341', '#203056', '#293b64', '#344871', '#40557d', '#526487'];
      const index = Math.max(0, Math.min(ramp.length - 1, Math.floor(light * (ramp.length - 1))));
      r.set(x, y, ramp[index]);
    }
  }

  // The impossible aperture: a night sky set inside a roof that should be solid.
  r.fillPolygon([[560, 0], [1040, 0], [962, 176], [638, 176]], '#070b18');
  for (let x = 610; x < 1000; x += 18) {
    const roofY = Math.round(168 - Math.abs(x - 800) * 0.09);
    r.line(x, 3, 800 + (x - 800) * 0.72, roofY, '#152448', 205);
  }
  // Massive concentric lintels frame the aperture and catch cold reflected light.
  for (let i = 0; i < 8; i++) {
    const inset = i * 9;
    const shade = ['#101833', '#1c2b4d', '#354a6d', '#192541'][i % 4];
    r.line(518 + inset, 10 + i * 3, 627 + inset / 3, 202 - inset, shade);
    r.line(1082 - inset, 10 + i * 3, 973 - inset / 3, 202 - inset, shade);
  }
  r.line(500, 16, 800, 191, C.gold);
  r.line(1100, 16, 800, 191, C.gold);
  r.line(500, 16, 1100, 16, '#31466c');

  // Inlaid star field: ordered constellations and fine bronze meridian arcs.
  for (let i = 0; i < 9; i++) {
    const yy = 205 + i * 13;
    const dx = 600 + i * 5;
    r.line(dx, yy, 1600 - dx, yy, i % 3 ? '#344569' : '#a77c40', i % 3 ? 155 : 210);
  }
  // Block courses and shallow chisel cuts make the broad wall read as masonry.
  for (let row = 0, y = 190; y < 466; row++, y += 34) {
    const offset = row % 2 ? -34 : 0;
    for (let x = -80 + offset; x < W; x += 88) {
      const seam = (x > 450 && x < 1150 && y > 205 && y < 350) ? '#263758' : '#56627a';
      r.line(x, y, Math.min(W, x + 88), y, seam, 110);
      const joint = x + 54 + (row % 3) * 7;
      if (joint < 450 || joint > 1150) r.line(joint, y + 1, joint, y + 32, '#18233d', 190);
      else if (row % 2 === 0) r.line(joint, y + 1, joint, y + 30, '#293b5d', 130);
    }
  }
  for (let x = 100; x < 1530; x += 64) {
    for (let y = 220 + (Math.floor(x / 64) % 2) * 13; y < 310; y += 26) {
      const n = rand();
      if (n > 0.66) star(r, x + Math.round(rand() * 12), y, n > 0.93 ? 3 : 1, n > 0.9 ? C.bright : '#8ba1c0');
    }
  }

  // Monumental pilasters and shadowed bays, built as layered masonry.
  for (const x of [68, 382, 1218, 1532]) {
    const w = x === 68 || x === 1532 ? 56 : 66;
    r.fillPolygon([[x - 30, 112], [x + w + 30, 112], [x + w, 590], [x, 590]], '#121a32');
    roundRect(r, x, 138, w, 424, '#263553', '#111a30', 7);
    for (let y = 164; y < 548; y += 36) {
      r.line(x + 5, y, x + w - 5, y, y % 3 ? '#405474' : '#1a2845');
      r.rect(x + 8, y + 3, w - 16, 1, '#64738a', 80);
    }
    r.fillPolygon([[x - 28, 132], [x + w + 28, 132], [x + w + 12, 166], [x - 12, 166]], '#8c673d');
    r.line(x - 22, 136, x + w + 22, 136, C.bright);
    r.fillPolygon([[x - 12, 558], [x + w + 12, 558], [x + w + 30, 606], [x - 30, 606]], '#18223d');
    r.line(x - 20, 566, x + w + 20, 566, '#b28345');
  }

  // Carved arch niches, framed tablets and low lamps create scale/depth.
  for (const x of [250, 1320]) {
    r.fillPolygon([[x, 404], [x, 270], [x + 22, 218], [x + 76, 196], [x + 130, 218], [x + 152, 270], [x + 152, 404]], '#10172e');
    r.line(x, 404, x, 270, '#64718a');
    r.line(x, 270, x + 22, 218, '#a68b63');
    r.line(x + 22, 218, x + 76, 196, '#465c7c');
    r.line(x + 76, 196, x + 130, 218, '#a68b63');
    r.line(x + 130, 218, x + 152, 270, '#465c7c');
    r.line(x + 152, 270, x + 152, 404, '#64718a');
    roundRect(r, x + 32, 268, 88, 108, '#1b2340', '#9b7743', 4);
    for (let row = 0; row < 4; row++) {
      const yy = 286 + row * 19;
      r.line(x + 47, yy, x + 105, yy, row % 2 ? '#415273' : '#9b794d');
      r.line(x + 62, yy - 5, x + 86, yy + 5, '#536984');
    }
    if (x === 250) {
      // The star chart: three equal lights cross the water; the two outer signs rise/fall.
      const pts = [[x + 48, 302], [x + 76, 302], [x + 104, 302], [x + 104, 284], [x + 48, 320]];
      for (const [a, b] of [[0, 1], [1, 2], [2, 3], [0, 4]]) r.line(...pts[a], ...pts[b], '#d4ad69', 220);
      for (const [sx, sy] of pts) { r.ellipse(sx, sy, 3, 3, '#f0d18b'); r.line(sx - 4, sy, sx + 4, sy, '#fff0bd', 180); }
      r.line(x + 47, 345, x + 59, 341, '#467e89'); r.line(x + 59, 341, x + 71, 345, '#467e89');
      r.line(x + 71, 345, x + 83, 341, '#467e89'); r.line(x + 83, 341, x + 95, 345, '#467e89');
    } else {
      // A horizon marker points north; hieroglyphic wave strokes encode the season.
      r.line(x + 52, 336, x + 100, 336, '#52778a');
      r.line(x + 53, 342, x + 99, 342, '#52778a');
      r.line(x + 76, 322, x + 76, 286, '#d4ad69');
      r.fillPolygon([[x + 70, 293], [x + 76, 279], [x + 82, 293]], '#e9cb83');
      r.ellipse(x + 104, 308, 3, 3, '#f0d18b');
      r.ellipse(x + 48, 326, 3, 3, '#f0d18b');
      r.line(x + 47, 352, x + 60, 348, '#467e89'); r.line(x + 60, 348, x + 73, 352, '#467e89');
      r.line(x + 73, 352, x + 86, 348, '#467e89'); r.line(x + 86, 348, x + 99, 352, '#467e89');
    }
    // Copper oil lamps and their small, localized pools.
    r.ellipse(x + 76, 422, 30, 12, '#151b2d');
    r.ellipse(x + 76, 414, 14, 7, '#9e6e37');
    star(r, x + 76, 402, 5, '#ffd77c', 8);
  }

  // Raised floor: large perspective slabs with an inlaid northward meridian.
  for (let y = 474; y < H; y += 28) {
    const perspective = (y - 474) / (H - 474);
    const half = 280 + perspective * 640;
    const left = 800 - half;
    const right = 800 + half;
    r.line(left, y, right, y, y % 56 ? '#32405c' : '#667084');
    for (let x = left + 48; x < right; x += 108 + perspective * 105)
      r.line(x, y, 800 + (x - 800) * 1.12, Math.min(H, y + 28), '#26334d');
  }
  for (let i = 0; i < 11; i++) {
    const y = 485 + i * 19;
    const inset = 3 + i * 9;
    r.line(800 - inset, y, 800 + inset, y, i % 2 ? '#756041' : '#a88851');
  }
  r.ellipse(800, 526, 194, 40, '#11182d');
  r.ellipse(800, 518, 174, 31, '#5c472e');
  r.ellipse(800, 513, 157, 24, '#26334d');
  r.ellipse(800, 508, 132, 16, '#916c36');
  r.ellipse(800, 505, 115, 11, '#192544');
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16;
    const x = Math.round(800 + Math.cos(a) * 146);
    const y = Math.round(513 + Math.sin(a) * 20);
    star(r, x, y, i % 4 === 0 ? 3 : 1, i % 4 === 0 ? C.bright : '#bb9a5c');
  }

  // Main bronze merkhet: twin uprights, weighted sightline and rotating star plate.
  r.fillPolygon([[650, 505], [692, 436], [908, 436], [950, 505]], '#17203a');
  r.ellipse(800, 453, 118, 31, '#171d2e');
  r.ellipse(800, 446, 106, 25, '#8e5f2d');
  r.ellipse(800, 441, 95, 18, '#d2a259');
  r.ellipse(800, 437, 82, 13, '#1b2948');
  for (let i = 0; i < 32; i++) {
    const a = i * Math.PI / 16;
    const ix = Math.round(800 + Math.cos(a) * 88);
    const iy = Math.round(439 + Math.sin(a) * 16);
    r.line(ix, iy, ix + Math.round(Math.cos(a) * 7), iy + Math.round(Math.sin(a) * 4), '#f1cd83');
  }
  r.rect(788, 315, 24, 132, '#6e4827');
  r.rect(793, 318, 8, 126, '#d7a95d');
  r.rect(799, 319, 3, 124, '#f0d18d');
  r.fillPolygon([[780, 323], [800, 282], [820, 323]], '#9f7139');
  r.fillPolygon([[788, 312], [800, 292], [812, 312]], '#f5dd9e');
  r.line(672, 386, 928, 386, '#8c602e', 230);
  r.rect(674, 379, 252, 10, '#bc8b43');
  r.rect(686, 381, 228, 3, '#f4d18b');
  for (const x of [676, 924]) {
    r.ellipse(x, 385, 10, 14, '#d5a557');
    r.ellipse(x, 385, 4, 8, '#30243a');
  }
  r.ellipse(800, 435, 17, 12, '#d8b36a');
  star(r, 800, 432, 5, '#fff0b2', 8);

  // Door back toward the entrance hall, drawn as a dark return arch.
  r.fillPolygon([[0, 236], [20, 196], [174, 196], [198, 236], [198, 476], [0, 476]], '#0c1122');
  r.fillPolygon([[10, 466], [10, 262], [32, 224], [164, 224], [186, 262], [186, 466]], '#182542');
  r.fillPolygon([[25, 454], [25, 271], [45, 242], [151, 242], [171, 271], [171, 454]], '#070b16');
  r.line(17, 460, 17, 260, '#bf9457'); r.line(17, 260, 34, 226, '#edca84');
  r.line(34, 226, 164, 226, '#8792a6'); r.line(164, 226, 181, 260, '#bf9457');
  r.line(181, 260, 181, 460, '#6e778c');
  r.rect(52, 469, 78, 5, '#ba8743');

  // Dust, worn joints and tiny lapis tesserae are seeded, sparse and deliberate.
  for (let i = 0; i < 500; i++) {
    const x = Math.floor(rand() * W), y = 195 + Math.floor(rand() * 430);
    if (rand() > 0.78) r.set(x, y, rand() > 0.5 ? '#71809a' : '#a5895c', 92);
  }
  return r;
}

function paintSky() {
  const r = new Raster(W, H);
  const rand = rng(0x5a7f11d);
  // A slim, lightless void seen through the opened roof, then brought to life.
  r.fillPolygon([[580, 0], [1020, 0], [957, 165], [643, 165]], '#0a1026');
  r.fillPolygon([[630, 0], [970, 0], [927, 148], [673, 148]], '#111c3a');
  for (let i = 0; i < 180; i++) {
    const y = Math.floor(rand() * 145);
    const half = 170 - y * 0.36;
    const x = Math.round(800 + (rand() * 2 - 1) * half);
    if (y > 12) star(r, x, y, rand() > 0.965 ? 3 : rand() > 0.75 ? 2 : 1, rand() > 0.82 ? C.bright : '#b5c8df', 8);
  }
  return r;
}

function paintConstellation() {
  const r = new Raster(W, H);
  // The true pattern is a distinctive five-star reed bird, revealed by solving.
  const points = [[784, 37], [800, 64], [816, 37], [816, 16], [784, 88]];
  r.line(points[0][0], points[0][1], points[1][0], points[1][1], '#7288a8', 130);
  r.line(points[1][0], points[1][1], points[2][0], points[2][1], '#7288a8', 130);
  r.line(points[2][0], points[2][1], points[3][0], points[3][1], '#7288a8', 130);
  r.line(points[0][0], points[0][1], points[4][0], points[4][1], '#7288a8', 130);
  for (const [x, y] of points) star(r, x, y, 3, '#fff2ca', 8);
  return r;
}

function paintShutter(side) {
  const r = new Raster(260, 190);
  const panel = side === 'left'
    ? [[0, 0], [195, 0], [170, 190], [15, 190]]
    : [[65, 0], [260, 0], [245, 190], [90, 190]];
  r.fillPolygon(panel, '#080d1c');
  r.fillPolygon(side === 'left'
    ? [[0, 0], [188, 0], [164, 184], [19, 184]]
    : [[72, 0], [260, 0], [241, 184], [96, 184]], '#253250');
  for (let y = 18; y < 186; y += 27) {
    const inset = Math.floor((y / 190) * 28);
    r.line(side === 'left' ? inset : 260 - inset, y, side === 'left' ? 184 - inset : 76 + inset, y + 4, '#61718b');
  }
  for (let i = 0; i < 5; i++) {
    const x = side === 'left' ? 34 + i * 38 : 226 - i * 38;
    r.ellipse(x, 96, 10, 17, '#8e5f30');
    r.ellipse(x, 96, 4, 9, '#e2bb6b');
  }
  r.line(side === 'left' ? 190 : 70, 0, side === 'left' ? 166 : 94, 190, '#d1a45c');
  return r;
}

function paintGlow() {
  const r = new Raster(W, H);
  for (const [cx, cy, radius, color] of [[800, 437, 88, '#3b8bba'], [800, 95, 270, '#4269bd'], [325, 404, 130, '#b5753c'], [1396, 404, 130, '#b5753c']]) {
    for (let y = cy - radius; y <= cy + radius; y++) for (let x = cx - radius; x <= cx + radius; x++) {
      if (!r.inside(x, y)) continue;
      const d = Math.hypot(x - cx, y - cy) / radius;
      if (d >= 1) continue;
      const a = Math.round((1 - d) ** 2 * 74);
      if (a > 0) r.set(x, y, color, a);
    }
  }
  return r;
}

function paintForeground() {
  const r = new Raster(W, 86);
  r.fillPolygon([[0, 28], [112, 12], [202, 26], [306, 9], [392, 29], [506, 13], [602, 24], [720, 11], [844, 27], [955, 10], [1098, 25], [1200, 7], [1326, 23], [1430, 11], [1600, 28], [1600, 86], [0, 86]], '#101a31');
  for (let x = 0; x < W; x += 28) {
    const y = 28 + (x * 19 % 18);
    r.line(x, y, Math.min(W, x + 25), y - 1, '#273750');
  }
  return r;
}

function paintInstrumentCloseup() {
  const w = 960, h = 540, r = new Raster(w, h), rand = rng(0x1a57e);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const center = 1 - Math.min(1, Math.hypot((x - 480) / 550, (y - 270) / 360));
    const beam = Math.max(0, 1 - Math.abs(x - 480) / 240) * 0.08;
    const n = fbm(x / 38, y / 31, 32, 2) * 0.06;
    r.set(x, y, mix(hex('#0d1427'), hex('#324368'), Math.max(0, center * 0.62 + beam + n)));
  }
  r.fillPolygon([[0, 0], [380, 0], [400, 222], [318, 296], [0, 310]], '#151d36');
  r.fillPolygon([[960, 0], [580, 0], [560, 222], [642, 296], [960, 310]], '#151d36');
  for (const cx of [48, 912]) {
    r.ellipse(cx, 115, 80, 108, '#161d34');
    for (let i = 0; i < 6; i++) r.line(cx - 58 + i * 22, 20, cx - 58 + i * 22, 210, '#405271');
    star(r, cx, 52, 5, '#e3c47e');
  }
  // Looming bronze disc, three machined rings and a weighted vertical sight.
  r.ellipse(480, 309, 288, 190, '#11192d');
  r.ellipse(480, 294, 268, 178, '#553b27');
  r.ellipse(480, 288, 254, 164, '#c09149');
  r.ellipse(480, 280, 236, 148, '#493b34');
  r.ellipse(480, 274, 219, 132, '#192947');
  r.ellipse(480, 270, 198, 114, '#b07f3d');
  r.ellipse(480, 265, 185, 103, '#121c35');
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x1 = 480 + Math.cos(a) * 198, y1 = 270 + Math.sin(a) * 114;
    const x2 = 480 + Math.cos(a) * (i % 4 === 0 ? 220 : 208), y2 = 270 + Math.sin(a) * (i % 4 === 0 ? 127 : 120);
    r.line(x1, y1, x2, y2, i % 4 === 0 ? '#f4d48e' : '#765636');
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.round(480 + Math.cos(a) * 172), y = Math.round(270 + Math.sin(a) * 95);
    star(r, x, y, i % 3 === 0 ? 5 : 3, i % 3 === 0 ? '#f8e2a6' : '#b5c7dd');
  }
  r.rect(466, 111, 28, 163, '#6d4727');
  r.rect(471, 105, 8, 170, '#d8ad68');
  r.rect(479, 105, 4, 170, '#f3d698');
  r.fillPolygon([[448, 127], [480, 70], [512, 127]], '#c69143');
  r.fillPolygon([[463, 116], [480, 82], [497, 116]], '#f2d68e');
  r.line(220, 229, 740, 229, '#8b602e');
  r.rect(221, 222, 518, 13, '#bd8a42');
  r.rect(236, 225, 488, 4, '#f1d08a');
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(rand() * w), y = Math.floor(rand() * h);
    if (rand() > 0.65) r.set(x, y, '#8e99ad', 68);
  }
  return r;
}

export function chamberLayers() {
  return {
    room: paintRoom(), sky: paintSky(), constellation: paintConstellation(),
    shutterLeft: paintShutter('left'), shutterRight: paintShutter('right'),
    glow: paintGlow(), foreground: paintForeground(), instrument: paintInstrumentCloseup(),
  };
}
