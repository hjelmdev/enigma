// "Vågens hemlighet" close-up parts: wall, carved tablets, the bronze balance
// as separate moving pieces (beam, pans, lever), the sealed vessel and the
// three sculpted weights. The game lays the pieces out and animates them; the
// relations themselves change per puzzle, so tablets are blank and the signs
// are separate carved sprites.
import {
  Raster,
  rampColor,
  fbm,
  hex,
  mix,
  STONE,
  PAL,
  HALL_LAYOUT,
  paintAshlar,
  makeLight,
  litColor,
  forHallGlyph,
  glow,
} from './common.mjs';

const C = HALL_LAYOUT.closeup;
const W = C.width;
const H = C.height;
const light = makeLight(
  [
    { x: 40, y: 104, r: 150, i: 0.36 },
    { x: 440, y: 104, r: 150, i: 0.36 },
    { x: 240, y: 210, r: 200, i: 0.26 },
  ],
  0.1,
);
const bronze = (x, y, t = 0, l = light) =>
  rampColor(PAL.bronze, 0.18 + l(x, y) * 0.8 + t, x, y, 0.8);

export function paintBalanceBg() {
  const r = new Raster(W, H);
  paintAshlar(r, 0, 0, W, H, light, 57, { courseH: 30, blockW: 64 });
  // Khekher frieze.
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < W; x++) {
      const cell = Math.floor(x / 9) % 3;
      const inCell = x % 9;
      let col = null;
      if (y < 2 || y > 10) col = '#1a1220';
      else if (inCell > 1 && inCell < 7)
        col = [PAL.lapis[3], PAL.ochreRed[3], PAL.turquoise[3]][cell];
      if (col) r.set(x, y, litColor(col, light(x, y) + 0.1, x, y));
    }
  // Floor and dais at the bottom.
  for (let y = 300; y < H; y++)
    for (let x = 0; x < W; x++) {
      let t =
        light(x, y) * 0.7 + 0.04 + (fbm(x / 20, y / 6, 3, 2) - 0.5) * 0.05;
      if (y === 300) t += 0.15;
      if (y === 301) t -= 0.1;
      r.set(x, y, rampColor(STONE, t, x, y, 0.85));
    }
  return r;
}

/** Blank carved tablet for one relation (signs are placed by the game). */
export function paintTablet(w = 150, h = 44) {
  const r = new Raster(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      let t = 0.62 + (fbm(x / 9, y / 7, 77, 2) - 0.5) * 0.06 - (y / h) * 0.08;
      if (d === 0) t = 0.12;
      else if (d === 1) t += y < 2 || x < 2 ? 0.12 : -0.18;
      else if (d < 4) t -= 0.12; // recessed field edge
      r.set(x, y, rampColor(STONE, t, x, y, 0.6));
    }
  // Small balance beam carved in the middle (=).
  const cx = Math.floor(w / 2);
  for (let y = 10; y < h - 8; y++) r.tint(cx, y, '#140f1c', 0.6);
  for (let x = cx - 7; x <= cx + 7; x++) r.tint(x, 12, '#140f1c', 0.6);
  for (let x = cx - 4; x <= cx + 4; x++) r.tint(x, h - 9, '#140f1c', 0.6);
  r.tint(cx, 9, '#ffe2b0', 0.3);
  return r;
}

/** A sign carved into a tablet, as an overlay sprite (18×18). */
export function paintCarvedSign(name, painted) {
  const r = new Raster(18, 18);
  const pig = painted ?? PAL.lapis[3];
  forHallGlyph(name, 1, (x, y, n) => {
    const px = x + 1;
    const py = y + 1;
    if (n.on) {
      const edge = !n.above || !n.left;
      r.set(px, py, edge ? '#1c1424' : mix(hex(pig), hex('#2a2238'), 0.25));
    } else if (n.above || n.left) {
      r.set(px, py, '#f2dcb0', 140);
    }
  });
  return r;
}

export function paintPost() {
  const r = new Raster(W, H);
  const px = 240;
  const top = 128;
  for (let y = top; y < 300; y++)
    for (let x = px - 7; x <= px + 7; x++) {
      const u = (x - px) / 7;
      r.set(x, y, bronze(x, y, u < -0.6 ? -0.25 : u > 0.5 ? 0.18 : u * 0.1));
    }
  // Stepped foot.
  for (let k = 0; k < 3; k++)
    for (let y = 290 + k * 4 - 12; y < 294 + k * 4 - 12 + 4; y++)
      for (let x = px - 22 - k * 8; x <= px + 22 + k * 8; x++)
        r.set(
          x,
          y,
          bronze(x, y, y === 290 + k * 4 - 12 ? 0.25 : -0.08 + (x - px) / 200),
        );
  // Falcon finial (scale 3) atop the post.
  forHallGlyph('falcon', 3, (x, y, n) => {
    if (!n.on) return;
    const xx = px - 24 + x;
    const yy = top - 52 + y;
    r.set(
      xx,
      yy,
      bronze(xx, yy, (n.above ? 0 : 0.25) + (x > 24 ? 0.1 : -0.05)),
    );
  });
  // Locking pin housing at the pivot.
  r.ellipse(px, 150, 9, 9, (x, y, d) => bronze(x, y, 0.3 - d * 0.4));
  return r;
}

