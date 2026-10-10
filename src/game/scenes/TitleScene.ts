import Phaser from 'phaser';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { TEXT } from '../prologue/content';
import { Overlay } from '../prologue/overlay';
import { openSettingsPanel } from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { stageIndex } from '../state/prologueSave';
import layout from '../prologue/exteriorLayout.json';

const P = layout.panorama;

/** Title: the pyramid as a silhouette slowly catching the dawn. */
export class TitleScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private night!: Phaser.GameObjects.Rectangle;
  private shadow: Array<
    Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle
  > = [];
  private dawn = { t: 0 };

  constructor() {
    super('title');
  }

  preload() {
    preloadPrologue(this, [
      'ext-sky',
      'ext-far',
      'ext-main',
      'ext-door',
      'ext-front',
      'title-near',
      'title-far',
      'title-sky-ext',
      'title-sand-ext',
      'note',
    ]);
  }

  create() {
    crispen(this);
    setPixelMode(true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#0d0b12');
    this.view = new ArtView(this, P.width, P.height, { x: 626, y: 190 });

    // Lit layers sit under pre-rendered silhouettes that fade as dawn arrives.
    // Sky and sand extend beyond the art so a tall portrait frame can show the
    // whole pyramid instead of a cropped slice.
    const ext = 240;
    this.add.rectangle(0, -ext * 4, P.width, ext * 3, 0x0e1729).setOrigin(0);
    this.add.image(0, -ext, 'title-sky-ext').setOrigin(0);
    this.add.image(0, 0, 'ext-sky').setOrigin(0);
    this.night = this.add
      .rectangle(0, -ext * 4, P.width, P.height + ext * 4, 0x111733)
      .setOrigin(0);
    this.add.image(0, 0, 'ext-far').setOrigin(0);
    const farShadow = this.add.image(0, 0, 'title-far').setOrigin(0);
    this.add.image(P.door.x, P.door.y, 'ext-door').setOrigin(0);
    this.add.image(0, 0, 'ext-main').setOrigin(0);
    this.add.image(0, 0, 'ext-front').setOrigin(0);
    this.add.image(0, P.height, 'title-sand-ext').setOrigin(0);
    this.add
      .rectangle(0, P.height + ext, P.width, ext * 3, 0x5e4433)
      .setOrigin(0);
    const nearShadow = this.add.image(0, 0, 'title-near').setOrigin(0);
    const sandShadow = this.add
      .rectangle(0, P.height, P.width, ext * 4, 0x140f1c)
      .setOrigin(0);
    this.shadow = [farShadow, nearShadow, sandShadow];

    this.addDust();
    this.frame();
    this.applyDawn();
    this.tweens.add({
      targets: this.dawn,
      t: 1,
      duration: prefersReducedMotion() ? 1 : 9000,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.applyDawn(),
      onComplete: () => {
        this.tweens.add({
          targets: this.dawn,
          t: 0.55,
          duration: 12000,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
          onUpdate: () => this.applyDawn(),
        });
      },
    });

    this.overlay = new Overlay();
    this.buildMenu();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });
    this.cameras.main.fadeIn(900, 8, 6, 10);
  }

  private onResize() {
    this.frame();
  }

  /** Landscape covers the art; portrait keeps the whole pyramid in view. */
  private frame() {
    const { width: w, height: h } = this.scale;
    if (w >= h * 1.1) return this.view.layout();
    const zoom = Math.min(h / P.height, w / 430);
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(626, 196);
  }

  private applyDawn() {
    const t = this.dawn.t;
    this.night.setAlpha(Phaser.Math.Clamp(0.82 - t * 0.9, 0, 1));
    const shadowAlpha = Phaser.Math.Clamp(1 - t * 1.05, 0, 1) * 0.94;
    for (const s of this.shadow) s.setAlpha(shadowAlpha);
  }

  private addDust() {
    const emitter = this.add.particles(0, 0, 'px', {
      x: { min: 300, max: 960 },
      y: { min: 150, max: 330 },
      lifespan: 9000,
      speedX: { min: 2, max: 9 },
      speedY: { min: -2, max: 1 },
      alpha: {
        start: 0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.6,
      },
      tint: [0xffe2b0, 0xf5c98a],
      frequency: prefersReducedMotion() ? 900 : 260,
      blendMode: Phaser.BlendModes.ADD,
    });
    emitter.setDepth(5);
  }

  private buildMenu() {
    const o = this.overlay;
    const wrap = o.element('div', 'pro-title');
    const head = o.element('div', 'pro-title-head', wrap);
    const logo = o.element('h1', 'pro-logo', head);
    logo.textContent = 'ENIGMA';
    const tag = o.element('p', 'pro-tagline', head);
    tag.textContent = TEXT.title.tagline;
    const menu = o.element('nav', 'pro-menu', wrap);
    menu.setAttribute('aria-label', 'Huvudmeny');
    const newGame = o.button(
      TEXT.title.newGame,
      () => this.onNewGame(),
      'pro-btn pro-btn-primary',
      menu,
    );
    const cont = o.button(
      TEXT.title.continue,
      () => this.continueGame(),
      'pro-btn',
      menu,
    );
    cont.disabled = true;
    o.button(
      TEXT.title.settings,
      () => openSettingsPanel(o, this),
      'pro-btn pro-btn-quiet',
      menu,
    );
    void progress.load().then(() => {
      if (!this.scene.isActive()) return;
      cont.disabled = !progress.hasSave;
      if (progress.hasSave) cont.focus({ preventScroll: true });
      else newGame.focus({ preventScroll: true });
    });
  }

  private onNewGame() {
    if (!progress.hasSave) return this.begin(() => progress.startNew());
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = TEXT.title.confirmNew;
    body.appendChild(p);
    const row = document.createElement('div');
    row.className = 'pro-row';
    body.appendChild(row);
    const panel = this.overlay.panel(TEXT.title.newGame, body, {
      closeLabel: TEXT.title.confirmNo,
    });
    this.overlay.button(
      TEXT.title.confirmYes,
      () => {
        panel.close();
        // Keep the "intro seen" flag so returning players may skip it.
        const seen = progress.current().introSeen;
        this.begin(() => {
          progress.startNew();
          progress.commit((s) => (s.introSeen = seen));
        });
      },
      'pro-btn pro-btn-primary',
      row,
    );
  }

  private begin(prepare: () => void) {
    prepare();
    this.leave('intro', { step: 'attic' });
  }

  private continueGame() {
    const save = progress.current();
    if (save.stage === 'hall') return this.leave('hall');
    if (save.stage === 'corridor' || save.stage === 'chapter1-gate')
      return this.leave('corridor');
    if (stageIndex(save.stage) >= stageIndex('exterior'))
      return this.leave('exterior');
    this.leave('intro', { step: save.stage });
  }

  private leave(key: string, data?: object) {
    this.overlay.destroy();
    this.cameras.main.fadeOut(500, 8, 6, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start(key, data),
    );
  }
}
