// Deterministic layered pixel art for Stjärnornas kammare.
// Usage: npm run generate:star-chamber-art [--preview <directory>]
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, Raster } from './hall-art/common.mjs';
import { chamberLayers } from './star-chamber/chamber.mjs';

const outDir = path.join(ROOT, 'public/assets/stars');
mkdirSync(outDir, { recursive: true });
const previewArg = process.argv.indexOf('--preview');
const previewDir = previewArg > 0 ? process.argv[previewArg + 1] : null;
if (previewDir) mkdirSync(previewDir, { recursive: true });

const layers = chamberLayers();
for (const [name, raster] of Object.entries(layers)) {
  raster.savePng(path.join(outDir, `${name}.png`));
  console.log(`  ${name}.png ${raster.width}x${raster.height}`);
}

if (previewDir) {
  const composite = (open) => {
    const base = new Raster(1600, 720);
    base.draw(layers.room, 0, 0);
    base.draw(layers.sky, 0, 0);
    if (open) base.draw(layers.constellation, 0, 0);
    else {
      base.draw(layers.shutterLeft, 575, 0);
      base.draw(layers.shutterRight, 765, 0);
    }
    base.draw(layers.glow, 0, 0);
    base.draw(layers.foreground, 0, 634);
    return base;
  };
  composite(false).savePng(path.join(previewDir, 'stars-chamber.png'));
  composite(true).savePng(path.join(previewDir, 'stars-open.png'));
  layers.instrument.savePng(path.join(previewDir, 'stars-instrument.png'));
}
