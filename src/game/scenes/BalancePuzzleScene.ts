import Phaser from 'phaser';
import { crispenHall, preloadHall } from '../hall/assets';
import { HALL_TEXT } from '../hall/content';
import { balanceState, saveBalance } from '../hall/hallState';
import { HALL_BALANCE } from '../hall/puzzles';
import { preloadPrologue, setPixelMode } from '../prologue/assets';
import { playCue } from '../prologue/audio';
import { ICONS, Overlay } from '../prologue/overlay';
import { prefersReducedMotion, progress } from '../prologue/progress';
import {
  WEIGHT_KINDS,
  addWeight,
  countPieces,
  pullLever,
  puzzleFor,
  removeWeight,
} from '../puzzles/balanceScale';
import type {
  BalancePuzzle,
  BalanceState,
  ClueSide,
  WeightKind,
} from '../puzzles/balanceScale';

const ART = { w: 480, h: 360 };
const BEAM_HALF = 112;
const MAX_TILT = 0.21; // radians

/** Arrangement of the station for one screen shape (virtual art pixels). */
interface Arrangement {
  w: number;
  h: number;
  tablets: Array<{ x: number; y: number }>;
  pivot: { x: number; y: number };
  shelf: { x: number; y: number; w: number };
  lever: { x: number; y: number };
}

const LANDSCAPE: Arrangement = {
  w: 480,
  h: 360,
  tablets: [
    { x: 8, y: 20 },
    { x: 165, y: 20 },
    { x: 322, y: 20 },
  ],
  pivot: { x: 240, y: 150 },
  shelf: { x: 20, y: 316, w: 380 },
  lever: { x: 424, y: 250 },
};

const PORTRAIT: Arrangement = {
  w: 300,
  h: 470,
  tablets: [
    { x: 75, y: 6 },
    { x: 75, y: 54 },
    { x: 75, y: 102 },
  ],
  pivot: { x: 150, y: 214 },
  shelf: { x: 6, y: 420, w: 236 },
  lever: { x: 246, y: 384 },
};

/**
 * Vågens hemlighet. The beam is pinned level until the lever is pulled; only
 * then does the scale reveal anything. A failed weighing rerolls the puzzle
 * (new reliefs, shelf and vessel) deterministically from the stored seed.
 */
export class BalancePuzzleScene extends Phaser.Scene {
  private state!: BalanceState;
  private puzzle!: BalancePuzzle;
  private arr: Arrangement = LANDSCAPE;
  private overlay!: Overlay;
  private status!: HTMLDivElement;
  private holdBtn!: HTMLButtonElement;
  private busy = false;
  private zoom = 1;
  private beamAngle = 0;

  private bgCover!: Phaser.GameObjects.Image;
  private bg!: Phaser.GameObjects.Image;
  private lamps!: Phaser.GameObjects.Image;
  private glowLayer!: Phaser.GameObjects.Image;
  private post!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Image;
  private pans: Phaser.GameObjects.Image[] = [];
  private vessel!: Phaser.GameObjects.Image;
  private shelf!: Phaser.GameObjects.Image;
  private leverBase!: Phaser.GameObjects.Image;
  private lever!: Phaser.GameObjects.Image;
  private tablets: Phaser.GameObjects.Container[] = [];
  private tokens: Phaser.GameObjects.Image[] = [];
  private flames: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private leverDrag?: { startY: number; angle: number };

  constructor() {
    super('balance-puzzle');
  }

  preload() {
    preloadPrologue(this, []);
    preloadHall(this, [
      'bal-bg',
      'bal-lamps',
      'bal-glow',
      'bal-post',
      'bal-beam',
      'bal-pan',
      'bal-vessel',
      'bal-lever',
      'bal-lever-base',
      'bal-shelf',
      'bal-tablet',
      'bal-w-scarab',
      'bal-w-falcon',
      'bal-w-lotus',
      'bal-s-scarab',
      'bal-s-falcon',
      'bal-s-lotus',
      'bal-s-vessel',
    ]);
  }

