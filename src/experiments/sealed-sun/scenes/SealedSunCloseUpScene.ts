import Phaser from 'phaser';
import { PixelCanvas } from '../art/pixelCanvas.ts';
import { RING_STYLES, SEAL_SIZE, drawSeal } from '../art/sealArt.ts';
import { getArt, prefersReducedMotion, uploadCanvas } from '../phaserBridge.ts';
import {
  HINTS,
  linkedRings,
  turn,
  windowGlyphs,
  type RingIndex,
} from '../puzzle/sunSeal.ts';
import { saveProgress, type SealedSunProgress } from '../state.ts';
import { TEXT, windowText } from '../text.ts';
import type { Overlay } from '../ui/overlay.ts';

export interface CloseUpResult {
  solvedNow: boolean;
}

interface CloseUpData {
  view: 'seal' | 'stele';
  overlay: Overlay;
  progress: SealedSunProgress;
  onClose(result: CloseUpResult): void;
}

const TOP_RESERVED = 76;

/**
 * Dedicated close-ups over the room: the Sun Seal (the puzzle) and the stele
 * (the clue). Screen-space only; the room scene keeps its camera untouched
 * underneath and restores it when this closes.
 */
export class SealedSunCloseUpScene extends Phaser.Scene {
  private data_!: CloseUpData;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private image!: Phaser.GameObjects.Image;
  private sealCanvas!: PixelCanvas;
  private angles: number[] = [];
  private selected = 0;
  private animating = false;
  private glow = 0;
  private closing = false;
  private drag: { ring: number; angle: number; turned: boolean } | null = null;

  constructor() {
    super('sealed-sun-closeup');
  }

  create(data: CloseUpData) {
    this.data_ = data;
    this.closing = false;
    this.animating = false;
    this.drag = null;
    const { overlay, progress } = data;
    this.backdrop = this.add
      .rectangle(0, 0, 10, 10, 0x07050b, 0.9)
      .setOrigin(0);
    if (data.view === 'seal') {
      this.sealCanvas = new PixelCanvas(SEAL_SIZE, SEAL_SIZE);
      this.angles = [...progress.seal.rotations];
      this.glow = progress.seal.solved ? 1 : 0;
      this.selected = 0;
      this.redraw();
      this.image = this.add.image(0, 0, 'ss-seal-live');
      overlay.openCloseup(
        TEXT.sealTitle,
        progress.seal.solved
          ? TEXT.sealLocked
          : `${TEXT.sealIntro} ${windowText(windowGlyphs(progress.seal))}`,
        () => this.close(false),
        {
          onSelect: (ring) => this.select(ring),
          onTurn: (dir) => this.turnSelected(dir),
          onHint: () => this.hint(),
        },
      );
      overlay.setSealUi(this.selected, progress.seal.solved);
      this.bindSealInput();
    } else {
      uploadCanvas(this, 'ss-stele-flat', getArt().layers.steleFlat);
      this.image = this.add.image(0, 0, 'ss-stele-flat');
      overlay.openCloseup(TEXT.steleTitle, TEXT.steleCaption, () =>
        this.close(false),
      );
      progress.steleSeen = true;
      saveProgress(progress);
    }
    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', () => this.close(false));
    if (data.view === 'seal') {
      kb?.on('keydown-UP', () => this.select((this.selected + 2) % 3));
      kb?.on('keydown-DOWN', () => this.select((this.selected + 1) % 3));
      kb?.on('keydown-LEFT', () => this.turnSelected(-1));
      kb?.on('keydown-RIGHT', () => this.turnSelected(1));
      kb?.on('keydown-H', () => this.hint());
    }
    this.layout();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    if (!prefersReducedMotion()) {
      this.backdrop.setAlpha(0);
      this.image.setAlpha(0);
      this.tweens.add({
        targets: [this.backdrop, this.image],
        alpha: 1,
        duration: 220,
      });
    }
  }

  private layout() {
    const { width, height } = this.scale;
    this.cameras.main.setSize(width, height);
    this.backdrop.setSize(width, height);
    const reserved = this.data_.overlay.closeupReserved();
    const landscapeSide = height < 520 && width > height;
    const availW = landscapeSide
      ? width - Math.min(300, width * 0.4) - 36
      : width - 24;
    const availH = landscapeSide
      ? height - 64 - 8
      : height - TOP_RESERVED - reserved;
    const src = this.image.frame;
    let s = Math.min(availW / src.width, availH / src.height);
    // Prefer crisp quarter steps once the art is at least 1:1.
    if (s >= 1) s = Math.floor(s * 4) / 4;
    this.image.setScale(s);
    const cx = landscapeSide ? 12 + availW / 2 : width / 2;
    const cy = landscapeSide ? 64 + availH / 2 : TOP_RESERVED + availH / 2;
    this.image.setPosition(Math.round(cx), Math.round(cy));
  }

