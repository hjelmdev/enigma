import Phaser from 'phaser';
import { generateSealedSunArt, type SealedSunArt } from './art/generate.ts';
import type { PixelCanvas } from './art/pixelCanvas.ts';

let cached: SealedSunArt | null = null;

/** Generates the art once per page; later visits reuse it. */
export function getArt() {
  cached ??= generateSealedSunArt();
  return cached;
}

/** Uploads (or re-uploads) a pixel canvas as a nearest-filtered texture. */
export function uploadCanvas(
  scene: Phaser.Scene,
  key: string,
  canvas: PixelCanvas,
) {
  let texture = scene.textures.exists(key)
    ? (scene.textures.get(key) as Phaser.Textures.CanvasTexture)
    : null;
  if (
    texture &&
    (texture.width !== canvas.width || texture.height !== canvas.height)
  ) {
    scene.textures.remove(key);
    texture = null;
  }
  texture ??= scene.textures.createCanvas(key, canvas.width, canvas.height)!;
  texture.context.putImageData(
    new ImageData(
      new Uint8ClampedArray(canvas.data),
      canvas.width,
      canvas.height,
    ),
    0,
    0,
  );
  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return texture;
}

export function prefersReducedMotion() {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}