/** Beam: 236×12, pivot at its centre. */
export function paintBeam() {
  const w = 236;
  const r = new Raster(w, 12);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < w; x++) {
      const u = Math.abs(x - w / 2) / (w / 2);
      const thick = 4 + (1 - u) * 2;
      if (Math.abs(y - 6) > thick) continue;
      let t = 0.45 - (y - 6) / 14;
      if (y <= 6 - thick + 1) t += 0.3;
      if (u > 0.94) t += 0.15;
      r.set(x, y, rampColor(PAL.bronze, t + 0.2, x, y, 0.7));
    }
  // Engraved line and hook rings at the ends.
  for (let x = 14; x < w - 14; x++) r.tint(x, 6, '#2a170c', 0.4);
  for (const ex of [6, w - 7])
    r.ellipse(ex, 6, 4, 4, (x, y, d) => (d < 0.45 ? null : hex(PAL.bronze[4])));
  r.ellipse(w / 2, 6, 5, 5, (x, y, d) =>
    d < 0.4 ? hex('#1a1210') : hex(PAL.bronze[5]),
  );
  return r;
}

/** Pan with three chains: 84×78, hook at (42, 0). */
export function paintPan() {
  const r = new Raster(84, 78);
  for (let y = 2; y < 66; y++) {
    const t = (y - 2) / 64;
    for (const end of [6, 42, 78]) {
      const x = Math.round(42 + (end - 42) * t);
      r.set(
        x,
        y,
        rampColor(PAL.bronze, 0.4 + (y % 3 === 0 ? 0.25 : 0), x, y, 0.6),
      );
    }
  }
  r.ellipse(42, 2, 3, 3, (x, y, d) => (d < 0.4 ? null : hex(PAL.bronze[4])));
  for (let y = 64; y < 78; y++) {
    const v = (y - 64) / 14;
    const half = 41 - v * v * 18;
    for (let x = Math.round(42 - half); x <= 42 + half; x++) {
      const u = (x - 42) / half;
      let t = 0.45 + u * 0.2 - v * 0.25;
      if (y === 64) t += 0.35;
      if (y === 65) t += 0.15;
      r.set(x, y, rampColor(PAL.bronze, t, x, y, 0.7));
    }
  }
  return r;
}

/** The sealed vessel: alabaster jar with a clay seal, 40×46. */
export function paintVessel() {
  const r = new Raster(40, 46);
  const body = (y) => {
    if (y < 6) return 6;
    if (y < 10) return 9;
    if (y < 12) return 7;
    const v = (y - 12) / 34;
    return (
      7 + Math.sin(Math.min(1, v * 1.15) * Math.PI) * 11 + (v > 0.85 ? -4 : 0)
    );
  };
  for (let y = 0; y < 46; y++) {
    const hw = body(y);
    for (let x = Math.round(20 - hw); x <= 20 + hw; x++) {
      const u = (x - 20) / hw;
      let t = 0.55 + u * 0.3 - (y > 40 ? 0.15 : 0);
      if (Math.abs(u) > 0.9) t -= 0.2;
      const ramp =
        y < 6
          ? ['#2a1a10', '#4a2e18', '#6b4421', '#8a5a2e', '#a8743c']
          : ['#2e2a34', '#5e5560', '#8f8478', '#b8aa92', '#d6caae'];
      r.set(x, y, rampColor(ramp, t, x, y, 0.7));
    }
  }
  // Cord binding and seal knot.
  for (let x = 12; x <= 28; x++) {
    r.set(x, 10, '#5a3a22');
    if (x % 3 === 0) r.set(x, 11, '#3a2416');
  }
  r.ellipse(20, 8, 2, 2, (x, y, d) =>
    d < 0.5 ? hex(PAL.ochreRed[3]) : hex(PAL.ochreRed[1]),
  );
  // Lug handles on the shoulders.
  for (const hx of [5, 34])
    for (let y = 14; y < 19; y++)
      r.set(hx, y, y === 14 ? '#b8aa92' : '#5e5560');
  // Carved vessel sign on the belly.
  forHallGlyph('vessel', 1, (x, y, n) => {
    if (n.on && (!n.above || !n.left)) r.tint(12 + x, 22 + y, '#3a3040', 0.35);
  });
  return r;
}

