import Phaser from 'phaser';
import { crispenHall, preloadHall } from '../hall/assets';
import { HALL_TEXT } from '../hall/content';
import {
  isSolved,
  PUZZLE_EXIT,
  reliefState,
  solvedCount,
  unlockDoor,
} from '../hall/hallState';
import type { HallPuzzle } from '../hall/hallState';
import layout from '../hall/hallLayout.json';
import { MAP_ICON, openMapPanel } from '../hall/mapPanel';
import { RELIEF_PUZZLE } from '../hall/puzzles';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { playCue } from '../prologue/audio';
import { TEXT } from '../prologue/content';
import { ICONS, Overlay } from '../prologue/overlay';
import {
  openInspectorPanel,
  openNotePanel,
  openSettingsPanel,
} from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { EMPTY } from '../puzzles/slidingTiles';
import { EXIT } from '../world/pyramidMap';

const L = layout.hall;

/** Slow to start (inertia), steady grind, short braking at the end. */
function heavyEase(t: number) {
  if (t < 0.2) return 2.5 * t * t;
  if (t < 0.9) return 0.1 + (t - 0.2) * (0.8 / 0.7);
  const u = (t - 0.9) / 0.1;
  return 0.9 + 0.1 * (1 - (1 - u) * (1 - u));
}
type DoorId = keyof typeof L.doors;
const DOOR_OF: Record<HallPuzzle, DoorId> = {
  relief: 'hall-relief-door',
  balance: 'hall-balance-door',
};

type HotspotId =
  | 'reference'
  | 'relief'
  | 'reliefDoor'
  | 'columns'
  | 'niche'
  | 'pedestal'
  | 'balance'
  | 'balanceDoor';

const P = L.reliefPanel;
const HOTSPOTS: Array<{ id: HotspotId; x: number; y: number }> = [
  {
    id: 'reference',
    x: L.reference.x + L.reference.width / 2,
    y: L.reference.y - 12,
  },
  { id: 'relief', x: P.x + (P.tile * 3) / 2, y: P.y + P.tile * 3 + 18 },
  {
    id: 'reliefDoor',
    x: L.doors['hall-relief-door'].x + 32,
    y: L.doors['hall-relief-door'].y + 70,
  },
  { id: 'columns', x: 610, y: 150 },
  { id: 'niche', x: 800, y: 112 },
  { id: 'pedestal', x: L.pedestal.x, y: L.pedestal.y - 56 },
  { id: 'balance', x: L.balance.x, y: L.balance.beamY - 46 },
  {
    id: 'balanceDoor',
    x: L.doors['hall-balance-door'].x + 32,
    y: L.doors['hall-balance-door'].y + 70,
  },
];

export interface HallData {
  from?: 'corridor' | 'relief-puzzle' | 'balance-puzzle' | 'stars';
  solvedNow?: HallPuzzle;
}

