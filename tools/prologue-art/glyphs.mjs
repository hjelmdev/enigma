import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const sheet = JSON.parse(
  readFileSync(path.join(ROOT, 'src/game/artifact/glyphs.json'), 'utf8'),
);

export const GLYPHS = sheet.glyphs;
export const GLYPH_SIZE = sheet.size;

export const LAYOUT = JSON.parse(
  readFileSync(
    path.join(ROOT, 'src/game/prologue/exteriorLayout.json'),
    'utf8',
  ),
);

/** Visit each glyph cell with its code and its neighbours (for carving). */
export function forEachGlyphPixel(name, scale, visit) {
  const rows = GLYPHS[name];
  const at = (c, r) =>
    r < 0 || c < 0 || r >= GLYPH_SIZE || c >= GLYPH_SIZE ? '.' : rows[r][c];
  for (let r = 0; r < GLYPH_SIZE; r++)
    for (let c = 0; c < GLYPH_SIZE; c++)
      for (let sy = 0; sy < scale; sy++)
        for (let sx = 0; sx < scale; sx++) {
          const code = at(c, r);
          const above = sy > 0 ? code : at(c, r - 1);
          const below = sy < scale - 1 ? code : at(c, r + 1);
          const left = sx > 0 ? code : at(c - 1, r);
          const right = sx < scale - 1 ? code : at(c + 1, r);
          visit(c * scale + sx, r * scale + sy, {
            code,
            above,
            below,
            left,
            right,
          });
        }
}

/**
 * Carve a glyph into existing pixels: grooves are darkened, the upper inner
 * edge is in shadow and the lower lip catches light.
 */
export function carveGlyph(raster, name, ox, oy, scale, options = {}) {
  const shadow = options.shadow ?? [34, 24, 28];
  const lip = options.lip ?? [255, 230, 180];
  const inlay = options.inlay ?? null;
  const depth = options.depth ?? 0.55;
  forEachGlyphPixel(name, scale, (x, y, n) => {
    const px = ox + x;
    const py = oy + y;
    if (n.code === '#' || (n.code === '*' && !inlay)) {
      raster.tint(px, py, shadow, n.above !== n.code ? depth + 0.18 : depth);
    } else if (n.code === '*' && inlay) {
      raster.set(px, py, inlay(x, y));
    } else if (n.above === '#' || n.above === '*') {
      raster.tint(px, py, lip, options.lipAmount ?? 0.22);
    }
  });
}
