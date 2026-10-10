import Phaser from 'phaser';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { TEXT } from '../prologue/content';
import { MiniatureTexture } from '../prologue/miniatureTexture';
import { ICONS, Overlay } from '../prologue/overlay';
import { openNotePanel } from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import type { PrologueStage } from '../state/prologueSave';
import { playCue } from '../prologue/audio';

type Step = 'attic' | 'artifact' | 'note' | 'travel';

const ATTIC_LIGHT = { x: 0.55, y: 0.7, z: -0.45 };
const BOX_BOTTOM = 330;
const BOX_X = 230;

/** Attic, heirloom box, miniature inspection, the note and the journey. */
export class IntroScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private step: Step = 'attic';
  private root!: Phaser.GameObjects.Container;
  private miniature?: MiniatureTexture;
  private orientation = { yaw: 180, pitch: 0 };
  private inspecting = false;
  private drag?: { x: number; y: number };
  private turned = 0;
  private travelUpdate?: (time: number, delta: number) => void;

  constructor() {
    super('intro');
  }

  init(data: { step?: PrologueStage }) {
    const step = data.step;
    this.step =
      step === 'artifact' || step === 'note' || step === 'travel'
        ? step
        : 'attic';
  }

  preload() {
    preloadPrologue(this);
  }

  create() {
    crispen(this);
    setPixelMode(true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#0b0809');
    this.overlay = new Overlay('pro-intro');
    this.view = new ArtView(this, 640, 360, { x: 320, y: 220 });
    this.root = this.add.container(0, 0);
    this.textures.get('map-pins').add('home', 0, 0, 0, 20, 20);
    this.textures.get('map-pins').add('dest', 0, 40, 4, 16, 16);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.inspecting) this.drag = { x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.inspecting || !this.drag || !p.isDown) return;
      this.turnMiniature(
        -(p.x - this.drag.x) * 0.8,
        -(p.y - this.drag.y) * 0.5,
      );
      this.drag = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', () => (this.drag = undefined));
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (!this.inspecting) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [8, 0],
        ArrowRight: [-8, 0],
        ArrowUp: [0, 6],
        ArrowDown: [0, -6],
      };
      const d = map[event.key];
      if (d) this.turnMiniature(d[0], d[1]);
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });
    this.events.on(Phaser.Scenes.Events.UPDATE, (time: number, delta: number) =>
      this.travelUpdate?.(time, delta),
    );

    void progress.load().then(() => this.enter(this.step));
  }

  private onResize() {
    this.view.layout();
    if (this.inspecting) this.layoutInspector();
  }

  private skipExtras() {
    if (!progress.current().introSeen) return [];
    return [
      {
        label: TEXT.ui.skipIntro,
        quiet: true,
        onClick: () => this.finishIntro(),
      },
    ];
  }

  private clearStage() {
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.travelUpdate = undefined;
    this.inspecting = false;
    this.root.removeAll(true);
    this.children.list
      .filter((c) => c !== this.root)
      .forEach((c) => c.destroy());
    this.overlay.clearCaption();
  }

  private enter(step: Step) {
    this.step = step;
    progress.advanceTo(step);
    this.clearStage();
    this.cameras.main.fadeIn(600, 8, 6, 10);
    if (step === 'attic') this.attic();
    else if (step === 'artifact') this.artifact();
    else if (step === 'note') this.note();
    else this.travelMap();
  }

  private transition(next: () => void, ms = 450) {
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(ms, 8, 6, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      next,
    );
  }

  // -- Attic ---------------------------------------------------------------

  private addAttic(open: boolean) {
    this.view = new ArtView(this, 640, 360, { x: 300, y: 230 });
    this.add.image(0, 0, 'attic').setOrigin(0);
    const shaft = this.add
      .image(0, 0, 'attic-shaft')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: shaft,
        alpha: 0.65,
        duration: 3200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    const key = open ? 'attic-box-open' : 'attic-box-closed';
    const box = this.add.image(BOX_X, BOX_BOTTOM, key).setOrigin(0, 1);
    this.add.particles(0, 0, 'px', {
      x: { min: 240, max: 420 },
      y: { min: 110, max: 320 },
      lifespan: 6000,
      speedX: { min: -3, max: 3 },
      speedY: { min: -2, max: 3 },
      alpha: {
        start: 0.0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.7,
      },
      tint: 0xffe2b0,
      frequency: prefersReducedMotion() ? 700 : 160,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.view.layout();
    return box;
  }

  private attic() {
    this.addAttic(false);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: this.view,
        centerY: 238,
        duration: 6000,
        ease: 'Sine.easeOut',
        onUpdate: () =>
          this.view.setCenter(this.view.centerX, this.view.centerY),
      });
    this.overlay.caption(TEXT.captions.attic, {
      position: 'top',
      onNext: () => this.openBox(),
      extra: this.skipExtras(),
    });
  }

  private openBox() {
    playCue('box-open');
    this.children.list
      .filter(
        (c) =>
          c instanceof Phaser.GameObjects.Image &&
          c.texture.key === 'attic-box-closed',
      )
      .forEach((c) => c.destroy());
    this.add.image(BOX_X, BOX_BOTTOM, 'attic-box-open').setOrigin(0, 1);
    const mini = new MiniatureTexture(this, 'mini-box', 44);
    mini.update({
      yaw: 205,
      pitch: 0,
      light: ATTIC_LIGHT,
      scale: 0.36,
      viewTilt: 26,
    });
    this.add.image(BOX_X + 70, BOX_BOTTOM - 55, mini.key).setOrigin(0.5, 0.62);
    this.add
      .particles(BOX_X + 70, BOX_BOTTOM - 50, 'px', {
        lifespan: 1400,
        speed: { min: 6, max: 22 },
        angle: { min: 200, max: 340 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xd8c3a0,
        quantity: prefersReducedMotion() ? 4 : 18,
        emitting: false,
      })
      .explode(prefersReducedMotion() ? 4 : 18);
    this.time.delayedCall(500, () =>
      this.overlay.caption(TEXT.captions.miniature, {
        position: 'top',
        onNext: () => this.transition(() => this.enter('artifact')),
        extra: this.skipExtras(),
      }),
    );
  }

  // -- Artifact inspection ---------------------------------------------------

  private inspector?: {
    sprite: Phaser.GameObjects.Image;
    halo: Phaser.GameObjects.Graphics;
  };

  private artifact() {
    this.addAttic(true);
    this.add.rectangle(0, 0, 640, 360, 0x07050a, 0.72).setOrigin(0);
    const halo = this.add.graphics();
    this.miniature = new MiniatureTexture(this, 'mini-inspect', 96);
    const sprite = this.add.image(320, 200, this.miniature.key);
    this.inspector = { sprite, halo };
    this.orientation = { yaw: 200, pitch: -6 };
    this.inspecting = true;
    this.turned = 0;
    this.renderMiniature();
    this.layoutInspector();
    // A slow lift into view.
    sprite.setAlpha(0);
    this.tweens.add({
      targets: sprite,
      alpha: 1,
      y: sprite.y - 6,
      duration: 900,
      ease: 'Sine.easeOut',
    });
    this.overlay.chip(TEXT.captions.inspectHint, ICONS.look, 6000, 'low');
    const controls = this.overlay.element('div', 'pro-controls');
    const add = (label: string, icon: string, dy: number, dp: number) => {
      const b = this.overlay.iconButton(
        { id: label, label, icon, onClick: () => this.turnMiniature(dy, dp) },
        controls,
      );
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
    };
    add(TEXT.ui.turnLeft, ICONS.left, 12, 0);
    add(TEXT.ui.turnRight, ICONS.right, -12, 0);
    add(TEXT.ui.tiltUp, ICONS.up, 0, 10);
    add(TEXT.ui.tiltDown, ICONS.down, 0, -10);
    this.overlay.caption(TEXT.captions.miniature, {
      position: 'top',
      onNext: () => {
        controls.remove();
        this.transition(() => this.enter('note'));
      },
      extra: this.skipExtras(),
    });
  }

  private layoutInspector() {
    if (!this.inspector) return;
    const { sprite, halo } = this.inspector;
    const visibleH = this.view.halfH * 2;
    const visibleW = this.view.halfW * 2;
    const scale = Math.max(
      1,
      Math.floor(Math.min(visibleW * 0.8, visibleH * 0.55) / 96),
    );
    sprite.setScale(scale);
    sprite.setPosition(this.view.centerX, this.view.centerY - visibleH * 0.2);
    halo.clear();
    // Soft pool of window light under the lifted miniature.
    for (let i = 5; i > 0; i--) {
      halo.fillStyle(0xe8b878, 0.035);
      halo.fillEllipse(
        sprite.x,
        sprite.y + 26 * scale,
        (30 + i * 10) * scale,
        (8 + i * 3) * scale,
      );
    }
  }

  private turnMiniature(dYaw: number, dPitch: number) {
    this.orientation.yaw = (this.orientation.yaw + dYaw + 360) % 360;
    this.orientation.pitch = Phaser.Math.Clamp(
      this.orientation.pitch + dPitch,
      -70,
      70,
    );
    this.turned += Math.abs(dYaw) + Math.abs(dPitch);
    this.renderMiniature();
  }

  private renderMiniature() {
    this.miniature?.update({
      yaw: this.orientation.yaw,
      pitch: this.orientation.pitch,
      light: ATTIC_LIGHT,
      scale: 0.34,
      viewTilt: 18,
    });
  }

  // -- Note -----------------------------------------------------------------

  private note() {
    this.addAttic(true);
    this.add.rectangle(0, 0, 640, 360, 0x07050a, 0.6).setOrigin(0);
    this.overlay.caption(TEXT.captions.noteIntro, {
      next: TEXT.note.title,
      position: 'top',
      onNext: () =>
        openNotePanel(this.overlay, () =>
          this.transition(() => this.enter('travel')),
        ),
      extra: this.skipExtras(),
    });
  }

  // -- Travel ------------------------------------------------------------------

  private travelMap() {
    this.view = new ArtView(this, 640, 360, { x: 335, y: 190 });
    this.add.image(0, 0, 'map').setOrigin(0);
    const home = { x: 150, y: 96 };
    const dest = { x: 520, y: 282 };
    const ctrl = { x: 260, y: 300 };
    this.add.image(home.x, home.y, 'map-pins', 'home').setOrigin(0.5, 0.9);
    const destPin = this.add
      .image(dest.x, dest.y, 'map-pins', 'dest')
      .setOrigin(0.5)
      .setAlpha(0);
    const route = this.add.graphics();
    const plane = this.add.image(home.x, home.y, 'plane').setOrigin(0.5);
    this.view.layout();
    // Portrait: follow the plane so the journey stays in frame.
    const curve = new Phaser.Curves.QuadraticBezier(
      new Phaser.Math.Vector2(home.x, home.y),
      new Phaser.Math.Vector2(ctrl.x, ctrl.y),
      new Phaser.Math.Vector2(dest.x, dest.y),
    );
    const state = { t: 0 };
    const duration = prefersReducedMotion() ? 1500 : 5200;
    this.tweens.add({
      targets: state,
      t: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const p = curve.getPoint(state.t);
        const tangent = curve.getTangent(state.t);
        plane.setPosition(
          Math.round(p.x),
          Math.round(p.y - 10 * Math.sin(state.t * Math.PI)),
        );
        plane.setRotation(Math.atan2(tangent.y, tangent.x));
        route.clear();
        route.fillStyle(0x7a2a1e, 0.9);
        const steps = Math.floor(state.t * 60);
        for (let i = 0; i < steps; i++) {
          if (i % 2) continue;
          const q = curve.getPoint(i / 60);
          route.fillRect(Math.round(q.x), Math.round(q.y), 2, 2);
        }
        this.view.setCenter(p.x, p.y);
      },
      onComplete: () => {
        this.tweens.add({ targets: destPin, alpha: 1, duration: 500 });
        this.tweens.add({ targets: plane, alpha: 0, duration: 500 });
        this.time.delayedCall(1300, () =>
          this.transition(() => this.travelDesert(), 700),
        );
      },
    });
    this.overlay.caption(TEXT.captions.travel, {
      next: TEXT.ui.skip,
      position: 'top',
      onNext: () => this.transition(() => this.travelDesert()),
      extra: this.skipExtras(),
    });
  }

  private travelDesert() {
    this.clearStage();
    this.cameras.main.fadeIn(700, 8, 6, 10);
    this.view = new ArtView(this, 1280, 360, { x: 640, y: 200 });
    this.add.image(0, 0, 'ext-sky').setOrigin(0);
    const far = this.add.tileSprite(0, 0, 1280, 360, 'ext-far').setOrigin(0);
    const dunes = this.add
      .tileSprite(0, 0, 1280, 360, 'travel-dunes')
      .setOrigin(0);
    const jeep = this.add.image(0, 302, 'travel-jeep').setOrigin(0.5, 1);
    const dust = this.add.particles(0, 0, 'px', {
      lifespan: 1600,
      speedX: { min: -30, max: -10 },
      speedY: { min: -8, max: -2 },
      scale: { start: 2, end: 4 },
      alpha: { start: 0.45, end: 0 },
      tint: [0xe9c48a, 0xd7ae76],
      frequency: prefersReducedMotion() ? 220 : 40,
    });
    this.view.layout();
    const reduce = prefersReducedMotion();
    let elapsed = 0;
    this.travelUpdate = (_time, delta) => {
      elapsed += delta;
      far.tilePositionX += delta * 0.004;
      dunes.tilePositionX += delta * 0.03;
      const x =
        this.view.centerX -
        this.view.halfW * 0.2 +
        Math.min(elapsed / 6000, 1) * this.view.halfW * 0.25;
      const bob = reduce ? 0 : Math.round(Math.sin(elapsed / 90) * 0.6);
      jeep.setPosition(Math.round(x), 300 + bob);
      dust.setPosition(jeep.x - 34, jeep.y - 6);
    };
    this.overlay.caption(TEXT.captions.travel, {
      position: 'top',
      onNext: () => this.finishIntro(),
    });
    this.time.delayedCall(reduce ? 2500 : 6500, () => {
      if (this.overlay.hasCaption) return;
      this.finishIntro();
    });
  }

  private finishIntro() {
    progress.advanceTo('exterior');
    progress.commit((s) => (s.introSeen = true));
    this.transition(() => this.scene.start('exterior', { arrival: true }), 700);
  }
}
