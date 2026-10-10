// Deterministic generator for the ENIGMA prologue pixel art.
// Usage: node tools/generate-prologue-art.mjs [--preview <dir>]
// Writes layered PNGs to public/assets/prologue/. With --preview it also
// writes flattened composites (scaled 2x) for visual review.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, LAYOUT } from './prologue-art/glyphs.mjs';
import { Raster } from './prologue-art/raster.mjs';
import * as ext from './prologue-art/exterior.mjs';
import * as closeup from './prologue-art/closeup.mjs';
import * as story from './prologue-art/story.mjs';

const OUT = path.join(ROOT, 'public/assets/prologue');
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
  const base = new Raster(layers[0].raster.width, layers[0].raster.height);
  for (const { raster, x = 0, y = 0 } of layers) base.draw(raster, x, y);
  upscale(base, factor).savePng(path.join(previewDir, `${name}.png`));
}

console.log('Exterior');
const P = LAYOUT.panorama;
const sky = ext.paintSky();
const far = ext.paintFar();
const main = ext.paintMain();
const slab = ext.cutDoor(main);
const passage = ext.paintPassage();
const eyeLit = ext.paintEyeLit();
const front = ext.paintFront();
save('ext-sky', sky);
save('ext-far', far);
save('ext-main', main);
save('ext-door', slab);
save('ext-passage', passage);
save('ext-eye-lit', eyeLit);
save('ext-front', front);
preview('exterior', [
  { raster: sky },
  { raster: far },
  { raster: passage, x: P.door.x, y: P.door.y },
  { raster: slab, x: P.door.x, y: P.door.y },
  { raster: main },
  { raster: front },
]);
preview('exterior-open', [
  { raster: sky },
  { raster: far },
  { raster: passage, x: P.door.x, y: P.door.y },
  { raster: main },
  {
    raster: eyeLit,
    x: P.eye.x - eyeLit.width / 2,
    y: P.eye.y - eyeLit.height / 2,
  },
  { raster: front },
]);

console.log('Close-up');
const pzBg = closeup.paintCloseupBackground();
const pzCradle = closeup.paintCradleBack();
const pzPedestal = closeup.paintPedestal();
const pzEye = closeup.paintCloseupEyeLit();
save('pz-bg', pzBg);
save('pz-cradle', pzCradle);
save('pz-pedestal', pzPedestal);
save('pz-eye-lit', pzEye);
preview('closeup', [
  { raster: pzBg },
  { raster: pzCradle },
  { raster: pzPedestal },
]);

console.log('Story');
const attic = story.paintAttic();
const boxClosed = story.paintBox(false);
const boxOpen = story.paintBox(true);
const shaft = story.paintShaft();
save('attic', attic);
save('attic-box-closed', boxClosed);
save('attic-box-open', boxOpen);
save('attic-shaft', shaft);
save('note', story.paintNote());
save('map', story.paintMap());
save('map-pins', story.paintMapPins());
save('travel-dunes', story.paintTravelDunes());
save('travel-jeep', story.paintTravelJeep());
save('plane', story.paintPlane());
preview('attic', [
  { raster: attic },
  { raster: shaft },
  { raster: boxOpen, x: 230, y: 330 - boxOpen.height },
]);
preview('map', [{ raster: story.paintMap() }]);
preview('note', [{ raster: story.paintNote() }], 3);
preview('travel', [
  { raster: ext.paintSky() },
  { raster: ext.paintFar(1280, 360, 8, false) },
  { raster: story.paintTravelDunes() },
  { raster: story.paintTravelJeep(), x: 600, y: 270 },
]);

console.log('Title');
// Solid silhouettes for the dawn title (works in WebGL and Canvas renderers).
function silhouette(layers, color, rim) {
  const out = new Raster(P.width, P.height);
  for (const { raster, x = 0, y = 0 } of layers)
    for (let yy = 0; yy < raster.height; yy++)
      for (let xx = 0; xx < raster.width; xx++)
        if (raster.get(xx, yy)[3] > 0) out.set(x + xx, y + yy, color);
  // Faint dawn rim along upper edges facing the light.
  for (let yy = 1; yy < P.height; yy++)
    for (let xx = 0; xx < P.width; xx++)
      if (out.alpha(xx, yy) && !out.alpha(xx, yy - 1)) out.set(xx, yy, rim);
  return out;
}
save(
  'title-near',
  silhouette(
    [
      { raster: main },
      { raster: slab, x: P.door.x, y: P.door.y },
      { raster: front },
    ],
    [20, 15, 28],
    [92, 62, 70],
  ),
);
save('title-far', silhouette([{ raster: far }], [44, 36, 58], [96, 72, 84]));

// Portrait title extensions: sky above and sand below the panorama art.
{
  const skyExt = new Raster(P.width, 240);
  const top = sky.get(0, 0);
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < P.width; x++) {
      const t = y / 239;
      const c = [0, 1, 2].map((i) => Math.round(top[i] * (0.55 + 0.45 * t)));
      const d = ((x * 7 + y * 13) % 16) / 16;
      skyExt.set(x, y, t * 0.06 > d * 0.06 ? top : c);
    }
  save('title-sky-ext', skyExt);
  const sandExt = new Raster(P.width, 240);
  for (let y = 0; y < 240; y++)
    for (let x = 0; x < P.width; x++) {
      const c = main.get(x, P.height - 1 - ((y % 24) + 0));
      const fade = Math.min(1, y / 200);
      sandExt.set(
        x,
        y,
        [0, 1, 2].map((i) => Math.round(c[i] * (1 - fade * 0.45))),
      );
    }
  save('title-sand-ext', sandExt);
}
