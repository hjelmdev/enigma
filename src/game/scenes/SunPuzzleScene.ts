import Phaser from 'phaser';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { playCue } from '../prologue/audio';
import { TEXT } from '../prologue/content';
import { MiniatureTexture } from '../prologue/miniatureTexture';
import { ICONS, Overlay, repeatOnHold } from '../prologue/overlay';
import { openNotePanel } from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import {
  EYE_SCREEN,
  SUN_DIRECTION,
  computeBeam,
  createSunEyeState,
  displaySpot,
  inputSensitivity,
  rotate,
  tick,
} from '../puzzles/sunEye';
import type { BeamResult, SunEyeState } from '../puzzles/sunEye';
import layout from '../prologue/exteriorLayout.json';

const C = layout.closeup;
const MINI_SIZE = 96;
const MINI_ORIGIN_Y = 0.72;
/** Where the miniature's canvas is placed so its body sits in the cradle. */
const MINI_ORIGIN = { x: C.cradle.x, y: C.cradle.y + 6 };

/** Ögats ljus: turn the miniature in its cradle to send sunlight to the eye. */
export class SunPuzzleScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private state: SunEyeState = createSunEyeState();
  private mini!: MiniatureTexture;
  private beam!: Phaser.GameObjects.Graphics;
  private eyeLit!: Phaser.GameObjects.Image;
  private glare!: Phaser.GameObjects.Graphics;
  private status!: HTMLDivElement;
  private drag?: { id: number; x: number; y: number };
  private lastBeam?: BeamResult;
  private idleMs = 0;
  private solvedAt = 0;
  private finished = false;
  private catchCued = false;

  constructor() {
    super('sun-puzzle');
  }

  init() {
    this.state = createSunEyeState();
    this.idleMs = 0;
    this.solvedAt = 0;
    this.finished = false;
    this.catchCued = false;
  }

  preload() {
    preloadPrologue(this);
  }

  create() {
    crispen(this);
    setPixelMode(true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setBackgroundColor('#1b2f4f');
    // Frame the eye and the cradle together; portrait keeps the same column.
    this.view = new ArtView(this, C.width, C.height, {
      x: 320,
      y: (EYE_SCREEN.y + C.cradle.y) / 2 + 6,
    });
    this.add.image(0, 0, 'pz-bg').setOrigin(0);
    this.eyeLit = this.add
      .image(C.eye.x, C.eye.y, 'pz-eye-lit')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.beam = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(0, 0, 'pz-cradle').setOrigin(0);
    this.mini = new MiniatureTexture(this, 'mini-puzzle', MINI_SIZE);
    this.add
      .image(MINI_ORIGIN.x, MINI_ORIGIN.y, this.mini.key)
      .setOrigin(0.5, MINI_ORIGIN_Y);
    this.add.image(0, 0, 'pz-pedestal').setOrigin(0);
    this.glare = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.view.layout();

    this.overlay = new Overlay('pro-puzzle');
    this.status = this.overlay.element('div', 'pro-meter');
    this.status.setAttribute('aria-live', 'polite');
    this.overlay.hud([
      {
        id: 'hint',
        label: TEXT.ui.hint,
        icon: ICONS.hint,
        onClick: () => this.showHint(),
      },
      {
        id: 'note',
        label: TEXT.ui.note,
        icon: ICONS.note,
        onClick: () => openNotePanel(this.overlay),
      },
      {
        id: 'back',
        label: TEXT.ui.back,
        icon: ICONS.back,
        onClick: () => this.leave(false),
      },
    ]);
    this.buildControls();
    this.bindInput();
    this.render();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });
    this.cameras.main.fadeIn(600, 8, 6, 10);
    void progress.load().then(() => {
      this.overlay.caption(TEXT.captions.firstHint, {
        position: 'top',
        next: TEXT.ui.close,
      });
      this.overlay.chip(TEXT.ui.rotateHint, ICONS.look, 5000, 'low');
    });
  }

  private onResize() {
    this.view.layout();
  }

  private buildControls() {
    const bar = this.overlay.element('div', 'pro-controls');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', TEXT.ui.rotateHint);
    const controls: Array<[string, string, number, number]> = [
      [TEXT.ui.turnLeft, ICONS.left, -4, 0],
      [TEXT.ui.turnRight, ICONS.right, 4, 0],
      [TEXT.ui.tiltUp, ICONS.up, 0, 2],
      [TEXT.ui.tiltDown, ICONS.down, 0, -2],
    ];
    for (const [label, icon, dy, dp] of controls) {
      const b = this.overlay.iconButton(
        { id: label, label, icon, onClick: () => {} },
        bar,
      );
      repeatOnHold(b, () => this.applyRotation(dy, dp, true));
    }
  }

  private bindInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.overlay.panelOpen) return;
      this.drag = { id: p.id, x: p.x, y: p.y };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      this.drag = { id: p.id, x: p.x, y: p.y };
      // Screen pixels -> degrees, independent of the zoom level. Dragging
      // steers the reflected ray: drag right and the light moves right.
      const k = 0.42;
      this.applyRotation(dx * k, -dy * k * 0.55, false);
    });
    const end = () => (this.drag = undefined);
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-4, 0],
        ArrowRight: [4, 0],
        ArrowUp: [0, 2],
        ArrowDown: [0, -2],
      };
      const d = map[event.key];
      if (d) {
        event.preventDefault();
        this.applyRotation(d[0], d[1], true);
      }
    });
  }

  /** Coarse turning far from the eye, finer aiming once light is on stone. */
  private applyRotation(dYaw: number, dPitch: number, stepped: boolean) {
    if (this.finished || this.state.phase === 'solved') return;
    const beam = this.lastBeam ?? computeBeam(this.state.yaw, this.state.pitch);
    // Buttons/keys take big steps while searching, small ones once aiming.
    const k = stepped
      ? beam.hit === 'facade'
        ? 0.3
        : 1
      : inputSensitivity(beam);
    this.state = rotate(this.state, dYaw * k, dPitch * k);
    this.idleMs = 0;
    if (this.overlay.hasCaption && this.state.interacted)
      this.overlay.clearCaption();
  }

  private showHint() {
    this.idleMs = 0;
    this.overlay.hudButton('hint')?.classList.remove('is-pulsing');
    const save = progress.current();
    const level = Math.min(save.hintLevel, TEXT.hints.length - 1);
    this.overlay.caption(TEXT.hints[level], {
      position: 'top',
      next: TEXT.ui.close,
    });
    if (save.hintLevel < TEXT.hints.length)
      progress.commit((s) => (s.hintLevel = Math.min(3, s.hintLevel + 1)));
  }

  update(time: number, delta: number) {
    if (this.finished) return;
    const before = this.state.phase;
    this.state = tick(this.state, delta);
    if (before !== 'solved' && this.state.phase === 'solved')
      this.onSolved(time);
    this.render(time);
    this.idleMs += delta;
    if (this.idleMs > 25000)
      this.overlay.hudButton('hint')?.classList.add('is-pulsing');
  }

  private render(time = 0) {
    const beam = computeBeam(this.state.yaw, this.state.pitch);
    this.lastBeam = beam;
    const solved = this.state.phase === 'solved';
    const glow = solved
      ? 1
      : beam.catching
        ? Math.min(1, beam.lit * 0.6 + beam.proximity * 0.6)
        : 0;
    const render = this.mini.update({
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      light: SUN_DIRECTION,
      glow,
      scale: 0.36,
      viewTilt: 14,
    });
    const origin = {
      x: Math.round(MINI_ORIGIN.x - MINI_SIZE / 2 + render.apex.x),
      y: Math.round(MINI_ORIGIN.y - MINI_SIZE * MINI_ORIGIN_Y + render.apex.y),
    };
    if (beam.catching && !this.catchCued) {
      this.catchCued = true;
      playCue('sun-catch');
    } else if (!beam.catching) this.catchCued = false;

    const g = this.beam;
    g.clear();
    this.glare.clear();
    const spot = solved ? { ...EYE_SCREEN } : displaySpot(beam);
    if (beam.catching && spot && beam.hit !== 'back') {
      const intensity = solved
        ? 1
        : 0.45 + beam.lit * 0.35 + beam.proximity * 0.4;
      const flicker = prefersReducedMotion()
        ? 1
        : 0.92 + Math.sin(time / 60) * 0.08;
      // Wide soft core, spectral fringes, bright filament.
      g.lineStyle(5, 0xffc66e, 0.12 * intensity);
      g.lineBetween(origin.x, origin.y, spot.x, spot.y);
      g.lineStyle(1, 0xff7a6a, 0.4 * intensity);
      g.lineBetween(origin.x - 1, origin.y, spot.x - 1, spot.y);
      g.lineStyle(1, 0x7fe0ff, 0.4 * intensity);
      g.lineBetween(origin.x + 1, origin.y, spot.x + 1, spot.y);
      g.lineStyle(1, 0xfff4d0, 0.95 * intensity * flicker);
      g.lineBetween(origin.x, origin.y, spot.x, spot.y);
      if (beam.hit === 'facade' || beam.hit === 'ground' || solved) {
        const r = beam.hit === 'ground' ? 3 : 4 + beam.proximity * 3;
        g.fillStyle(0xffe6a8, 0.35 * intensity);
        g.fillCircle(spot.x, spot.y, r + 4);
        g.fillStyle(0xff8b7a, 0.35 * intensity);
        g.fillCircle(spot.x - 1, spot.y, r);
        g.fillStyle(0x8fe4ff, 0.35 * intensity);
        g.fillCircle(spot.x + 1, spot.y, r);
        g.fillStyle(0xfffbe8, 0.9 * intensity);
        g.fillCircle(spot.x, spot.y, Math.max(1.5, r - 2));
      }
      // Gleam at the seam where the ray leaves the miniature.
      g.fillStyle(0xfff6d8, 0.9);
      g.fillCircle(origin.x, origin.y, 1.5 + glow);
    } else if (beam.catching && beam.hit === 'back') {
      // The inlay flashes toward the viewer: right idea, wrong direction.
      const a = 0.25 + beam.lit * 0.4;
      this.glare.fillStyle(0xfff3cf, a * 0.5);
      this.glare.fillCircle(origin.x, origin.y, 6);
      this.glare.lineStyle(1, 0xfff3cf, a);
      for (let i = 0; i < 4; i++) {
        const ang = (Math.PI / 4) * i + time / 900;
        this.glare.lineBetween(
          origin.x + Math.cos(ang) * 3,
          origin.y + Math.sin(ang) * 3,
          origin.x + Math.cos(ang) * 11,
          origin.y + Math.sin(ang) * 11,
        );
      }
    }
    const target = solved
      ? 1
      : beam.hit === 'facade'
        ? beam.proximity * 0.55
        : 0;
    this.eyeLit.setAlpha(Phaser.Math.Linear(this.eyeLit.alpha, target, 0.2));
    this.updateStatus(beam);
  }

  private updateStatus(beam: BeamResult) {
    let text: string;
    if (this.state.phase === 'solved') text = TEXT.captions.solved;
    else if (!beam.catching) text = 'Solljuset når inte den blanka linjen.';
    else if (beam.hit === 'back')
      text = 'Den blanka linjen blänker – men mot dig.';
    else if (beam.hit === 'sky') text = 'En stråle försvinner upp i himlen.';
    else if (beam.hit === 'ground') text = 'En ljusfläck dansar i sanden.';
    else if (beam.proximity > 0.6) text = 'Strålen är mycket nära ögat …';
    else if (beam.proximity > 0) text = 'Strålen närmar sig ögat.';
    else text = 'En ljusfläck syns på pyramidens sten.';
    if (this.status.textContent !== text) this.status.textContent = text;
  }

  private onSolved(time: number) {
    this.solvedAt = time;
    this.finished = true;
    playCue('eye-ignite');
    progress.commit((s) => (s.sunEyeSolved = true));
    this.render(time);
    this.eyeLit.setAlpha(1);
    if (!prefersReducedMotion()) this.cameras.main.flash(260, 255, 236, 190);
    this.overlay.clearCaption();
    this.overlay.caption(TEXT.captions.solved, {
      position: 'top',
      onNext: () => this.leave(true),
    });
    this.time.delayedCall(2600, () => {
      if (this.scene.isActive()) this.leave(true);
    });
  }

  private leave(solved: boolean) {
    if (this.solvedAt < 0) return;
    this.solvedAt = -1;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(600, 8, 6, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('exterior', { solvedNow: solved }),
    );
  }
}