/** A sculpted weight: bronze disc with its sign in relief, 30×30. */
export function paintWeight(name) {
  const r = new Raster(30, 30);
  r.ellipse(15, 16, 14, 13.5, (x, y, d) => {
    const lx = (x - 15) / 14;
    const ly = (y - 16) / 13;
    let t = 0.5 - lx * 0.15 - ly * 0.25;
    if (d > 0.82) t -= 0.25;
    else if (d > 0.7) t += 0.2;
    return rampColor(PAL.bronze, t + 0.1, x, y, 0.6);
  });
  // Raised sign (lit top-left, shadow bottom-right).
  forHallGlyph(name, 1, (x, y, n) => {
    const px = 7 + x;
    const py = 8 + y;
    if (n.on)
      r.set(px, py, rampColor(PAL.bronze, n.above ? 0.72 : 0.92, px, py, 0.5));
    else if (n.above || n.left) r.tint(px, py, '#2a170c', 0.45);
  });
  // Contact shadow (separate soft ellipse at the base).
  return r;
}

/** Lever handle: 20×120, pivot at (10, 112). */
export function paintLever() {
  const r = new Raster(20, 120);
  for (let y = 14; y < 116; y++)
    for (let x = 7; x <= 12; x++) {
      const u = (x - 9.5) / 3;
      r.set(x, y, rampColor(PAL.bronze, 0.5 + u * 0.25 - y / 600, x, y, 0.6));
    }
  // Lapis knob.
  r.ellipse(10, 9, 8, 8, (x, y, d) =>
    rampColor(PAL.lapis, 0.85 - d * 0.5 - (x - 10 + (y - 9)) / 40, x, y, 0.6),
  );
  // Grip bindings.
  for (const y of [22, 26, 30])
    for (let x = 7; x <= 12; x++) r.set(x, y, '#3a2416');
  r.ellipse(10, 112, 7, 7, (x, y, d) =>
    d < 0.35 ? hex('#1a1210') : hex(PAL.bronze[4]),
  );
  return r;
}

/** Lever housing: a slotted stone block, 52×60. */
export function paintLeverBase() {
  const r = new Raster(52, 60);
  for (let y = 0; y < 60; y++)
    for (let x = 0; x < 52; x++) {
      let t = 0.48 + (fbm(x / 6, y / 6, 91, 2) - 0.5) * 0.06 - y / 300;
      if (y === 0) t += 0.15;
      if (x === 0) t += 0.08;
      if (x === 51) t -= 0.15;
      // Arc-shaped slot the handle travels along.
      const d = Math.hypot(x - 26, y - 52);
      if (d > 30 && d < 36 && y < 50) t = 0.08;
      r.set(x, y, rampColor(STONE, t, x, y, 0.6));
    }
  return r;
}

/** Shelf: long stone bench with a recess per weight slot, 440×40. */
export function paintShelf() {
  const r = new Raster(440, 40);
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 440; x++) {
      let t = 0.42 + (fbm(x / 10, y / 5, 61, 2) - 0.5) * 0.06;
      if (y < 3) t += 0.2;
      if (y === 3) t -= 0.12;
      if (y > 34) t -= 0.18;
      r.set(x, y, rampColor(STONE, t, x, y, 0.7));
    }
  return r;
}

/** Additive glows: lamps at the upper corners. */
export function paintBalanceGlow() {
  const r = new Raster(W, H);
  glow(r, 40, 100, 90, '#ff9a48', 0.35);
  glow(r, 440, 100, 90, '#ff9a48', 0.35);
  glow(r, 40, 96, 16, '#ffe2a0', 0.8);
  glow(r, 440, 96, 16, '#ffe2a0', 0.8);
  return r;
}

/** Lamp brackets drawn on the wall (static, in a separate layer). */
export function paintLamps() {
  const r = new Raster(W, H);
  for (const lx of [40, 440]) {
    for (let y = 104; y < 122; y++)
      for (let x = lx - 1; x <= lx + 1; x++) r.set(x, y, bronze(x, y, 0.1));
    for (let y = 98; y < 106; y++) {
      const w = 3 + (y - 98) * 1.2;
      for (let x = Math.round(lx - w); x <= lx + w; x++)
        r.set(x, y, bronze(x, y, (x - lx) / 20));
    }
  }
  return r;
}