  create() {
    crispenHall(this);
    setPixelMode(true);
    this.busy = false;
    this.beamAngle = 0;
    this.tablets = [];
    this.tokens = [];
    this.pans = [];
    this.flames = [];
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0e0b16');

    // The painted frieze row is left out here: the close-up sits lower on the wall.
    this.bgCover = this.add
      .image(0, 0, 'bal-bg')
      .setTint(0x5a4c66)
      .setCrop(0, 14, ART.w, ART.h - 14);
    this.bg = this.add
      .image(0, 0, 'bal-bg')
      .setOrigin(0)
      .setCrop(0, 14, ART.w, ART.h - 14);
    this.lamps = this.add.image(0, 0, 'bal-lamps').setOrigin(0);
    this.glowLayer = this.add
      .image(0, 0, 'bal-glow')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    for (let i = 0; i < 3; i++) this.tablets.push(this.add.container(0, 0));
    this.post = this.add.image(0, 0, 'bal-post').setOrigin(0);
    this.pans.push(this.add.image(0, 0, 'bal-pan').setOrigin(0.5, 0));
    this.pans.push(this.add.image(0, 0, 'bal-pan').setOrigin(0.5, 0));
    this.vessel = this.add.image(0, 0, 'bal-vessel').setOrigin(0.5, 1);
    this.beam = this.add.image(0, 0, 'bal-beam');
    this.shelf = this.add.image(0, 0, 'bal-shelf').setOrigin(0);
    this.leverBase = this.add.image(0, 0, 'bal-lever-base').setOrigin(0);
    this.lever = this.add.image(0, 0, 'bal-lever').setOrigin(0.5, 112 / 120);
    this.lever.setInteractive({
      useHandCursor: true,
      hitArea: new Phaser.Geom.Rectangle(-14, -6, 48, 130),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
    });
    this.bindLever();

    this.overlay = new Overlay('pro-balance');
    this.buildUi();
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
      this.overlay.destroy();
    });

    void progress.load().then(() => {
      this.state = balanceState();
      this.puzzle = puzzleFor(HALL_BALANCE, this.state);
      this.layout();
      this.buildTablets();
      this.buildTokens();
      this.refresh();
      cam.fadeIn(500, 6, 4, 10);
      if (!progress.current().discoveredHotspots.includes('balance-help')) {
        progress.discover('balance-help');
        this.overlay.caption(HALL_TEXT.balance.help, { position: 'top' });
      }
    });
  }

  // -- Layout -------------------------------------------------------------------------

  private layout() {
    const { width: w, height: h } = this.scale;
    const portrait = h > w * 1.05;
    this.arr = portrait ? PORTRAIT : LANDSCAPE;
    const a = this.arr;
    const uiTop = portrait ? 58 : 50;
    const uiBottom = portrait ? 76 : 64;
    let zoom = Math.min(w / a.w, (h - uiTop - uiBottom) / a.h);
    if (zoom >= 2) zoom = Math.floor(zoom * 2) / 2;
    this.zoom = Math.max(0.5, zoom);
    const cam = this.cameras.main;
    cam.setZoom(this.zoom);
    const offset = (uiTop - uiBottom) / 2 / this.zoom;
    cam.centerOn(a.w / 2, a.h / 2 - offset);
    // Wall: the art at 1:1 centred on the station, a darker cover behind it.
    const bx = Math.round(a.w / 2 - ART.w / 2);
    const by = portrait ? -14 : Math.round(a.h / 2 - ART.h / 2);
    this.bg.setPosition(bx, by);
    this.lamps.setPosition(bx, by);
    this.glowLayer.setPosition(bx, by);
    const cover = Math.max(w / ART.w, h / ART.h) / this.zoom;
    this.bgCover
      .setScale(Math.max(1, Math.ceil(cover * 2.1) / 2))
      .setPosition(a.w / 2, a.h / 2);
    this.bg.setVisible(true);
    this.placeFlames(bx, by);
    // Station parts relative to the pivot.
    const p = a.pivot;
    this.post.setPosition(p.x - 240, p.y - 150);
    this.shelf.setPosition(a.shelf.x, a.shelf.y).setCrop(0, 0, a.shelf.w, 40);
    this.leverBase.setPosition(a.lever.x, a.lever.y);
    this.lever.setPosition(a.lever.x + 26, a.lever.y + 52);
    this.tablets.forEach((t, i) =>
      t.setPosition(a.tablets[i].x, a.tablets[i].y),
    );
    this.applyBeam();
    if (this.puzzle) this.placeTokens(false);
  }

  private placeFlames(bx: number, by: number) {
    this.flames.forEach((f) => f.destroy());
    this.flames = [];
    for (const fx of [40, 440])
      this.flames.push(
        this.add.particles(0, 0, 'px', {
          x: { min: bx + fx - 3, max: bx + fx + 3 },
          y: by + 96,
          lifespan: 520,
          speedY: { min: -26, max: -12 },
          speedX: { min: -3, max: 3 },
          scale: { start: 2.2, end: 0.5 },
          alpha: { start: 1, end: 0 },
          tint: [0xfff1c0, 0xffc860, 0xff9440],
          frequency: prefersReducedMotion() ? 140 : 40,
          blendMode: Phaser.BlendModes.ADD,
        }),
      );
  }

  /** Beam rotation drives the pans (which always hang vertically). */
  private applyBeam() {
    const p = this.arr.pivot;
    this.beam.setPosition(p.x, p.y).setRotation(this.beamAngle);
    const c = Math.cos(this.beamAngle);
    const s = Math.sin(this.beamAngle);
    [-1, 1].forEach((side, i) => {
      const hx = p.x + side * BEAM_HALF * c;
      const hy = p.y + side * BEAM_HALF * s + 2;
      this.pans[i].setPosition(hx, hy);
    });
    const left = this.pans[0];
    this.vessel.setPosition(left.x, left.y + 66);
    if (this.puzzle) this.placePanTokens();
  }

  // -- Tablets and weights ---------------------------------------------------------------

  private buildTablets() {
    const p = this.puzzle;
    const clues: Array<{ left: ClueSide; right: ClueSide }> = [
      ...p.relations,
      {
        left: { pieces: { scarab: 0, falcon: 0, lotus: 0 }, target: 1 },
        right: { pieces: p.targetPieces, target: 0 },
      },
    ];
    this.tablets.forEach((t, i) => {
      t.removeAll(true);
      const clue = clues[i];
      if (!clue) return;
      t.add(this.add.image(0, 0, 'bal-tablet').setOrigin(0));
      const place = (sideClue: ClueSide, cx: number) => {
        const signs: string[] = [];
        if (sideClue.target)
          for (let k = 0; k < sideClue.target; k++) signs.push('vessel');
        for (const kind of WEIGHT_KINDS)
          for (let k = 0; k < sideClue.pieces[kind]; k++) signs.push(kind);
        const gap = 20;
        const x0 = cx - ((signs.length - 1) * gap) / 2;
        signs.forEach((s, k) =>
          t.add(this.add.image(Math.round(x0 + k * gap), 22, `bal-s-${s}`)),
        );
      };
      place(clue.left, 38);
      place(clue.right, 112);
      // Tap a tablet to read it aloud as text.
      const hit = this.add
        .zone(0, 0, 150, 44)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerup', () =>
        this.overlay.caption(this.describe(clue), { position: 'top' }),
      );
      t.add(hit);
    });
  }

  private describe(clue: { left: ClueSide; right: ClueSide }) {
    const k = HALL_TEXT.balance.kinds;
    const words = (s: ClueSide) => {
      const parts: string[] = [];
      if (s.target) parts.push('det förseglade kärlet');
      for (const kind of WEIGHT_KINDS)
        if (s.pieces[kind]) parts.push(`${s.pieces[kind]} ${k[kind]}`);
      return parts.join(' och ');
    };
    return HALL_TEXT.balance.relation(words(clue.left), words(clue.right));
  }

  private buildTokens() {
    this.tokens.forEach((t) => t.destroy());
    this.tokens = [];
    for (const kind of WEIGHT_KINDS)
      for (let i = 0; i < this.puzzle.inventory[kind]; i++) {
        const img = this.add.image(0, 0, `bal-w-${kind}`).setOrigin(0.5, 1);
        img.setData('kind', kind);
        img.setData('index', i);
        img.setInteractive({ useHandCursor: true });
        img.on('pointerup', () => this.toggleToken(img));
        this.tokens.push(img);
      }
    this.placeTokens(false);
  }

  /** On the pan: the first `placed[kind]` tokens of each kind. */
  private onPan(img: Phaser.GameObjects.Image) {
    const kind = img.getData('kind') as WeightKind;
    return (img.getData('index') as number) < this.state.placed[kind];
  }

  private shelfPos(img: Phaser.GameObjects.Image) {
    const s = this.arr.shelf;
    const kind = img.getData('kind') as WeightKind;
    const idx = img.getData('index') as number;
    const ki = WEIGHT_KINDS.indexOf(kind);
    const groupW = s.w / 3;
    const per = Math.max(1, this.puzzle.inventory[kind]);
    const step = Math.min(30, (groupW - 34) / Math.max(1, per - 1));
    const x0 = s.x + ki * groupW + groupW / 2 - ((per - 1) * step) / 2;
    return { x: Math.round(x0 + idx * step), y: s.y + 4 };
  }

  private panPos(order: number) {
    const pan = this.pans[1];
    const row = Math.floor(order / 3);
    const col = order % 3;
    const inRow = Math.min(3, countPieces(this.state.placed) - row * 3);
    const x = pan.x + (col - (inRow - 1) / 2) * 22;
    return { x: Math.round(x), y: Math.round(pan.y + 66 - row * 12) };
  }

  private placePanTokens() {
    let order = 0;
    for (const img of this.tokens)
      if (this.onPan(img) && !this.tweens.isTweening(img)) {
        const p = this.panPos(order++);
        img.setPosition(p.x, p.y).setDepth(5 + order);
      } else if (this.onPan(img)) order++;
  }

  private placeTokens(animate: boolean) {
    let order = 0;
    for (const img of this.tokens) {
      const target = this.onPan(img)
        ? this.panPos(order++)
        : this.shelfPos(img);
      img.setDepth(this.onPan(img) ? 5 + order : 2);
      if (!animate) img.setPosition(target.x, target.y);
      else this.arcTo(img, target.x, target.y);
    }
  }

  private arcTo(img: Phaser.GameObjects.Image, x: number, y: number) {
    const from = { x: img.x, y: img.y };
    const lift = Math.min(from.y, y) - 30;
    const st = { t: 0 };
    this.tweens.add({
      targets: st,
      t: 1,
      duration: prefersReducedMotion() ? 120 : 360,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = st.t;
        const mx = from.x + (x - from.x) * t;
        const my =
          (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * lift + t * t * y;
        img.setPosition(Math.round(mx), Math.round(my));
      },
      onComplete: () => playCue('weight-clink'),
    });
  }

  private toggleToken(img: Phaser.GameObjects.Image) {
    if (this.busy || this.state.solved) return;
    const kind = img.getData('kind') as WeightKind;
    this.overlay.clearCaption();
    this.state = this.onPan(img)
      ? removeWeight(this.state, kind)
      : addWeight(this.state, this.puzzle, kind);
    saveBalance(this.state);
    this.placeTokens(true);
    this.refresh();
  }

  // -- UI ---------------------------------------------------------------------------------

  private buildUi() {
    const o = this.overlay;
    o.button(
      `← ${HALL_TEXT.balance.back}`,
      () => this.back(),
      'pro-btn hall-back-btn',
    );
    this.status = o.element('div', 'hall-status');
    const bar = o.element('div', 'hall-closeup-bar');
    this.holdBtn = o.button(
      HALL_TEXT.balance.leverButton,
      () => {},
      'pro-btn pro-btn-primary hall-lever-btn',
      bar,
    );
    const fill = o.element('span', 'hall-lever-fill', this.holdBtn);
    let timer = 0;
    let startT = 0;
    let raf = 0;
    const stop = () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      fill.style.transform = 'scaleX(0)';
      if (!this.busy) this.setLeverAngle(0, true);
    };
    const begin = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.busy || this.state?.solved) return;
      startT = performance.now();
      const step = () => {
        const t = Math.min(1, (performance.now() - startT) / 900);
        fill.style.transform = `scaleX(${t})`;
        this.setLeverAngle(t * 0.9, false);
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
      timer = window.setTimeout(() => {
        fill.style.transform = 'scaleX(0)';
        this.commit();
      }, 900);
    };
    this.holdBtn.addEventListener('pointerdown', begin);
    for (const type of ['pointerup', 'pointerleave', 'pointercancel'])
      this.holdBtn.addEventListener(type, stop);
    this.holdBtn.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) begin(e);
    });
    this.holdBtn.addEventListener('keyup', (e) => {
      if (e.key === 'Enter' || e.key === ' ') stop();
    });
    o.iconButton(
      {
        id: 'help',
        label: 'Hjälp',
        icon: ICONS.hint,
        onClick: () => o.caption(HALL_TEXT.balance.help, { position: 'top' }),
      },
      bar,
    );
  }

  private refresh() {
    if (!this.state) return;
    const n = countPieces(this.state.placed);
    if (this.state.solved)
      this.status.textContent =
        HALL_TEXT.hotspots.balance.solved.split('.')[0] + '.';
    else
      this.status.textContent =
        n === 0
          ? HALL_TEXT.balance.leverIdle
          : `${HALL_TEXT.balance.pan}: ${n}`;
    this.holdBtn.disabled = this.state.solved;
  }

  private onKey(e: KeyboardEvent) {
    if (this.busy || !this.state || this.state.solved || this.overlay.panelOpen)
      return;
    if (e.key === 'Escape') return this.back();
    const idx = ['1', '2', '3'].indexOf(
      e.key.replace('!', '1').replace('"', '2').replace('#', '3'),
    );
    if (idx < 0) return;
    const kind = WEIGHT_KINDS[idx];
    this.state = e.shiftKey
      ? removeWeight(this.state, kind)
      : addWeight(this.state, this.puzzle, kind);
    saveBalance(this.state);
    this.placeTokens(true);
    this.refresh();
  }

  // -- Lever -------------------------------------------------------------------------------

  private setLeverAngle(t: number, animate: boolean) {
    const rot = -0.12 + t * 1.0; // up-left at rest → pulled down-right
    this.tweens.killTweensOf(this.lever);
    if (animate)
      this.tweens.add({
        targets: this.lever,
        rotation: rot,
        duration: 380,
        ease: 'Back.easeOut',
      });
    else this.lever.setRotation(rot);
  }

  private bindLever() {
    this.lever.setRotation(-0.12);
    this.lever.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy || this.state?.solved) return;
      this.leverDrag = { startY: p.y, angle: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.leverDrag || !p.isDown) return;
      // Requires a deliberate long downward pull (~110 screen px).
      const t = Phaser.Math.Clamp((p.y - this.leverDrag.startY) / 110, 0, 1);
      this.leverDrag.angle = t;
      this.setLeverAngle(t * 0.9, false);
    });
    const end = () => {
      if (!this.leverDrag) return;
      const pulled = this.leverDrag.angle >= 0.98;
      this.leverDrag = undefined;
      if (pulled) this.commit();
      else this.setLeverAngle(0, true);
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
  }

  /** The single commit action: unlock, swing, judge. */
  private commit() {
    if (this.busy || this.state.solved) return;
    if (countPieces(this.state.placed) === 0) {
      this.setLeverAngle(0, true);
      this.overlay.caption(HALL_TEXT.balance.empty, { position: 'top' });
      return;
    }
    this.busy = true;
    this.overlay.clearCaption();
    const reduce = prefersReducedMotion();
    this.setLeverAngle(1, true);
    playCue('lever-pull');
    if (!reduce) this.cameras.main.shake(120, 0.002);
    const result = pullLever(HALL_BALANCE, this.state);
    const swing = (to: number, dur: number, ease = 'Sine.easeInOut') =>
      new Promise<void>((res) =>
        this.tweens.add({
          targets: this,
          beamAngle: to,
          duration: reduce ? Math.min(dur, 200) : dur,
          ease,
          onUpdate: () => this.applyBeam(),
          onComplete: () => res(),
        }),
      );
    const wait = (ms: number) =>
      new Promise<void>((res) =>
        this.time.delayedCall(reduce ? ms * 0.4 : ms, res),
      );
    void (async () => {
      await wait(450);
      playCue('scale-unlock');
      if (result.outcome === 'balanced') {
        // Equilibrium: a few damped swings that settle exactly level.
        for (const a of [0.12, -0.08, 0.045, -0.02, 0]) await swing(a, 520);
        this.state = result.state;
        saveBalance(this.state);
        this.solvedFx();
        return;
      }
      // Failure: the heavy side drops hard, then the mechanism resets.
      const dir = result.outcome === 'too-light' ? -1 : 1; // vessel side (left) down when too light
      await swing(dir * MAX_TILT, 700, 'Quad.easeIn');
      playCue('stone-thud');
      if (!reduce) this.cameras.main.shake(260, 0.004);
      await swing(dir * (MAX_TILT - 0.03), 160, 'Sine.easeOut');
      this.overlay.caption(
        result.outcome === 'too-light'
          ? HALL_TEXT.balance.tooLight
          : HALL_TEXT.balance.tooHeavy,
        {
          position: 'top',
          next: false,
        },
      );
      await wait(1400);
      // Weights return to the shelf; beam rises level and locks again.
      this.state = result.state;
      saveBalance(this.state);
      this.placeTokens(true);
      await swing(0, 900);
      this.setLeverAngle(0, true);
      // Reliefs crack and re-form with new signs; new shelf and vessel.
      this.crackTablets();
      await wait(600);
      this.puzzle = result.puzzle;
      this.tablets.forEach((t) => t.setAlpha(0));
      this.buildTablets();
      this.buildTokens();
      this.tokens.forEach((t) => t.setAlpha(0));
      this.tweens.add({
        targets: [...this.tablets, ...this.tokens],
        alpha: 1,
        duration: reduce ? 150 : 700,
      });
      await wait(700);
      this.overlay.caption(HALL_TEXT.balance.rerolled, { position: 'top' });
      this.busy = false;
      this.refresh();
    })();
  }

  private crackTablets() {
    for (const t of this.tablets) {
      const e = this.add.particles(0, 0, 'px', {
        x: { min: t.x, max: t.x + 150 },
        y: { min: t.y, max: t.y + 44 },
        lifespan: { min: 500, max: 1100 },
        speedY: { min: -10, max: 30 },
        speedX: { min: -14, max: 14 },
        gravityY: 60,
        alpha: { start: 0.9, end: 0 },
        tint: [0xc9a87e, 0x9c8470, 0xe4d2b0],
        emitting: false,
      });
      e.explode(prefersReducedMotion() ? 6 : 24);
      this.time.delayedCall(1200, () => e.destroy());
      this.tweens.add({ targets: t, alpha: 0.2, duration: 300 });
    }
  }

  private solvedFx() {
    playCue('mechanism-click');
    const p = this.arr.pivot;
    const flash = this.add
      .circle(p.x, p.y, 70, 0xffd27a, 0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      fillAlpha: { from: 0.5, to: 0 },
      scale: { from: 0.4, to: 1.6 },
      duration: 1300,
    });
    if (!prefersReducedMotion()) this.cameras.main.shake(220, 0.003);
    this.refresh();
    this.overlay.caption(HALL_TEXT.balance.solved, {
      next: HALL_TEXT.balance.back,
      onNext: () => this.back(true),
    });
    this.busy = false;
  }

  private back(solvedNow = false) {
    if (this.busy) return;
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(450, 6, 4, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () =>
        this.scene.start('hall', {
          from: 'balance-puzzle',
          ...(solvedNow ? { solvedNow: 'balance' } : {}),
        }),
    );
  }
}
