/**
 * Writes every generated Sealed Sun layer to PNG for review or hand-off.
 *
 *   node tools/export-sealed-sun-art.ts [outDir]
 *
 * Requires Node 23.6+ (native TypeScript type stripping). The game itself
 * does not need these files: it runs the same generators in the browser.
 * Output defaults to ./sealed-sun-art (git-ignored). Each layer is written at
 * art resolution and at 4× nearest-neighbour for easy viewing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import {
  composePreview,
  generateSealedSunArt,
  sealPreview,
} from '../src/experiments/sealed-sun/art/generate.ts';
import type { PixelCanvas } from '../src/experiments/sealed-sun/art/pixelCanvas.ts';

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8ClampedArray) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function upscale(canvas: PixelCanvas, factor: number) {
  const w = canvas.width * factor;
  const h = canvas.height * factor;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si =
        ((Math.floor(y / factor) * canvas.width + Math.floor(x / factor)) * 4) |
        0;
      out.set(canvas.data.subarray(si, si + 4), (y * w + x) * 4);
    }
  }
  return { w, h, out };
}

const outDir = process.argv[2] ?? 'sealed-sun-art';
mkdirSync(outDir, { recursive: true });
const started = Date.now();
const art = generateSealedSunArt();
const previews = {
  ...art.layers,
  previewClosed: composePreview(art, 0),
  previewHalf: composePreview(art, 0.5),
  previewOpen: composePreview(art, 1, [0, 0, 0]),
  seal: sealPreview(art),
};
for (const [name, canvas] of Object.entries(previews)) {
  writeFileSync(
    join(outDir, `${name}.png`),
    encodePng(canvas.width, canvas.height, canvas.data),
  );
  const big = upscale(canvas, 4);
  writeFileSync(
    join(outDir, `${name}@4x.png`),
    encodePng(big.w, big.h, big.out),
  );
}
console.log(
  `Wrote ${Object.keys(art.layers).length} layers to ${outDir} in ${Date.now() - started} ms`,
);
