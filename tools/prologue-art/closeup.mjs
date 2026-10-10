// Close-up for "Ögats ljus": standing at the pedestal, looking up at the
// shaded front face with the carved eye. Same materials, signs and light as
// the panorama, at a closer scale.
import { Raster, rampColor, fbm, rng, hex, bayer, mix } from './raster.mjs';
import { LAYOUT, carveGlyph, forEachGlyphPixel } from './glyphs.mjs';
import { PAL, paintFace, carvedPanel, paintSky } from './exterior.mjs';

const C = LAYOUT.closeup;
const W = C.width;
const H = C.height;

export function paintCloseupBackground() {
  const r = new Raster(W, H);
  // Sky, with the sun just outside the top-right corner.
  r.draw(paintSky(W, H, { x: 690, y: -10 }), 0, 0);
  const base = C.facadeBaseY;
  const face = [
    [-60, base],
    [700, base],
    [320, C.apexY],
  ];
  const facade = new Raster(W, H);
  paintFace(
    facade,
    face,
    PAL.front,
    (x, y) => 0.5 + (x - 320) / 2400 - (base - y) / 2600,
    12,
    { courseScale: 1.6, mortar: 0.26 },
  );
  // Sunlit edge of the face catching light on the right.
  for (let y = 0; y < base; y++) {
    const ex = Math.round(-60 + ((base - y) / (base - C.apexY)) * 380);
    const rx = Math.round(700 - ((base - y) / (base - C.apexY)) * 380);
    for (let k = 0; k < 3; k++) {
      facade.tint(rx - k, y, '#f1c98e', 0.45 - k * 0.12);
      facade.tint(ex + k, y, '#2a2030', 0.2);
    }
  }
  // Eye cartouche, chevron stones, lintel frieze and the concealed slab.
  const eye = C.eye;
  const size = 16 * eye.scale;
  const ex = eye.x - size / 2;
  const ey = eye.y - size / 2;
  for (let k = 0; k < 3; k++) {
    const off = 8 + k * 7;
    for (let t = 0; t < 4; t++) {
      facade.line(
        eye.x - 56,
        ey - off + 8 + t,
        eye.x,
        ey - 34 - off + t,
        t === 0 ? '#c2a088' : '#5b4550',
      );
      facade.line(
        eye.x + 56,
        ey - off + 8 + t,
        eye.x,
        ey - 34 - off + t,
        t === 0 ? '#a88a78' : '#4d3c48',
      );
    }
  }
  carvedPanel(facade, ex - 10, ey - 7, size + 20, size + 12);
  carveGlyph(facade, 'eye', ex, ey, eye.scale, {
    depth: 0.52,
    lipAmount: 0.28,
  });

  const f = C.frieze;
  const fw = f.glyphs.length * 16 * f.scale + (f.glyphs.length - 1) * f.gap;
  const fx = Math.round(320 - fw / 2);
  for (let yy = f.y - 4; yy < f.y + 16 * f.scale + 4; yy++)
    for (let xx = fx - 10; xx < fx + fw + 10; xx++) {
      const t = 0.6 + (fbm(xx / 8, yy / 5, 9, 2) - 0.5) * 0.12;
      facade.set(xx, yy, rampColor(PAL.front, t, xx, yy, 0.7));
      if (yy === f.y - 4) facade.set(xx, yy, '#c6a389');
      if (yy === f.y + 16 * f.scale + 3) facade.set(xx, yy, '#2b212c');
    }
  f.glyphs.forEach((name, i) => {
    const gx = fx + i * (16 * f.scale + f.gap);
    carveGlyph(facade, name, gx, f.y, f.scale, {
      depth: 0.5,
      shadow: hex('#1f3a52'),
    });
    const rand = rng(200 + i);
    for (let yy = 0; yy < 32; yy++)
      for (let xx = 0; xx < 32; xx++)
        if (rand() < 0.06) facade.tint(gx + xx, f.y + yy, '#3f8790', 0.2);
  });
  const d = C.door;
  for (let yy = d.y; yy < base; yy++) {
    facade.tint(d.x - 1, yy, '#1f171f', 0.18);
    facade.tint(d.x + d.width, yy, '#e0bd98', 0.08);
  }
  r.draw(facade, 0, 0);

  // Sand terrace in front of the pyramid.
  for (let y = base; y < H; y++)
    for (let x = 0; x < W; x++) {
      const depth = (y - base) / (H - base);
      const ripple = Math.sin(
        y * (1.1 - depth * 0.5) + fbm(x / 60, y / 12, 4, 3) * 7,
      );
      let t = 0.52 + (fbm(x / 120, y / 26, 21, 3) - 0.5) * 0.4 + depth * 0.3;
      if (ripple > 0.9) t -= 0.12;
      else if (ripple > 0.6) t += 0.05;
      // The pyramid's shade spills over the near sand on the left.
      const shade = y < base + 30 - (x - 320) * 0.15 ? 0.55 : 0;
      const c = rampColor(PAL.sandLit, t, x, y, 1);
      r.set(x, y, shade ? mix(c, '#4b3a52', 0.32 * (1 - depth)) : c);
    }
  for (let x = 0; x < W; x++) r.tint(x, base, '#2a2030', 0.4);
  // Low drift at the foot of the façade.
  for (let x = 0; x < W; x++) {
    const h = Math.round(4 + fbm(x / 30, 1, 77, 2) * 8);
    for (let y = base - h; y < base + 2; y++)
      r.set(x, y, rampColor(PAL.sandLit, 0.55 - (y - base + h) / 24, x, y, 1));
  }
  // Sun glare in the corner.
  for (let y = 0; y < 120; y++)
    for (let x = 480; x < W; x++) {
      const dd = Math.hypot(x - 690, y + 10) / 200;
      if (dd < 1 && (1 - dd) ** 2 > bayer(x, y) * 0.8)
        r.tint(x, y, '#fff2cf', 0.35 * (1 - dd));
    }
  return r;
}