  // -------------------------------------------------------------------------
  // Seal interaction

  private redraw() {
    drawSeal(this.sealCanvas, getArt().layers.sealPlate, {
      angles: this.angles,
      selected: this.data_.progress.seal.solved ? null : this.selected,
      glow: this.glow,
    });
    uploadCanvas(this, 'ss-seal-live', this.sealCanvas);
  }

  private localPolar(px: number, py: number) {
    const s = this.image.scaleX;
    const x = (px - this.image.x) / s;
    const y = (py - this.image.y) / s;
    return { r: Math.hypot(x, y), angle: Math.atan2(y, x) };
  }

  private ringAt(r: number) {
    return RING_STYLES.findIndex((st) => r >= st.inner - 1 && r < st.outer + 1);
  }

  private bindSealInput() {
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (p: Phaser.Input.Pointer) => {
        const { r, angle } = this.localPolar(p.x, p.y);
        const ring = this.ringAt(r);
        if (ring < 0) return;
        this.drag = { ring, angle, turned: false };
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (p: Phaser.Input.Pointer) => {
        if (!this.drag || !p.isDown) return;
        const { angle } = this.localPolar(p.x, p.y);
        let d = angle - this.drag.angle;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        // About half a slot of drag along the ring turns it one slot.
        if (Math.abs(d) > Math.PI / 8 && !this.animating) {
          if (this.selected !== this.drag.ring) this.select(this.drag.ring);
          this.turnSelected(d > 0 ? 1 : -1);
          this.drag.angle = angle;
          this.drag.turned = true;
        }
      },
    );
    this.input.on(Phaser.Input.Events.POINTER_UP, () => {
      if (this.drag && !this.drag.turned) this.select(this.drag.ring);
      this.drag = null;
    });
  }

  private select(ring: number) {
    if (this.data_.progress.seal.solved) return;
    this.selected = ring;
    this.data_.overlay.setSealUi(ring, false);
    if (ring === 0)
      this.data_.overlay.setCaption(`Yttre ringen. ${TEXT.linkOuter}`);
    else if (ring === 1)
      this.data_.overlay.setCaption(`Mellersta ringen. ${TEXT.linkMiddle}`);
    else this.data_.overlay.setCaption('Inre ringen. Den vrids ensam.');
    if (!this.animating) this.redraw();
  }

  private turnSelected(direction: 1 | -1) {
    const progress = this.data_.progress;
    if (this.animating || progress.seal.solved || this.closing) return;
    const ring = this.selected as RingIndex;
    progress.seal = turn(progress.seal, ring, direction);
    saveProgress(progress);
    const moving = linkedRings(ring);
    const from = moving.map((r) => this.angles[r]);
    this.animating = true;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: prefersReducedMotion() ? 1 : 300,
      ease: 'Back.easeOut',
      onUpdate: (tw) => {
        const v = tw.getValue() ?? 0;
        moving.forEach((r, i) => (this.angles[r] = from[i] + direction * v));
        this.redraw();
      },
      onComplete: () => {
        moving.forEach((r, i) => (this.angles[r] = from[i] + direction));
        this.animating = false;
        this.redraw();
        this.data_.overlay.setCaption(windowText(windowGlyphs(progress.seal)));
        if (progress.seal.solved) this.solveSequence();
      },
    });
    if (!prefersReducedMotion()) this.cameras.main.shake(70, 0.0015);
  }

  private hint() {
    const progress = this.data_.progress;
    if (progress.seal.solved) return;
    const i = Math.min(progress.hintsShown, HINTS.length - 1);
    this.data_.overlay.setCaption(
      `Ledtråd ${i + 1}/${HINTS.length}: ${HINTS[i]}`,
    );
    progress.hintsShown = Math.min(HINTS.length, progress.hintsShown + 1);
    saveProgress(progress);
  }

  private solveSequence() {
    const overlay = this.data_.overlay;
    overlay.setSealUi(-1, true);
    overlay.setCaption(TEXT.sealSolving);
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 1000,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        this.glow = tw.getValue() ?? 0;
        this.redraw();
      },
      onComplete: () => this.time.delayedCall(700, () => this.close(true)),
    });
    if (!prefersReducedMotion()) {
      this.time.delayedCall(250, () => this.cameras.main.shake(180, 0.004));
    }
  }

  private close(solvedNow: boolean) {
    if (this.closing || (this.animating && !solvedNow)) return;
    this.closing = true;
    const finish = () => {
      this.data_.overlay.closeCloseup();
      this.data_.onClose({ solvedNow });
      this.scene.stop();
    };
    if (prefersReducedMotion()) finish();
    else
      this.tweens.add({
        targets: [this.backdrop, this.image],
        alpha: 0,
        duration: 200,
        onComplete: finish,
      });
  }
}
