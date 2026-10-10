import Phaser from 'phaser';
import { renderMiniature } from '../artifact/miniatureRenderer';
import type {
  MiniatureRender,
  MiniatureView,
} from '../artifact/miniatureRenderer';

/** Keeps a Phaser canvas texture in sync with the software-rendered miniature. */
export class MiniatureTexture {
  readonly key: string;
  private texture: Phaser.Textures.CanvasTexture;
  private lastSignature = '';
  last?: MiniatureRender;

  constructor(scene: Phaser.Scene, key: string, size: number) {
    this.key = key;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.texture = scene.textures.createCanvas(key, size, size)!;
    this.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  update(view: Omit<MiniatureView, 'size'>) {
    const size = this.texture.width;
    const signature = [
      view.yaw.toFixed(1),
      view.pitch.toFixed(1),
      (view.glow ?? 0).toFixed(2),
      view.light.x.toFixed(2),
      view.light.y.toFixed(2),
      view.light.z.toFixed(2),
    ].join('|');
    if (signature === this.lastSignature && this.last) return this.last;
    this.lastSignature = signature;
    const render = renderMiniature({ ...view, size });
    const ctx = this.texture.getContext();
    const image = ctx.createImageData(size, size);
    image.data.set(render.data);
    ctx.putImageData(image, 0, 0);
    this.texture.refresh();
    this.last = render;
    return render;
  }
}

/** Draws the miniature into a plain DOM canvas (inventory inspector). */
export function paintMiniatureCanvas(
  canvas: HTMLCanvasElement,
  view: Omit<MiniatureView, 'size'>,
) {
  const size = canvas.width;
  const render = renderMiniature({ ...view, size });
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = ctx.createImageData(size, size);
  image.data.set(render.data);
  ctx.clearRect(0, 0, size, size);
  ctx.putImageData(image, 0, 0);
}
