// Deterministic generator for the ENIGMA Chapter 1 entrance-hall pixel art.
// Usage: node tools/generate-hall-art.mjs [--preview <dir>]
// Writes layered PNGs to public/assets/hall/. With --preview it also writes
// flattened composites (scaled 2x) for visual review.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, Raster, HALL_LAYOUT } from './hall-art/common.mjs';
import * as relief from './hall-art/relief.mjs';
import * as hall from './hall-art/hall.mjs';
import * as corridor from './hall-art/corridor.mjs';
import * as balance from './hall-art/balance.mjs';

const OUT = path.join(ROOT, 'public/assets/hall');
mkdirSync(OUT, { recursive: true });

const previewIndex = process.argv.indexOf('--preview');
const previewDir = previewIndex > 0 ? process.argv[previewIndex + 1] : null;
if (previewDir) mkdirSync(previewDir, { recursive: true });

function save(name, raster) {
  raster.savePng(path.join(OUT, `${name}.png`));
  console.log(`  ${name}.png ${raster.width}x${raster.height}`);
}

function upscale(raster, factor) {
  const out = new Raster(raster.width * factor, raster.height * factor);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const c = raster.get(Math.floor(x / factor), Math.floor(y / factor));
      if (c[3]) out.set(x, y, c, c[3]);
    }
  return out;
}

function preview(name, layers, factor = 2) {
  if (!previewDir) return;
  const w = Math.max(...layers.map((l) => (l.x ?? 0) + l.raster.width));
  const h = Math.max(...layers.map((l) => (l.y ?? 0) + l.raster.height));
  const base = new Raster(layers[0].w ?? w, layers[0].h ?? h);
  for (const { raster, x = 0, y = 0 } of layers) base.draw(raster, x, y);
  upscale(base, factor).savePng(path.join(previewDir, `${name}.png`));
}

console.log('Relief');
const CU = HALL_LAYOUT.closeup;
export const RELIEF_BOARD = { x: 144, y: 66, size: 192, frame: 16 };
const picture = relief.paintReliefPicture(192, { paint: 0.7 });
const tiles = relief.paintTileSheet(picture, 3, 3);
save('rel-tiles', tiles);
save('rel-picture', picture);
const reliefBg = relief.paintReliefCloseupBg(RELIEF_BOARD);
const reliefFrame = relief.paintReliefFrame(RELIEF_BOARD);
save('rel-bg', reliefBg);
save('rel-frame', reliefFrame);
save('rel-glow', relief.paintReliefCloseupGlow());
const miniPicture = relief.paintReliefPicture(72, { paint: 0.6 });
save('rel-mini', relief.paintTileSheet(miniPicture, 3, 3, { bevel: 1 }));
const painted = relief.paintReliefPicture(72, { paint: 1 });
save('rel-reference', painted);
save('rel-reference-large', relief.paintReliefPicture(192, { paint: 1 }));
{
  const layers = [{ raster: reliefBg, w: CU.width, h: CU.height }];
  for (let i = 0; i < 8; i++) {
    const t = tiles.crop(i * 64, 0, 64, 64);
    layers.push({
      raster: t,
      x: RELIEF_BOARD.x + (i % 3) * 64,
      y: RELIEF_BOARD.y + Math.floor(i / 3) * 64,
    });
  }
  layers.push({ raster: reliefFrame });
  preview('relief-closeup', layers, 2);
  preview('relief-picture', [{ raster: picture }], 3);
}