/** Bronze cradle part that sits behind the miniature. */
export function paintCradleBack() {
  const r = new Raster(W, H);
  const cx = C.cradle.x;
  const cy = C.cradle.y;
  for (let i = -30; i <= 30; i++) {
    const y = cy - 2 - Math.round(Math.sqrt(900 - i * i) * 0.22);
    for (let k = 0; k < 3; k++)
      r.set(
        cx + i,
        y + k,
        rampColor(
          PAL.bronze,
          0.25 + (i + 30) / 110 - k * 0.08,
          cx + i,
          y + k,
          0.6,
        ),
      );
  }
  return r;
}

/** Pedestal and front lip of the cradle, drawn over the miniature's base. */
export function paintPedestal() {
  const r = new Raster(W, H);
  const cx = C.cradle.x;
  const top = C.cradle.y + 12;
  // Column.
  for (let y = top + 14; y < H; y++)
    for (let x = cx - 34; x < cx + 34; x++) {
      const across = (x - (cx - 34)) / 68;
      let t = 0.16 + across * 0.8;
      if ((x - cx + 34) % 9 === 0) t -= 0.1;
      t += (fbm(x / 6, y / 8, 15, 2) - 0.5) * 0.12;
      r.set(
        x,
        y,
        rampColor(
          across > 0.5 ? PAL.right : PAL.front,
          across > 0.5 ? t - 0.12 : t + 0.3,
          x,
          y,
          0.7,
        ),
      );
    }
  carveGlyph(r, 'eye', cx - 16, top + 30, 2, { depth: 0.48 });
  // Capital slab.
  for (let y = top; y < top + 14; y++)
    for (let x = cx - 52; x < cx + 52; x++) {
      const across = (x - (cx - 52)) / 104;
      const tread = y < top + 4;
      const t = tread ? 0.72 + across * 0.2 : 0.3 + across * 0.55;
      r.set(x, y, rampColor(tread ? PAL.sandLit : PAL.right, t, x, y, 0.7));
    }
  for (let x = cx - 52; x < cx + 52; x++) r.set(x, top + 13, '#3b2b33');
  // Cradle front lip with two uprights.
  for (let i = -30; i <= 30; i++) {
    const y = C.cradle.y + 2 + Math.round(Math.sqrt(900 - i * i) * 0.24);
    for (let k = 0; k < 4; k++)
      r.set(
        cx + i,
        y + k,
        rampColor(
          PAL.bronze,
          0.42 + (i + 30) / 90 - k * 0.1,
          cx + i,
          y + k,
          0.6,
        ),
      );
  }
  for (const side of [-1, 1]) {
    const x0 = cx + side * 30;
    for (let y = C.cradle.y - 6; y < top + 2; y++) {
      r.set(x0, y, rampColor(PAL.bronze, side > 0 ? 0.85 : 0.35, x0, y, 0.5));
      r.set(
        x0 + side,
        y,
        rampColor(PAL.bronze, side > 0 ? 0.6 : 0.2, x0, y, 0.5),
      );
    }
    r.set(x0, C.cradle.y - 7, '#fbe3a6');
  }
  r.outline(hex('#21171d'));
  return r;
}

export function paintCloseupEyeLit() {
  const eye = C.eye;
  const size = 16 * eye.scale;
  const pad = 20;
  const r = new Raster(size + pad * 2, size + pad * 2);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const dd = Math.hypot(x - r.width / 2, y - r.height / 2) / (r.width / 2);
      if (dd < 1 && (1 - dd) ** 1.4 > bayer(x, y) * 0.9)
        r.set(x, y, '#ffd98a', Math.round(130 * (1 - dd)));
    }
  forEachGlyphPixel('eye', eye.scale, (x, y, n) => {
    if (n.code === '#')
      r.set(pad + x, pad + y, n.above !== '#' ? '#fff3c9' : '#ffd77a');
    if (n.code === '*') r.set(pad + x, pad + y, '#ffffff');
  });
  return r;
}
