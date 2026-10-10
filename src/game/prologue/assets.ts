import Phaser from 'phaser';

export const PROLOGUE_TEXTURES = [
  'ext-sky',
  'ext-far',
  'ext-main',
  'ext-door',
  'ext-passage',
  'ext-eye-lit',
  'ext-front',
  'pz-bg',
  'pz-cradle',
  'pz-pedestal',
  'pz-eye-lit',
  'attic',
  'attic-box-closed',
  'attic-box-open',
  'attic-shaft',
  'note',
  'map',
  'map-pins',
  'travel-dunes',
  'travel-jeep',
  'plane',
  'title-near',
  'title-far',
  'title-sky-ext',
  'title-sand-ext',
] as const;

export type PrologueTexture = (typeof PROLOGUE_TEXTURES)[number];

export function assetUrl(name: string) {
  return `${import.meta.env.BASE_URL}assets/prologue/${name}.png`;
}

export function preloadPrologue(
  scene: Phaser.Scene,
  names: readonly PrologueTexture[] = PROLOGUE_TEXTURES,
) {
  for (const name of names)
    if (!scene.textures.exists(name)) scene.load.image(name, assetUrl(name));
  if (!scene.textures.exists('px')) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xffffff, 1);
    g.fillRect(0, 0, 1, 1);
    g.generateTexture('px', 1, 1);
    g.destroy();
  }
}

/** Nearest-neighbour filtering keeps the authored pixels crisp. */
export function crispen(scene: Phaser.Scene) {
  for (const name of [...PROLOGUE_TEXTURES, 'px'])
    if (scene.textures.exists(name))
      scene.textures.get(name).setFilter(Phaser.Textures.FilterMode.NEAREST);
}

/** Cover-fit zoom so authored art keeps its scale and never letterboxes. */
export function coverZoom(
  viewW: number,
  viewH: number,
  artW: number,
  artH: number,
) {
  return Math.max(viewW / artW, viewH / artH);
}

export function setPixelMode(enabled: boolean) {
  document.body.classList.toggle('pixel-mode', enabled);
}
