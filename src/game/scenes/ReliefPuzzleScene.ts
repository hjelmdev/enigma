import Phaser from 'phaser';
import { crispenHall, hallAssetUrl, preloadHall } from '../hall/assets';
import { HALL_TEXT } from '../hall/content';
import { reliefState, saveRelief } from '../hall/hallState';
import { RELIEF_PUZZLE } from '../hall/puzzles';
import { preloadPrologue, setPixelMode } from '../prologue/assets';
import { playCue } from '../prologue/audio';
import { ICONS, Overlay } from '../prologue/overlay';
import { prefersReducedMotion, progress } from '../prologue/progress';
import {
  EMPTY,
  canSlide,
  emptyIndex,
  resetState,
  slide,
} from '../puzzles/slidingTiles';
import type { SlidingConfig, SlidingState } from '../puzzles/slidingTiles';

/** Board placement inside the 480×360 close-up art (matches the generator). */
const BOARD = { x: 144, y: 66, size: 192, frame: 16 };
const ART = { w: 480, h: 360 };

/**
 * Close-up of the recessed sliding relief. The engine is dimension-independent;
 * this view derives tile size from the board and the config's rows/cols.
 */
export class ReliefPuzzleScene extends Phaser.Scene {
  private config: SlidingConfig = RELIEF_PUZZLE;
  private state!: SlidingState;
  private tiles: Phaser.GameObjects.Image[] = [];
  private pegs!: Phaser.GameObjects.Graphics;
  private overlay!: Overlay;
  private status!: HTMLDivElement;
  private reference!: HTMLImageElement;
  private busy = false;
  private bgCover!: Phaser.GameObjects.Image;
  private vignette!: Phaser.GameObjects.Graphics;
  private zoom = 1;

  constructor() {
    super('relief-puzzle');
  }

  private get tileW() {
    return BOARD.size / this.config.cols;
  }

  private get tileH() {
    return BOARD.size / this.config.rows;
  }

  preload() {
    preloadPrologue(this, []);
    preloadHall(this, ['rel-bg', 'rel-frame', 'rel-glow', 'rel-tiles']);
  }