console.log('Hall');
{
  const H = HALL_LAYOUT.hall;
  const back = hall.paintHallBack(painted);
  const glowLayer = hall.paintHallGlow();
  const front = hall.paintHallFront();
  save('hall-back', back);
  save('hall-glow', glowLayer);
  save('hall-front', front);
  save('hall-niche-lit', hall.nicheMapLines());
  save('hall-pedestal-lit', hall.paintPedestalLit());
  const doorLayers = [];
  for (const [id, d] of Object.entries(H.doors)) {
    const slab = hall.paintSlab(id);
    const passage = hall.paintPassage(id);
    save(`${id}-slab`, slab);
    save(`${id}-passage`, passage);
    doorLayers.push(
      { raster: passage, x: d.x, y: d.y },
      { raster: slab, x: d.x, y: d.y },
    );
  }
  const mini = relief.paintReliefPicture(72, { paint: 0.6 });
  preview(
    'hall',
    [
      { raster: new Raster(H.width, H.height), w: H.width, h: H.height },
      ...doorLayers,
      { raster: back },
      { raster: mini, x: H.reliefPanel.x, y: H.reliefPanel.y },
      { raster: front, x: -hall.FRONT_PAD },
    ],
    1,
  );
  if (previewDir) {
    // Additive preview of the glow layer on top.
    const base = new Raster(H.width, H.height);
    for (const l of doorLayers) base.draw(l.raster, l.x, l.y);
    base.draw(back, 0, 0);
    base.draw(mini, H.reliefPanel.x, H.reliefPanel.y);
    for (let y = 0; y < H.height; y++)
      for (let x = 0; x < H.width; x++) {
        const g = glowLayer.get(x, y);
        if (!g[3]) continue;
        const c = base.get(x, y);
        const a = g[3] / 255;
        base.set(
          x,
          y,
          [0, 1, 2].map((i) => Math.min(255, c[i] + g[i] * a)),
        );
      }
    base.draw(front, -hall.FRONT_PAD, 0);
    upscale(base, 1).savePng(path.join(previewDir, 'hall-lit.png'));
  }
}

console.log('Corridor');
{
  const cor = corridor.paintCorridor();
  const corGlow = corridor.paintCorridorGlow();
  save('cor-main', cor);
  save('cor-glow', corGlow);
  preview('corridor', [{ raster: cor }], 2);
  console.log('  anchors', JSON.stringify(corridor.corridorAnchors()));
}

console.log('Balance');
{
  const bg = balance.paintBalanceBg();
  const parts = {
    'bal-bg': bg,
    'bal-post': balance.paintPost(),
    'bal-beam': balance.paintBeam(),
    'bal-pan': balance.paintPan(),
    'bal-vessel': balance.paintVessel(),
    'bal-lever': balance.paintLever(),
    'bal-lever-base': balance.paintLeverBase(),
    'bal-shelf': balance.paintShelf(),
    'bal-tablet': balance.paintTablet(),
    'bal-glow': balance.paintBalanceGlow(),
    'bal-lamps': balance.paintLamps(),
  };
  for (const kind of ['scarab', 'falcon', 'lotus']) {
    parts[`bal-w-${kind}`] = balance.paintWeight(kind);
    parts[`bal-s-${kind}`] = balance.paintCarvedSign(kind);
  }
  parts['bal-s-vessel'] = balance.paintCarvedSign('vessel', '#a8957c');
  for (const [name, raster] of Object.entries(parts)) save(name, raster);
  preview(
    'balance',
    [
      { raster: bg },
      { raster: parts['bal-lamps'] },
      { raster: parts['bal-tablet'], x: 20, y: 30 },
      { raster: parts['bal-s-scarab'], x: 40, y: 43 },
      { raster: parts['bal-s-lotus'], x: 110, y: 43 },
      { raster: parts['bal-post'] },
      { raster: parts['bal-beam'], x: 122, y: 144 },
      { raster: parts['bal-pan'], x: 86, y: 150 },
      { raster: parts['bal-pan'], x: 310, y: 150 },
      { raster: parts['bal-vessel'], x: 108, y: 168 },
      { raster: parts['bal-shelf'], x: 20, y: 316 },
      { raster: parts['bal-w-scarab'], x: 60, y: 290 },
      { raster: parts['bal-w-falcon'], x: 100, y: 290 },
      { raster: parts['bal-w-lotus'], x: 140, y: 290 },
      { raster: parts['bal-lever-base'], x: 410, y: 250 },
      { raster: parts['bal-lever'], x: 426, y: 190 },
    ],
    2,
  );
}
