import Phaser from 'phaser';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { TEXT } from '../prologue/content';
import { Overlay } from '../prologue/overlay';
import { prefersReducedMotion, progress } from '../prologue/progress';

/**
 * Labelled hand-off to the future Chapter 1 entrance hall. The interior is
 * intentionally not designed yet; this keeps the transition playable.
 */
export class Chapter1GateScene extends Phaser.Scene {
  private overlay!: Overlay;

  constructor() {
    super('chapter1-gate');
  }

  preload() {
    preloadPrologue(this, ['ext-passage']);
  }

  create() {
    crispen(this);
    setPixelMode(true);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#040608');
    const draw = () => {
      this.children.removeAll(true);
      const { width: w, height: h } = this.scale;
      const scale = Math.max(2, Math.floor(Math.min(w / 36, h / 48) * 0.9));
      const passage = this.add
        .image(w / 2, h * 0.42, 'ext-passage')
        .setScale(scale);
      const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      for (let i = 16; i > 0; i--) {
        glow.fillStyle(0x3d8b98, 0.012);
        glow.fillCircle(passage.x, passage.y + 3 * scale, i * 4 * (scale / 4));
      }
      this.add.particles(0, 0, 'px', {
        x: { min: passage.x - 10 * scale, max: passage.x + 10 * scale },
        y: { min: passage.y - 14 * scale, max: passage.y + 20 * scale },
        lifespan: 3000,
        speedY: { min: -12, max: -2 },
        speedX: { min: -6, max: 6 },
        scale: scale / 2,
        alpha: {
          start: 0,
          end: 0,
          ease: (v: number) => Math.sin(v * Math.PI) * 0.5,
        },
        tint: 0x8fd6dc,
        frequency: prefersReducedMotion() ? 600 : 160,
        blendMode: Phaser.BlendModes.ADD,
      });
    };
    draw();
    this.scale.on(Phaser.Scale.Events.RESIZE, draw);
    this.overlay = new Overlay('pro-gate-ui');
    const wrap = this.overlay.element('div', 'pro-gate');
    const h1 = this.overlay.element('h1', '', wrap);
    h1.textContent = TEXT.gate.title;
    const p = this.overlay.element('p', '', wrap);
    p.textContent = TEXT.gate.body;
    const row = this.overlay.element('div', 'pro-row', wrap);
    const out = this.overlay.button(
      TEXT.ui.goOutside,
      () => this.leave('exterior'),
      'pro-btn pro-btn-primary',
      row,
    );
    this.overlay.button(
      TEXT.ui.toTitle,
      () => this.leave('title'),
      'pro-btn',
      row,
    );
    queueMicrotask(() => out.focus({ preventScroll: true }));
    this.overlay.announce(`${TEXT.gate.title}. ${TEXT.gate.body}`);
    void progress.load().then(() => progress.advanceTo('chapter1-gate'));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, draw);
      this.overlay.destroy();
    });
    cam.fadeIn(900, 4, 6, 8);
  }

  private leave(key: string) {
    this.overlay.destroy();
    this.cameras.main.fadeOut(500, 4, 6, 8);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start(key),
    );
  }
}