  create() {
    crispenHall(this);
    setPixelMode(true);
    this.busy = false;
    this.tiles = [];
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0e0b16');

    this.bgCover = this.add
      .image(ART.w / 2, ART.h / 2, 'rel-bg')
      .setTint(0x5a4c66)
      .setDepth(-2);
    this.add.image(0, 0, 'rel-bg').setOrigin(0).setDepth(-1);
    this.vignette = this.add.graphics().setDepth(-0.5);
    const tex = this.textures.get('rel-tiles');
    const n = this.config.rows * this.config.cols;
    for (let i = 0; i < n; i++)
      if (!tex.has(String(i)))
        tex.add(String(i), 0, i * this.tileW, 0, this.tileW, this.tileH);
    const mask = this.make
      .graphics({}, false)
      .fillRect(BOARD.x, BOARD.y, BOARD.size, BOARD.size)
      .createGeometryMask();
    for (let i = 0; i < n; i++) {
      const img = this.add
        .image(0, 0, 'rel-tiles', String(i))
        .setOrigin(0)
        .setMask(mask);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerup', (p: Phaser.Input.Pointer) => this.onTile(i, p));
      img.on('pointerdown', (p: Phaser.Input.Pointer) => {
        img.setData('down', { x: p.x, y: p.y });
      });
      this.tiles.push(img);
    }
    this.add.image(0, 0, 'rel-frame').setOrigin(0);
    this.pegs = this.add.graphics();
    const glow = this.add
      .image(0, 0, 'rel-glow')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.85, to: 1 },
        duration: 160,
        yoyo: true,
        repeat: -1,
        repeatDelay: 120,
        ease: 'Stepped',
        easeParams: [3],
      });
    this.add.particles(0, 0, 'px', {
      x: { min: 424, max: 436 },
      y: 62,
      lifespan: 520,
      speedY: { min: -26, max: -12 },
      speedX: { min: -3, max: 3 },
      scale: { start: 2.2, end: 0.5 },
      alpha: { start: 1, end: 0 },
      tint: [0xfff1c0, 0xffc860, 0xff9440],
      frequency: prefersReducedMotion() ? 140 : 40,
      blendMode: Phaser.BlendModes.ADD,
    });

    this.overlay = new Overlay('pro-relief');
    this.buildUi();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.overlay.destroy();
    });
    this.layout();
    void progress.load().then(() => {
      this.state = reliefState();
      this.placeTiles(false);
      this.refresh();
      cam.fadeIn(500, 6, 4, 10);
      if (!progress.current().discoveredHotspots.includes('relief-help')) {
        progress.discover('relief-help');
        this.overlay.caption(HALL_TEXT.relief.help, { position: 'top' });
      }
    });
  }

  // -- Layout ---------------------------------------------------------------------

  /** Fits the board (plus frame and peg row) between the top and bottom UI. */
  private layout() {
    const { width: w, height: h } = this.scale;
    const portrait = h > w;
    const uiTop = portrait ? 70 : 56;
    const uiBottom = portrait ? 120 : 72;
    const spanW = BOARD.size + BOARD.frame * 2 + 16;
    const spanH = BOARD.size + BOARD.frame * 2 + 26;
    let zoom = Math.min(w / spanW, (h - uiTop - uiBottom) / spanH);
    if (zoom >= 2) zoom = Math.floor(zoom * 2) / 2;
    this.zoom = Math.max(0.5, zoom);
    const cam = this.cameras.main;
    cam.setZoom(this.zoom);
    const cx = BOARD.x + BOARD.size / 2;
    const cy = BOARD.y + BOARD.size / 2 + 6;
    // Shift so the board sits centred in the space between the UI bars.
    const offset = (uiTop - uiBottom) / 2 / this.zoom;
    cam.centerOn(cx, cy - offset);
    // Cover layer behind, darker, so no letterboxing appears on any aspect.
    const cover = Math.max(w / ART.w, h / ART.h) / this.zoom;
    this.bgCover.setScale(Math.max(1, Math.ceil(cover * 1.05 * 2) / 2));
    this.bgCover.setPosition(cx, cy - offset);
    this.drawVignette();
    this.placeReference();
  }

  private drawVignette() {
    const g = this.vignette;
    g.clear();
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      const a = (1 - i / steps) * 0.55;
      const inset = i * 5;
      g.fillStyle(0x0e0b16, a);
      g.fillRect(-2000, -2000, 4000, 2000 + inset); // above
      g.fillRect(-2000, ART.h - inset, 4000, 2000); // below
      g.fillRect(-2000, 0, 2000 + inset, ART.h); // left
      g.fillRect(ART.w - inset, 0, 2000, ART.h); // right
    }
  }

  private cellPos(cell: number) {
    return {
      x: BOARD.x + (cell % this.config.cols) * this.tileW,
      y: BOARD.y + Math.floor(cell / this.config.cols) * this.tileH,
    };
  }

  private placeTiles(animate: boolean) {
    const cells = this.state.solved ? this.config.goal : this.state.cells;
    const last = this.config.goal.length - 1;
    this.tiles.forEach((img, tile) => {
      const cell = cells.indexOf(tile);
      if (cell < 0) {
        // The missing stone waits below the board, hidden by the recess.
        const p = this.cellPos(last);
        img.setPosition(p.x, p.y + this.tileH + 4);
        return;
      }
      const p = this.cellPos(cell);
      if (animate)
        this.tweens.add({
          targets: img,
          x: p.x,
          y: p.y,
          duration: prefersReducedMotion() ? 200 : 900,
          ease: 'Cubic.easeInOut',
          delay: (tile % 3) * 60,
        });
      else img.setPosition(p.x, p.y);
    });
  }

  // -- UI ----------------------------------------------------------------------------

  private buildUi() {
    const o = this.overlay;
    o.button(
      `← ${HALL_TEXT.relief.back}`,
      () => this.back(),
      'pro-btn hall-back-btn',
    );
    this.status = o.element('div', 'hall-status');
    const bar = o.element('div', 'hall-closeup-bar');
    o.button(
      HALL_TEXT.relief.reset,
      () => {
        if (this.busy || this.state.solved) return;
        o.caption(HALL_TEXT.relief.confirmReset, {
          next: HALL_TEXT.relief.reset,
          onNext: () => this.reset(),
          extra: [
            { label: 'Avbryt', quiet: true, onClick: () => o.clearCaption() },
          ],
        });
      },
      'pro-btn',
      bar,
    ).dataset.id = 'reset';
    const compare = o.button(
      HALL_TEXT.relief.compare,
      () => {
        const on = this.reference.classList.toggle('is-visible');
        compare.textContent = on
          ? HALL_TEXT.relief.hideCompare
          : HALL_TEXT.relief.compare;
      },
      'pro-btn',
      bar,
    );
    o.iconButton(
      {
        id: 'help',
        label: 'Hjälp',
        icon: ICONS.hint,
        onClick: () =>
          o.caption(`${HALL_TEXT.relief.help} ${HALL_TEXT.relief.noUndo}`, {
            position: 'top',
          }),
      },
      bar,
    );
    this.reference = o.element('img', 'hall-reference');
    this.reference.src = hallAssetUrl('rel-reference-large');
    this.reference.alt = 'Väggmålningen: så ska reliefen se ut.';
  }

  private placeReference() {
    if (!this.reference) return;
    const { width: w, height: h } = this.scale;
    const size = Math.round(Math.min(w, h) * (h > w ? 0.34 : 0.3));
    Object.assign(this.reference.style, {
      width: `${size}px`,
      height: `${size}px`,
      right: '12px',
      top: h > w ? '116px' : '60px',
    });
  }

  private refresh() {
    const s = this.state;
    const max = this.config.moveBudget;
    this.status.textContent = s.solved
      ? HALL_TEXT.hotspots.relief.solved.split('.')[0] + '.'
      : HALL_TEXT.relief.movesLeft(s.movesLeft, max);
    this.status.classList.toggle('is-low', !s.solved && s.movesLeft <= 5);
    // Diegetic tally: a row of inlaid studs below the board; spent ones go dark.
    const g = this.pegs;
    g.clear();
    const y = BOARD.y + BOARD.size + BOARD.frame + 6;
    const gap = Math.min(6, (BOARD.size + BOARD.frame * 2) / max);
    const x0 = BOARD.x + BOARD.size / 2 - ((max - 1) * gap) / 2;
    for (let i = 0; i < max; i++) {
      const lit = s.solved || i < s.movesLeft;
      g.fillStyle(lit ? 0xe9b84f : 0x2a2030, 1);
      g.fillRect(Math.round(x0 + i * gap) - 1, y, 2, 2);
      if (lit) {
        g.fillStyle(0xfbe08c, 1);
        g.fillRect(Math.round(x0 + i * gap) - 1, y, 1, 1);
      }
    }
    for (const img of this.tiles)
      img.input!.cursor = s.solved ? 'default' : 'pointer';
  }

  // -- Input ----------------------------------------------------------------------------

  private onTile(tile: number, p: Phaser.Input.Pointer) {
    if (this.busy || !this.state || this.state.solved) return;
    const cell = this.state.cells.indexOf(tile);
    if (cell < 0) return;
    // A swipe that clearly points away from the empty slot is ignored, so a
    // slip of the finger doesn't spend a move.
    const down = this.tiles[tile].getData('down') as
      { x: number; y: number } | undefined;
    if (down && Math.hypot(p.x - down.x, p.y - down.y) > 18) {
      const e = emptyIndex(this.state.cells);
      const toward = {
        x: (e % this.config.cols) - (cell % this.config.cols),
        y:
          Math.floor(e / this.config.cols) -
          Math.floor(cell / this.config.cols),
      };
      if ((p.x - down.x) * toward.x + (p.y - down.y) * toward.y <= 0) return;
    }
    this.tryMove(cell);
  }

  private onKey(e: KeyboardEvent) {
    if (this.busy || !this.state || this.state.solved || this.overlay.panelOpen)
      return;
    if (e.key === 'Escape') return this.back();
    // Arrow = direction the TILE moves (into the empty slot).
    const delta: Record<string, [number, number]> = {
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
      ArrowLeft: [1, 0],
      ArrowRight: [-1, 0],
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const empty = emptyIndex(this.state.cells);
    const ex = empty % this.config.cols;
    const ey = Math.floor(empty / this.config.cols);
    const tx = ex + d[0];
    const ty = ey + d[1];
    if (tx < 0 || ty < 0 || tx >= this.config.cols || ty >= this.config.rows)
      return;
    this.tryMove(ty * this.config.cols + tx);
  }

  private tryMove(cell: number) {
    const { rows, cols } = this.config;
    if (!canSlide(this.state.cells, rows, cols, cell)) {
      // Locked stone: a tiny shudder, no move spent.
      const img = this.tiles[this.state.cells[cell]];
      if (img && !prefersReducedMotion())
        this.tweens.add({
          targets: img,
          x: img.x + 1,
          duration: 40,
          yoyo: true,
          repeat: 1,
        });
      return;
    }
    const tile = this.state.cells[cell];
    const result = slide(this.config, this.state, cell);
    this.busy = true;
    this.overlay.clearCaption();
    const img = this.tiles[tile];
    const to = this.cellPos(result.to);
    const reduce = prefersReducedMotion();
    playCue('stone-slide-small');
    // Heavy stone: a beat of resistance, a grinding slide, a dull stop.
    this.tweens.add({
      targets: img,
      x: to.x,
      y: to.y,
      delay: reduce ? 0 : 70,
      duration: reduce ? 120 : 300,
      ease: 'Cubic.easeInOut',
      onStart: () => this.grit(img.x, img.y),
      onComplete: () => {
        playCue('stone-settle-small');
        if (!reduce) this.cameras.main.shake(70, 0.0016);
        this.grit(to.x, to.y);
        this.state = result.state;
        if (result.outcome === 'exhausted') {
          saveRelief(this.state);
          this.refresh();
          this.time.delayedCall(250, () => this.exhausted());
          return;
        }
        saveRelief(this.state);
        this.refresh();
        if (result.outcome === 'solved') this.solved();
        else this.busy = false;
      },
    });
  }

  private grit(x: number, y: number) {
    const e = this.add.particles(0, 0, 'px', {
      x: { min: x, max: x + this.tileW },
      y: { min: y + this.tileH - 2, max: y + this.tileH },
      lifespan: { min: 300, max: 700 },
      speedY: { min: 4, max: 20 },
      speedX: { min: -8, max: 8 },
      gravityY: 40,
      alpha: { start: 0.8, end: 0 },
      tint: [0xc9a87e, 0x9c8470],
      emitting: false,
    });
    e.explode(prefersReducedMotion() ? 2 : 6);
    this.time.delayedCall(800, () => e.destroy());
  }

  private exhausted() {
    playCue('stone-rumble');
    if (!prefersReducedMotion()) this.cameras.main.shake(600, 0.003);
    this.placeTiles(true);
    this.time.delayedCall(prefersReducedMotion() ? 300 : 1100, () => {
      this.busy = false;
      this.overlay.caption(HALL_TEXT.relief.exhausted, { position: 'top' });
    });
  }

  private reset() {
    this.state = resetState(this.config);
    saveRelief(this.state);
    this.busy = true;
    playCue('stone-rumble');
    this.placeTiles(true);
    this.refresh();
    this.time.delayedCall(
      prefersReducedMotion() ? 250 : 1000,
      () => (this.busy = false),
    );
  }

  private solved() {
    const reduce = prefersReducedMotion();
    const missing = this.config.goal.findIndex((t) => t === EMPTY);
    const last = this.tiles[this.tiles.length - 1];
    const p = this.cellPos(missing);
    // The ninth stone rises from its hidden slot into the empty place.
    this.time.delayedCall(reduce ? 100 : 500, () => {
      playCue('stone-rumble');
      this.tweens.add({
        targets: last,
        y: p.y,
        x: p.x,
        duration: reduce ? 300 : 1600,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          playCue('mechanism-click');
          if (!reduce) this.cameras.main.shake(260, 0.004);
          const flash = this.add
            .rectangle(BOARD.x, BOARD.y, BOARD.size, BOARD.size, 0xffd27a, 0)
            .setOrigin(0)
            .setBlendMode(Phaser.BlendModes.ADD);
          this.tweens.add({
            targets: flash,
            fillAlpha: { from: 0.55, to: 0 },
            duration: 1200,
          });
          this.overlay.caption(HALL_TEXT.relief.solved, {
            next: HALL_TEXT.relief.back,
            onNext: () => this.back(true),
          });
          this.busy = false;
        },
      });
    });
  }

  private back(solvedNow = false) {
    if (this.busy && !solvedNow) return;
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(450, 6, 4, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () =>
        this.scene.start('hall', {
          from: 'relief-puzzle',
          ...(solvedNow ? { solvedNow: 'relief' } : {}),
        }),
    );
  }
}