/** The monumental entrance hall: pannable hub with two sealed doors. */
export class HallScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private front!: Phaser.GameObjects.Image;
  private glowLayer!: Phaser.GameObjects.Image;
  private nicheLit!: Phaser.GameObjects.Image;
  private pedestalLit!: Phaser.GameObjects.Image;
  private slabs = new Map<DoorId, Phaser.GameObjects.Image>();
  private reliefTiles: Phaser.GameObjects.Image[] = [];
  private dataIn: HallData = {};
  private drag?: {
    id: number;
    lastX: number;
    lastY: number;
    t: number;
    v: number;
  };
  private velocity = 0;
  private busy = false;
  private idleMs = 0;

  constructor() {
    super('hall');
  }

  init(data: HallData) {
    this.dataIn = { ...(data ?? {}) };
    this.busy = false;
    this.velocity = 0;
    this.idleMs = 0;
    this.slabs.clear();
    this.reliefTiles = [];
  }

  preload() {
    preloadPrologue(this, []);
    preloadHall(this);
  }

  create() {
    crispen(this);
    crispenHall(this);
    setPixelMode(true);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0c0a15');
    this.view = new ArtView(this, L.width, L.height, {
      x: L.startCenterX,
      y: L.height / 2 + 20,
    });

    for (const [id, d] of Object.entries(L.doors) as Array<
      [DoorId, (typeof L.doors)[DoorId]]
    >) {
      this.add.image(d.x, d.y, `${id}-passage`).setOrigin(0);
      this.slabs.set(id, this.add.image(d.x, d.y, `${id}-slab`).setOrigin(0));
    }
    this.add.image(0, 0, 'hall-back').setOrigin(0);
    this.buildReliefTiles();
    this.nicheLit = this.add
      .image(0, 0, 'hall-niche-lit')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.pedestalLit = this.add
      .image(0, 0, 'hall-pedestal-lit')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.glowLayer = this.add
      .image(0, 0, 'hall-glow')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.buildFlames();
    this.buildMotes();
    this.front = this.add.image(0, 0, 'hall-front').setOrigin(0);
    this.view.layout();
    this.applyParallax();

    this.overlay = new Overlay('pro-hall');
    this.buildMarkers();
    this.bindInput();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });

    void progress.load().then(() => this.start());
  }

  // -- Setup ------------------------------------------------------------------

  private start() {
    progress.advanceTo('hall');
    progress.visitRoom('entrance-hall');
    progress.traverseExit(EXIT.passageToHall);
    progress.seeExit(EXIT.reliefDoor);
    progress.seeExit(EXIT.balanceDoor);
    progress.commit((s) => (s.world.currentRoom = 'entrance-hall'));
    const save = progress.current();
    if (save.hall.camX !== null && this.dataIn.from !== 'corridor')
      this.view.setCenter(save.hall.camX, this.view.centerY);
    this.applyParallax();
    this.buildHud();
    this.refreshReliefTiles();
    this.applyStaticStates();
    this.cameras.main.fadeIn(700, 6, 4, 10);

    const pending = (['relief', 'balance'] as HallPuzzle[]).find(
      (p) => isSolved(p) && !save.hall.doorsAnimated.includes(PUZZLE_EXIT[p]),
    );
    if (pending) {
      this.time.delayedCall(500, () => this.openDoor(pending));
      return;
    }
    if (!save.hall.arrived) this.arrival();
    else if (save.hall.mapAwake === 0) this.pedestalBeckon();
  }

  private buildReliefTiles() {
    const tex = this.textures.get('rel-mini');
    for (let i = 0; i < 9; i++)
      if (!tex.has(String(i)))
        tex.add(String(i), 0, i * P.tile, 0, P.tile, P.tile);
    for (let i = 0; i < 9; i++)
      this.reliefTiles.push(
        this.add
          .image(0, 0, 'rel-mini', String(i))
          .setOrigin(0)
          .setVisible(false),
      );
  }

  private refreshReliefTiles() {
    const state = reliefState();
    const cells = state.solved ? RELIEF_PUZZLE.goal : state.cells;
    this.reliefTiles.forEach((t) => t.setVisible(false));
    cells.forEach((tile, cell) => {
      if (tile === EMPTY) return;
      const img = this.reliefTiles[tile];
      img
        .setPosition(
          P.x + (cell % 3) * P.tile,
          P.y + Math.floor(cell / 3) * P.tile,
        )
        .setVisible(true);
    });
    if (state.solved) {
      // The missing ninth stone is in place once solved.
      const last = this.reliefTiles[8];
      last.setPosition(P.x + 2 * P.tile, P.y + 2 * P.tile).setVisible(true);
    }
  }

  private applyStaticStates() {
    const save = progress.current();
    for (const p of ['relief', 'balance'] as HallPuzzle[]) {
      const exit = PUZZLE_EXIT[p];
      // Keep the world graph consistent with puzzle state (idempotent).
      if (isSolved(p)) unlockDoor(p);
      if (isSolved(p) && save.hall.doorsAnimated.includes(exit)) {
        this.slabs.get(DOOR_OF[p])?.setVisible(false);
        this.coolAir(DOOR_OF[p], 0.35);
      }
    }
    if (save.hall.mapAwake > 0) {
      this.nicheLit.setAlpha(0.25 + solvedCount() * 0.15);
      this.breathe(this.nicheLit, this.nicheLit.alpha, 0.12);
      this.pedestalLit.setAlpha(0.2);
    }
    if (save.hall.mapAwake > 0) this.showMapButton(true);
    this.refreshMarkers();
  }

  private buildFlames() {
    const reduce = prefersReducedMotion();
    const off = L.flameOffsets;
    const groups: Array<[number[][], keyof typeof off]> = [
      [L.braziers, 'braziers'],
      [L.torches, 'torches'],
      [L.lampStands, 'lampStands'],
      [L.smallLamps, 'smallLamps'],
    ];
    for (const [list, key] of groups)
      for (const [x, y] of list) {
        const [dy, size] = off[key];
        const fy = y + dy;
        this.add.particles(0, 0, 'px', {
          x: { min: x - size * 0.8, max: x + size * 0.8 },
          y: fy + 1,
          lifespan: { min: 260 + size * 40, max: 420 + size * 70 },
          speedY: { min: -14 - size * 3, max: -6 - size * 2 },
          speedX: { min: -3, max: 3 },
          scale: { start: Math.max(1, size * 0.45), end: 0.4 },
          alpha: { start: 1, end: 0 },
          tint: [0xfff1c0, 0xffc860, 0xff9440, 0xf06a28],
          frequency: reduce ? 140 : Math.max(16, 70 - size * 8),
          blendMode: Phaser.BlendModes.ADD,
        });
        // Occasional sparks rising from the big braziers.
        if (key === 'braziers' && !reduce)
          this.add.particles(0, 0, 'px', {
            x: { min: x - 8, max: x + 8 },
            y: fy - 4,
            lifespan: 1600,
            speedY: { min: -40, max: -18 },
            speedX: { min: -8, max: 8 },
            alpha: { start: 1, end: 0 },
            tint: [0xffd27a, 0xff9440],
            frequency: 420,
            blendMode: Phaser.BlendModes.ADD,
          });
      }
    if (!reduce)
      this.tweens.add({
        targets: this.glowLayer,
        alpha: { from: 0.86, to: 1 },
        duration: 180,
        yoyo: true,
        repeat: -1,
        ease: 'Stepped',
        easeParams: [3],
        repeatDelay: 90,
      });
  }

  private buildMotes() {
    // Dust drifting through the daylight shaft over the pedestal.
    const s = L.shaft;
    this.add.particles(0, 0, 'px', {
      x: { min: s.top[0] - 30, max: s.top[0] + 30 },
      y: { min: s.top[1] + 20, max: L.pedestal.y - 40 },
      lifespan: 6000,
      speedY: { min: 1, max: 5 },
      speedX: { min: -3, max: 3 },
      alpha: {
        start: 0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.7,
      },
      tint: 0xfff0c8,
      frequency: prefersReducedMotion() ? 900 : 260,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private breathe(
    target: Phaser.GameObjects.Image,
    base: number,
    amount: number,
  ) {
    if (prefersReducedMotion()) return;
    this.tweens.add({
      targets: target,
      alpha: { from: base, to: Math.max(0, base - amount) },
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private coolAir(id: DoorId, rate: number) {
    const d = L.doors[id];
    const tint =
      d.motion === 'sink' ? [0x8fd6dc, 0x5fa9b4] : [0xffb88a, 0xd9785a];
    this.add.particles(0, 0, 'px', {
      x: { min: d.x + 6, max: d.x + d.width - 6 },
      y: { min: d.y + 16, max: d.y + d.height - 4 },
      lifespan: 2800,
      speedX: { min: -5, max: 5 },
      speedY: { min: -5, max: -1 },
      alpha: {
        start: 0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.45,
      },
      tint,
      frequency: Math.round(280 / rate),
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  // -- UI -----------------------------------------------------------------------

  private buildHud() {
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
        id: 'artifact',
        label: TEXT.ui.artifact,
        icon: ICONS.artifact,
        onClick: () =>
          progress.current().hall.mapAwake > 0
            ? openMapPanel(this.overlay, { view: 'outer' })
            : openInspectorPanel(this.overlay),
      },
      {
        id: 'map',
        label: HALL_TEXT.map.inner,
        icon: MAP_ICON,
        onClick: () => openMapPanel(this.overlay, { view: 'inner' }),
      },
      {
        id: 'recenter',
        label: TEXT.ui.recenter,
        icon: ICONS.recenter,
        onClick: () => this.panTo(L.startCenterX, 700),
      },
      {
        id: 'menu',
        label: TEXT.ui.menu,
        icon: ICONS.menu,
        onClick: () => this.openMenu(),
      },
    ]);
    this.showMapButton(progress.current().hall.mapAwake > 0);
  }

  private showMapButton(show: boolean) {
    const b = this.overlay.hudButton('map');
    if (b) b.hidden = !show;
  }

  private openMenu() {
    const body = document.createElement('div');
    body.className = 'pro-row';
    const panel = this.overlay.panel(TEXT.ui.menu, body);
    this.overlay.button(
      TEXT.title.settings,
      () => {
        panel.close();
        openSettingsPanel(this.overlay, this);
      },
      'pro-btn',
      body,
    );
    this.overlay.button(
      HALL_TEXT.corridor.back,
      () => {
        panel.close();
        this.leave('corridor');
      },
      'pro-btn',
      body,
    );
    this.overlay.button(
      TEXT.ui.toTitle,
      () => {
        panel.close();
        this.leave('title');
      },
      'pro-btn',
      body,
    );
  }

  private hotspotLabel(id: HotspotId) {
    const h = HALL_TEXT.hotspots[id];
    return h.label;
  }

  private buildMarkers() {
    for (const h of HOTSPOTS)
      this.overlay.marker(h.id, this.hotspotLabel(h.id), () =>
        this.inspect(h.id),
      );
  }

  private refreshMarkers() {
    const save = progress.current();
    for (const h of HOTSPOTS) {
      const el = this.overlay.marker(h.id, this.hotspotLabel(h.id), () =>
        this.inspect(h.id),
      );
      el.dataset.seen = String(
        save.discoveredHotspots.includes(`hall-${h.id}`),
      );
      const action =
        (h.id === 'relief' && !isSolved('relief')) ||
        (h.id === 'balance' && !isSolved('balance')) ||
        (h.id === 'pedestal' && save.hall.mapAwake === 0 && save.hall.arrived);
      el.dataset.action = String(action);
    }
  }

  private inspect(id: HotspotId) {
    if (this.busy) return;
    this.idleMs = 0;
    progress.discover(`hall-${id}`);
    this.refreshMarkers();
    const h = HOTSPOTS.find((s) => s.id === id)!;
    if (!this.view.isVisible(h.x, h.y, 24)) this.panTo(h.x, 320);
    const close = {
      label: TEXT.ui.close,
      quiet: true,
      onClick: () => this.overlay.clearCaption(),
    };
    const t = HALL_TEXT.hotspots;
    const save = progress.current();
    switch (id) {
      case 'relief':
        if (isSolved('relief')) return this.overlay.caption(t.relief.solved);
        return this.overlay.caption(t.relief.text, {
          next: t.relief.action,
          onNext: () => this.enterCloseup('relief-puzzle'),
          extra: [close],
        });
      case 'balance':
        if (isSolved('balance')) return this.overlay.caption(t.balance.solved);
        return this.overlay.caption(t.balance.text, {
          next: t.balance.action,
          onNext: () => this.enterCloseup('balance-puzzle'),
          extra: [close],
        });
      case 'pedestal':
        if (save.hall.mapAwake > 0)
          return this.overlay.caption(t.pedestal.awakened);
        return this.overlay.caption(t.pedestal.text, {
          next: t.pedestal.action,
          onNext: () => this.awakenMap(),
          extra: [close],
        });
      case 'niche':
        return this.overlay.caption(
          save.hall.mapAwake > 0 ? t.niche.textAwake : t.niche.text,
        );
      case 'reliefDoor':
        return this.overlay.caption(
          isSolved('relief') ? t.reliefDoor.opened : t.reliefDoor.text,
        );
      case 'balanceDoor':
        if (!isSolved('balance')) return this.overlay.caption(t.balanceDoor.text);
        return this.overlay.caption(t.balanceDoor.opened, {
          next: 'Gå in i Stjärnornas kammare',
          onNext: () => this.enterStars(),
        });
      default:
        return this.overlay.caption(t[id].text);
    }
  }

  private showHint() {
    this.idleMs = 0;
    this.overlay.hudButton('hint')?.classList.remove('is-pulsing');
    const h = HALL_TEXT.hints;
    const relief = isSolved('relief');
    const balance = isSolved('balance');
    if (relief && balance) return this.overlay.caption(h.done);
    const save = progress.current();
    // Alternate between the unsolved puzzles, gently.
    const seen = save.discoveredHotspots;
    if (!relief && (balance || !seen.includes('hall-relief')))
      return this.overlay.caption(h.relief);
    if (!balance && (relief || !seen.includes('hall-balance')))
      return this.overlay.caption(h.balance);
    this.overlay.caption(h.start);
  }

  private enterStars() {
    if (this.busy || !isSolved('balance')) return;
    progress.commit((s) => (s.hall.camX = Math.round(this.view.centerX)));
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(520, 7, 9, 18);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('star-chamber', { from: 'hall' }),
    );
  }

  // -- Camera -------------------------------------------------------------------

  private bindInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      this.velocity = 0;
      this.tweens.killTweensOf(this.view);
      this.drag = { id: p.id, lastX: p.x, lastY: p.y, t: p.time, v: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id || !p.isDown || this.busy) return;
      const dx = p.x - this.drag.lastX;
      const dy = p.y - this.drag.lastY;
      const dt = Math.max(1, p.time - this.drag.t);
      this.view.panByScreen(dx, dy);
      this.drag.v = dx / dt;
      this.drag.lastX = p.x;
      this.drag.lastY = p.y;
      this.drag.t = p.time;
      this.idleMs = 0;
      this.applyParallax();
    });
    const end = (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id) return;
      this.velocity = Phaser.Math.Clamp(this.drag.v, -3, 3);
      this.drag = undefined;
    };
    this.input.on('pointerup', end);
    this.input.on('pointerupoutside', end);
    this.input.keyboard?.on('keydown-LEFT', () => this.nudge(80));
    this.input.keyboard?.on('keydown-RIGHT', () => this.nudge(-80));
  }

  private nudge(screenDx: number) {
    if (this.busy) return;
    this.velocity = 0;
    this.panTo(this.view.centerX - screenDx / this.view.zoom, 260);
  }

  private panTo(x: number, duration: number, y = this.view.centerY) {
    this.tweens.killTweensOf(this.view);
    const target = this.view.clampCenter(x, y);
    return this.tweens.add({
      targets: this.view,
      centerX: target.x,
      centerY: target.y,
      duration: prefersReducedMotion() ? Math.min(duration, 200) : duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.view.setCenter(this.view.centerX, this.view.centerY);
        this.applyParallax();
      },
    });
  }

  private applyParallax() {
    // The near architrave and rubble move a little faster than the hall.
    this.front.x = Math.round(-140 - (this.view.centerX - L.width / 2) * 0.18);
  }

  private onResize() {
    this.view.layout();
    this.applyParallax();
  }

  update(_time: number, delta: number) {
    if (!this.drag && Math.abs(this.velocity) > 0.01) {
      this.view.panByScreen(this.velocity * delta, 0);
      this.velocity *= Math.exp(-delta / 200);
      const edge = this.view.canPan();
      if (!edge.left || !edge.right) this.velocity *= 0.5;
      this.applyParallax();
    }
    const hidden = this.busy || this.overlay.panelOpen;
    for (const h of HOTSPOTS) {
      const s = this.view.worldToScreen(h.x, h.y);
      this.overlay.placeMarker(
        h.id,
        s.x,
        s.y,
        !hidden && this.view.isVisible(h.x, h.y, 4),
      );
    }
    if (!this.busy && solvedCount() < 2) {
      this.idleMs += delta;
      if (this.idleMs > 60000)
        this.overlay.hudButton('hint')?.classList.add('is-pulsing');
    }
  }

  // -- Story beats ----------------------------------------------------------------

  private arrival() {
    this.busy = true;
    const reduce = prefersReducedMotion();
    // Start on the shaft of light, then reveal the width of the hall.
    this.view.setCenter(L.startCenterX, this.view.centerY);
    this.applyParallax();
    this.time.delayedCall(reduce ? 200 : 900, () => {
      this.busy = false;
      this.overlay.caption(HALL_TEXT.hall.arrival, {
        onNext: () => {
          progress.commit((s) => (s.hall.arrived = true));
          this.overlay.chip(HALL_TEXT.hall.arrivalLook, ICONS.look, 4200);
          if (!reduce && this.view.canPan().right) {
            const start = this.view.centerX;
            this.tweens.add({
              targets: this.view,
              centerX: start + 120,
              duration: 1400,
              ease: 'Sine.easeInOut',
              yoyo: true,
              onUpdate: () => {
                this.view.setCenter(this.view.centerX, this.view.centerY);
                this.applyParallax();
              },
              onComplete: () => this.pedestalBeckon(),
            });
          } else this.pedestalBeckon();
          this.refreshMarkers();
        },
      });
    });
  }

  /** The pedestal starts to answer the miniature in the player's bag. */
  private pedestalBeckon() {
    if (progress.current().hall.mapAwake > 0) return;
    this.tweens.add({ targets: this.pedestalLit, alpha: 0.5, duration: 1200 });
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: this.pedestalLit,
        alpha: { from: 0.5, to: 0.18 },
        duration: 1300,
        delay: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    this.overlay.hudButton('artifact')?.classList.add('is-pulsing');
    this.time.delayedCall(1400, () => {
      if (!this.overlay.hasCaption && !this.busy)
        this.overlay.caption(HALL_TEXT.hall.pedestalGlow);
    });
    this.refreshMarkers();
  }

  /** Staged awakening: pedestal flare → niche lines run → map opens inside. */
  private awakenMap() {
    this.busy = true;
    this.overlay.hudButton('artifact')?.classList.remove('is-pulsing');
    const reduce = prefersReducedMotion();
    this.panTo(L.pedestal.x, 700, this.view.centerY);
    this.tweens.killTweensOf(this.pedestalLit);
    playCue('map-awaken');
    this.tweens.add({
      targets: this.pedestalLit,
      alpha: 1,
      duration: 500,
      ease: 'Quad.easeOut',
    });
    if (!reduce) this.cameras.main.shake(400, 0.0015);
    this.time.delayedCall(reduce ? 200 : 700, () => {
      this.tweens.add({
        targets: this.nicheLit,
        alpha: { from: 0, to: 0.85 },
        duration: reduce ? 300 : 1400,
        ease: 'Stepped',
        easeParams: [6],
        onComplete: () => {
          this.tweens.add({
            targets: this.nicheLit,
            alpha: 0.28,
            duration: 1600,
          });
          this.tweens.add({
            targets: this.pedestalLit,
            alpha: 0.2,
            duration: 1600,
          });
        },
      });
    });
    this.time.delayedCall(reduce ? 600 : 2300, () => {
      progress.commit((s) => (s.hall.mapAwake = Math.max(1, s.hall.mapAwake)));
      this.busy = false;
      this.showMapButton(true);
      this.refreshMarkers();
      openMapPanel(this.overlay, {
        view: 'inner',
        awaken: true,
        onClose: () => {
          this.breathe(this.nicheLit, 0.28, 0.12);
          if (!this.overlay.hasCaption)
            this.overlay.caption(HALL_TEXT.hints.start);
        },
      });
    });
  }

  // -- Doors ------------------------------------------------------------------------

  /** Heavy stone door opening after a puzzle is solved (plays once). */
  private openDoor(puzzle: HallPuzzle) {
    const id = DOOR_OF[puzzle];
    const d = L.doors[id];
    const slab = this.slabs.get(id);
    this.busy = true;
    this.overlay.clearCaption();
    const reduce = prefersReducedMotion();
    const cam = this.cameras.main;
    const at = (ms: number, fn: () => void) =>
      this.time.delayedCall(reduce ? ms * 0.5 : ms, fn);
    unlockDoor(puzzle);
    this.panTo(d.x + d.width / 2, 900);

    // 1. The mechanism engages: a deep clunk, grit trickles from the joints.
    at(700, () => {
      playCue('stone-rumble');
      if (!reduce) cam.shake(500, 0.002);
      this.dustBurst(d.x, d.y - 2, d.width, 2, 10);
      this.trickle(d.x, d.y - 4, d.width, 1400);
      slab?.setTint(0xd8ccc4);
    });
    // 2. The slab moves: sinks into the floor slot, or is hauled up into the lintel.
    at(1500, () => {
      if (!slab) return;
      playCue('stone-slide');
      const travel = d.height + 2;
      const dir = d.motion === 'sink' ? 1 : -1;
      const state = { p: 0 };
      let emit = 0;
      this.tweens.add({
        targets: state,
        p: 1,
        duration: reduce ? 1500 : 3600,
        ease: heavyEase,
        onUpdate: () => {
          // Stepped, grinding motion: tiny pauses as if the stone catches.
          const p = state.p;
          const stutter = reduce ? 0 : Math.max(0, Math.sin(p * 40)) * 0.004;
          const off = Math.round((p - stutter) * travel) * dir;
          slab.setPosition(d.x, d.y + off);
          emit++;
          if (emit % 3 === 0) {
            if (dir > 0) this.dustBurst(d.x, d.y + d.height - 1, d.width, 1, 1);
            else this.dustBurst(d.x, d.y, d.width, 1, 1);
          }
          if (!reduce && emit % 20 === 0) cam.shake(160, 0.0014);
        },
        onComplete: () => {
          slab.setVisible(false);
          playCue('stone-settle');
          if (!reduce) cam.shake(320, 0.0045);
          this.dustBurst(d.x - 2, d.y + d.height - 4, d.width + 4, 4, 26);
          this.dustBurst(d.x - 2, d.y - 2, d.width + 4, 3, 14);
          playCue('cool-air');
          this.coolAir(id, 1.6);
        },
      });
    });
    // 3. Settle, record, let the miniature react.
    at(reduce ? 4000 : 6000, () => {
      progress.commit((s) => {
        if (!s.hall.doorsAnimated.includes(PUZZLE_EXIT[puzzle]))
          s.hall.doorsAnimated.push(PUZZLE_EXIT[puzzle]);
      });
      this.busy = false;
      this.refreshMarkers();
      const text =
        puzzle === 'relief'
          ? HALL_TEXT.hotspots.reliefDoor.opened
          : HALL_TEXT.hotspots.balanceDoor.opened;
      this.overlay.caption(text, { onNext: () => this.mapReacts() });
    });
  }

  /** The miniature notes the new connection; stronger once both are solved. */
  private mapReacts() {
    const save = progress.current();
    const count = solvedCount();
    if (save.hall.mapAwake === 0) {
      // Not awakened yet: the first solve wakes it here instead.
      this.pedestalBeckon();
      return;
    }
    const level = count >= 2 ? 3 : 2;
    if (save.hall.mapAwake >= level) return;
    progress.commit((s) => (s.hall.mapAwake = level));
    playCue('map-pulse');
    this.tweens.killTweensOf(this.nicheLit);
    this.tweens.add({
      targets: this.nicheLit,
      alpha: { from: 1, to: 0.25 + count * 0.15 },
      duration: level === 3 ? 2600 : 1600,
      ease: 'Sine.easeOut',
      onComplete: () => this.breathe(this.nicheLit, 0.25 + count * 0.15, 0.12),
    });
    if (level === 3 && !prefersReducedMotion())
      this.cameras.main.flash(500, 255, 210, 140);
    this.overlay.chip(
      level === 3 ? HALL_TEXT.map.bothSolved : HALL_TEXT.map.firstSolve,
      MAP_ICON,
      5200,
    );
    const btn = this.overlay.hudButton('map');
    btn?.classList.add('is-pulsing');
    window.setTimeout(() => btn?.classList.remove('is-pulsing'), 6000);
  }

  // -- Effects ------------------------------------------------------------------------

  private dustBurst(x: number, y: number, w: number, h: number, count: number) {
    const n = prefersReducedMotion() ? Math.ceil(count / 3) : count;
    const e = this.add.particles(0, 0, 'px', {
      x: { min: x, max: x + w },
      y: { min: y, max: y + h },
      lifespan: { min: 700, max: 1700 },
      speedX: { min: -12, max: 12 },
      speedY: { min: -12, max: 4 },
      gravityY: 22,
      alpha: { start: 0.85, end: 0 },
      scale: { start: 1, end: 2 },
      tint: [0xb8a088, 0x9c8470, 0xd2bc9c],
      emitting: false,
    });
    e.explode(n);
    this.time.delayedCall(1900, () => e.destroy());
  }

  private trickle(x: number, y: number, w: number, duration: number) {
    const e = this.add.particles(0, 0, 'px', {
      x: { min: x, max: x + w },
      y,
      lifespan: 900,
      speedY: { min: 18, max: 36 },
      gravityY: 70,
      alpha: { start: 0.9, end: 0.2 },
      tint: [0xc9a87e, 0xa88a66],
      frequency: prefersReducedMotion() ? 140 : 40,
    });
    this.time.delayedCall(duration, () => e.stop());
    this.time.delayedCall(duration + 1200, () => e.destroy());
  }

  // -- Transitions ----------------------------------------------------------------------

  private enterCloseup(key: 'relief-puzzle' | 'balance-puzzle') {
    progress.commit((s) => (s.hall.camX = Math.round(this.view.centerX)));
    const target = key === 'relief-puzzle' ? HOTSPOTS[1] : HOTSPOTS[6];
    this.busy = true;
    this.overlay.clearCaption();
    this.panTo(target.x, 400, target.y + 20);
    this.time.delayedCall(320, () => {
      this.tweens.add({
        targets: this.view,
        zoom: this.view.zoom * 2.4,
        duration: prefersReducedMotion() ? 200 : 700,
        ease: 'Cubic.easeIn',
        onUpdate: () => this.cameras.main.setZoom(this.view.zoom),
      });
      this.leave(key, 650);
    });
  }

  private leave(key: string, fade = 500) {
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(fade, 6, 4, 10);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start(key),
    );
  }
}
