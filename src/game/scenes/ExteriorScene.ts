import Phaser from 'phaser';
import { crispen, preloadPrologue, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { playCue } from '../prologue/audio';
import { TEXT } from '../prologue/content';
import { MiniatureTexture } from '../prologue/miniatureTexture';
import { ICONS, Overlay } from '../prologue/overlay';
import {
  openInspectorPanel,
  openNotePanel,
  openSettingsPanel,
} from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { SUN_DIRECTION } from '../puzzles/sunEye';
import layout from '../prologue/exteriorLayout.json';

const P = layout.panorama;
const DOOR = P.door;
const EYE = { x: P.eye.x, y: P.eye.y };
const CRADLE = { x: P.pedestal.x, y: P.pedestal.cradleY };

type HotspotId = keyof typeof TEXT.hotspots;

interface Hotspot {
  id: HotspotId;
  x: number;
  y: number;
}

const HOTSPOTS: Hotspot[] = [
  { id: 'ruins', x: 122, y: 210 },
  { id: 'stele', x: 301, y: 262 },
  // Markers sit beside the carvings so they never cover the art itself.
  { id: 'eye', x: EYE.x + 30, y: EYE.y - 12 },
  { id: 'frieze', x: P.frieze.x - 14, y: P.frieze.y + 8 },
  { id: 'door', x: DOOR.x + DOOR.width / 2, y: DOOR.y + DOOR.height / 2 },
  { id: 'pedestal', x: CRADLE.x, y: CRADLE.y + 12 },
  { id: 'jeep', x: P.jeep.x, y: P.jeep.y - 14 },
];

// ?review=reveal replays the entrance reveal once on load (debug/review).
let pendingReview =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('review') === 'reveal';

interface ExteriorData {
  arrival?: boolean;
  solvedNow?: boolean;
  review?: boolean;
}

/** The wide desert panorama, the eye relief and the hidden entrance. */
export class ExteriorScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private sky!: Phaser.GameObjects.Image;
  private far!: Phaser.GameObjects.Image;
  private slab?: Phaser.GameObjects.Image;
  private jamb!: Phaser.GameObjects.Graphics;
  private eyeLit!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Graphics;
  private cradleMini?: Phaser.GameObjects.Image;
  private dataIn: ExteriorData = {};
  private drag?: {
    id: number;
    x: number;
    y: number;
    lastX: number;
    t: number;
    v: number;
  };
  private velocity = 0;
  private busy = false;
  private idleMs = 0;
  private coolAir?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() {
    super('exterior');
  }

  init(data: ExteriorData) {
    this.dataIn = { ...(data ?? {}) };
    if (pendingReview) {
      pendingReview = false;
      this.dataIn.review = true;
    }
    this.busy = false;
    this.idleMs = 0;
    this.velocity = 0;
    this.slab = undefined;
    this.cradleMini = undefined;
  }

  preload() {
    preloadPrologue(this);
  }

  create() {
    crispen(this);
    setPixelMode(true);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#1b2f4f');
    this.view = new ArtView(this, P.width, P.height, {
      x: P.startCenterX,
      y: 200,
    });

    this.sky = this.add.image(0, 0, 'ext-sky').setOrigin(0);
    this.far = this.add.image(0, 0, 'ext-far').setOrigin(0);
    this.add.image(DOOR.x, DOOR.y, 'ext-passage').setOrigin(0);
    this.slab = this.add.image(DOOR.x, DOOR.y, 'ext-door').setOrigin(0);
    this.jamb = this.add.graphics().setAlpha(0);
    this.drawJamb();
    this.add.image(0, 0, 'ext-main').setOrigin(0);
    this.eyeLit = this.add
      .image(EYE.x, EYE.y, 'ext-eye-lit')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    this.beam = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(0, 0, 'ext-front').setOrigin(0);
    this.view.layout();
    this.applyParallax();

    this.overlay = new Overlay('pro-exterior');
    this.buildHud();
    this.buildMarkers();
    this.bindInput();

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });

    void progress.load().then(() => this.start());
  }

  private start() {
    progress.advanceTo('exterior');
    const save = progress.current();
    this.cameras.main.fadeIn(800, 8, 6, 10);
    if (this.dataIn.review) {
      progress.commit((s) => {
        s.sunEyeSolved = true;
        s.entranceOpened = false;
      });
      this.playReveal();
      return;
    }
    if (save.entranceOpened) {
      this.setOpened();
      if (this.dataIn.solvedNow)
        this.overlay.caption(TEXT.hotspots.passage.text);
      return;
    }
    if (save.sunEyeSolved) {
      this.playReveal();
      return;
    }
    if (this.dataIn.arrival) this.arrival();
  }

  // -- Presentation ---------------------------------------------------------

  private drawJamb() {
    const g = this.jamb;
    g.clear();
    g.fillStyle(0x0c090d, 0.85);
    g.fillRect(DOOR.x, DOOR.y, DOOR.width, 3);
    g.fillRect(DOOR.x, DOOR.y, 3, DOOR.height);
    g.fillStyle(0x0c090d, 0.45);
    g.fillRect(DOOR.x + 3, DOOR.y + 3, DOOR.width - 3, 2);
    g.fillRect(DOOR.x + 3, DOOR.y + 3, 2, DOOR.height - 3);
    g.fillStyle(0xd9b48a, 0.25);
    g.fillRect(DOOR.x + DOOR.width - 1, DOOR.y + 2, 1, DOOR.height - 2);
  }

  private applyParallax() {
    this.sky.x = this.view.parallaxOffset(0.15);
    this.far.x = this.view.parallaxOffset(0.5);
  }

  private onResize() {
    this.view.layout();
    this.applyParallax();
  }

  private setOpened() {
    this.slab?.destroy();
    this.slab = undefined;
    this.jamb.setAlpha(1);
    this.eyeLit.setAlpha(0.35);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: this.eyeLit,
        alpha: 0.2,
        duration: 2600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    this.startCoolAir(0.4);
    this.refreshMarkers();
  }

  private startCoolAir(rate: number) {
    this.coolAir?.destroy();
    this.coolAir = this.add.particles(0, 0, 'px', {
      x: { min: DOOR.x + 6, max: DOOR.x + DOOR.width - 6 },
      y: { min: DOOR.y + 10, max: DOOR.y + DOOR.height - 4 },
      lifespan: 2600,
      speedX: { min: -5, max: 5 },
      speedY: { min: -6, max: -1 },
      alpha: {
        start: 0.0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.5,
      },
      tint: [0x8fd6dc, 0x5fa9b4],
      frequency: Math.round(260 / rate),
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  // -- UI -------------------------------------------------------------------

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
        onClick: () => openInspectorPanel(this.overlay),
      },
      {
        id: 'recenter',
        label: TEXT.ui.recenter,
        icon: ICONS.recenter,
        onClick: () => this.recenter(),
      },
      {
        id: 'menu',
        label: TEXT.ui.menu,
        icon: ICONS.menu,
        onClick: () => this.openMenu(),
      },
    ]);
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
      TEXT.ui.toTitle,
      () => {
        panel.close();
        this.leave('title');
      },
      'pro-btn',
      body,
    );
  }

  private buildMarkers() {
    for (const h of HOTSPOTS)
      this.overlay.marker(h.id, TEXT.hotspots[h.id].label, () =>
        this.inspectHotspot(h.id),
      );
    this.refreshMarkers();
  }

  private refreshMarkers() {
    const save = progress.current();
    for (const h of HOTSPOTS) {
      const el = this.overlay.marker(h.id, this.hotspotLabel(h.id), () =>
        this.inspectHotspot(h.id),
      );
      el.dataset.seen = String(save.discoveredHotspots.includes(h.id));
      el.dataset.action = String(
        (h.id === 'pedestal' && !save.sunEyeSolved) ||
          (h.id === 'door' && save.entranceOpened),
      );
    }
  }

  private hotspotLabel(id: HotspotId) {
    if (id === 'door' && progress.current().entranceOpened)
      return TEXT.ui.enter;
    return TEXT.hotspots[id].label;
  }

  private inspectHotspot(id: HotspotId) {
    if (this.busy) return;
    this.idleMs = 0;
    const save = progress.current();
    progress.discover(id);
    this.refreshMarkers();
    const h = HOTSPOTS.find((s) => s.id === id)!;
    if (!this.view.isVisible(h.x, h.y, 20)) this.panTo(h.x, 300);
    if (id === 'door' && save.entranceOpened) return this.enterPassage();
    if (id === 'pedestal') {
      if (save.sunEyeSolved)
        return this.overlay.caption(TEXT.hotspots.pedestal.textSolved);
      return this.overlay.caption(TEXT.hotspots.pedestal.text, {
        next: TEXT.hotspots.pedestal.action,
        onNext: () => this.leave('sun-puzzle'),
        extra: [
          {
            label: TEXT.ui.close,
            quiet: true,
            onClick: () => this.overlay.clearCaption(),
          },
        ],
      });
    }
    if (id === 'eye' && save.sunEyeSolved)
      return this.overlay.caption(TEXT.hotspots.eye.textSolved);
    if (id === 'door' && save.entranceOpened) return;
    this.overlay.caption(TEXT.hotspots[id].text);
  }

  private showHint() {
    this.idleMs = 0;
    this.overlay.hudButton('hint')?.classList.remove('is-pulsing');
    const save = progress.current();
    if (save.entranceOpened)
      return this.overlay.caption(TEXT.hotspots.passage.text);
    const level = Math.min(save.hintLevel, TEXT.hints.length - 1);
    this.overlay.caption(TEXT.hints[level]);
    if (save.hintLevel < TEXT.hints.length)
      progress.commit((s) => (s.hintLevel = Math.min(3, s.hintLevel + 1)));
  }

  // -- Camera ---------------------------------------------------------------

  private bindInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      this.velocity = 0;
      this.drag = { id: p.id, x: p.x, y: p.y, lastX: p.x, t: p.time, v: 0 };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.drag || this.drag.id !== p.id || !p.isDown || this.busy) return;
      const dx = p.x - this.drag.lastX;
      const dt = Math.max(1, p.time - this.drag.t);
      this.view.panByScreen(dx, 0);
      this.drag.v = dx / dt;
      this.drag.lastX = p.x;
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
    this.input.keyboard?.on('keydown-LEFT', () => this.nudge(60));
    this.input.keyboard?.on('keydown-RIGHT', () => this.nudge(-60));
  }

  private nudge(screenDx: number) {
    if (this.busy) return;
    this.velocity = 0;
    this.panTo(this.view.centerX - screenDx / this.view.zoom, 260);
  }

  private panTo(x: number, duration: number, y = this.view.centerY) {
    this.tweens.killTweensOf(this.view);
    const target = this.view.clampCenter(x, y);
    this.tweens.add({
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

  private recenter() {
    this.panTo(P.startCenterX, 600, 200);
  }

  update(_time: number, delta: number) {
    if (!this.drag && Math.abs(this.velocity) > 0.01) {
      this.view.panByScreen(this.velocity * delta, 0);
      this.velocity *= Math.exp(-delta / 190);
      const edge = this.view.canPan();
      if (!edge.left || !edge.right) this.velocity *= 0.5;
      this.applyParallax();
    }
    // Keep DOM hotspot markers glued to the art.
    const save = progress.save;
    for (const h of HOTSPOTS) {
      const s = this.view.worldToScreen(h.x, h.y);
      const hidden =
        this.busy ||
        this.overlay.panelOpen ||
        (h.id === 'door' &&
          !save?.discoveredHotspots.includes('frieze') &&
          !save?.entranceOpened);
      this.overlay.placeMarker(
        h.id,
        s.x,
        s.y,
        !hidden && this.view.isVisible(h.x, h.y, 4),
      );
    }
    if (!this.busy && save && !save.sunEyeSolved) {
      this.idleMs += delta;
      if (this.idleMs > 45000)
        this.overlay.hudButton('hint')?.classList.add('is-pulsing');
    }
  }

  // -- Story beats ------------------------------------------------------------

  private arrival() {
    this.overlay.caption(TEXT.captions.arrival, {
      onNext: () => {
        this.overlay.chip(TEXT.ui.look, ICONS.look, 4200);
        if (!prefersReducedMotion() && this.view.canPan().right) {
          const start = this.view.centerX;
          this.tweens.add({
            targets: this.view,
            centerX: start + 70,
            duration: 1100,
            ease: 'Sine.easeInOut',
            yoyo: true,
            onUpdate: () => {
              this.view.setCenter(this.view.centerX, this.view.centerY);
              this.applyParallax();
            },
          });
        }
        this.time.delayedCall(1800, () => {
          if (!this.overlay.hasCaption)
            this.overlay.caption(TEXT.captions.firstHint);
        });
      },
    });
  }

  private playReveal() {
    this.busy = true;
    this.overlay.clearCaption();
    const reduce = prefersReducedMotion();
    const cam = this.cameras.main;
    const focusX =
      this.view.halfW * 2 > CRADLE.x - EYE.x + 120
        ? (CRADLE.x + EYE.x) / 2
        : EYE.x;
    this.panTo(focusX, 900, 210);

    // Miniature sits in the bronze cradle catching the sun.
    const MINI = 16;
    const mini = new MiniatureTexture(this, 'mini-cradle', MINI);
    const solution = { yaw: 44, pitch: -2 };
    const render = mini.update({
      ...solution,
      light: SUN_DIRECTION,
      glow: 1,
      scale: 0.36,
      viewTilt: 12,
    });
    this.cradleMini = this.add
      .image(CRADLE.x, CRADLE.y + 4, mini.key)
      .setOrigin(0.5, 0.7)
      .setAlpha(0);
    const apex = {
      x: CRADLE.x - MINI / 2 + render.apex.x,
      y: CRADLE.y + 4 - MINI * 0.7 + render.apex.y,
    };

    const beamState = { t: 0, a: 1 };
    const drawBeam = () => {
      const g = this.beam;
      g.clear();
      const x1 = apex.x + (EYE.x - apex.x) * beamState.t;
      const y1 = apex.y + (EYE.y - apex.y) * beamState.t;
      g.lineStyle(3, 0xffc66e, 0.18 * beamState.a);
      g.lineBetween(apex.x, apex.y, x1, y1);
      g.lineStyle(1, 0xff7a6a, 0.35 * beamState.a);
      g.lineBetween(apex.x, apex.y - 1, x1, y1 - 1);
      g.lineStyle(1, 0x7fe0ff, 0.35 * beamState.a);
      g.lineBetween(apex.x, apex.y + 1, x1, y1 + 1);
      g.lineStyle(1, 0xfff4d0, 0.95 * beamState.a);
      g.lineBetween(apex.x, apex.y, x1, y1);
      g.fillStyle(0xfff6d8, 0.9 * beamState.a);
      g.fillCircle(apex.x, apex.y, 1.5);
    };

    const at = (ms: number, fn: () => void) =>
      this.time.delayedCall(reduce ? ms * 0.6 : ms, fn);

    at(700, () =>
      this.tweens.add({ targets: this.cradleMini, alpha: 1, duration: 400 }),
    );
    at(1200, () => {
      playCue('sun-catch');
      this.tweens.add({
        targets: beamState,
        t: 1,
        duration: 650,
        ease: 'Quad.easeIn',
        onUpdate: drawBeam,
      });
    });
    at(1900, () => {
      playCue('eye-ignite');
      this.tweens.add({
        targets: this.eyeLit,
        alpha: { from: 0.2, to: 1 },
        duration: 420,
        ease: 'Stepped',
        easeParams: [4],
      });
      this.sandTrickle(1800);
    });
    at(2700, () => {
      playCue('stone-rumble');
      if (!reduce) cam.shake(700, 0.0025);
      this.tweens.add({
        targets: this.jamb,
        alpha: 1,
        duration: 800,
        ease: 'Sine.easeIn',
      });
      this.slab?.setTint(0xb7a9a6);
      this.dustBurst(DOOR.x, DOOR.y, DOOR.width, 1, 14);
      this.dustBurst(DOOR.x, DOOR.y + DOOR.height, DOOR.width, 1, 10);
    });
    let slideEmit = 0;
    at(3600, () => {
      playCue('stone-slide');
      if (!this.slab) return;
      const slab = this.slab;
      const startX = DOOR.x;
      const state = { x: 0 };
      this.tweens.add({
        targets: state,
        x: P.doorSlide,
        duration: reduce ? 1400 : 2700,
        ease: 'Cubic.easeInOut',
        onUpdate: () => {
          const jitter = reduce ? 0 : Math.round(Math.sin(state.x * 2.3) * 0.6);
          slab.setPosition(Math.round(startX + state.x), DOOR.y + jitter);
          slideEmit++;
          if (slideEmit % 3 === 0) {
            // Grit spills where the moving block grinds past the jamb.
            this.dustBurst(DOOR.x - 1, DOOR.y + 1, 2, DOOR.height - 2, 1);
            this.dustBurst(DOOR.x, DOOR.y + DOOR.height - 1, 6, 1, 1);
          }
          if (!reduce && slideEmit % 18 === 0) cam.shake(140, 0.0012);
        },
        onComplete: () => {
          playCue('stone-settle');
          if (!reduce) cam.shake(280, 0.004);
          this.dustBurst(DOOR.x - 2, DOOR.y, 6, DOOR.height, 22);
          slab.destroy();
          this.slab = undefined;
          playCue('cool-air');
          this.startCoolAir(1.6);
          this.time.delayedCall(2500, () => this.startCoolAir(0.4));
        },
      });
    });
    at(6900, () => {
      this.tweens.add({
        targets: beamState,
        a: 0,
        duration: 900,
        onUpdate: drawBeam,
      });
      this.tweens.add({ targets: this.eyeLit, alpha: 0.35, duration: 1200 });
      progress.commit((s) => {
        s.sunEyeSolved = true;
        s.entranceOpened = true;
        s.revealPlayed = true;
        if (!s.inventory.includes('miniature')) s.inventory.push('miniature');
      });
      this.panTo(EYE.x, 900, 220);
      this.overlay.caption(TEXT.captions.opened, {
        onNext: () =>
          this.overlay.caption(TEXT.captions.takeBack, {
            onNext: () => this.finishReveal(),
          }),
      });
    });
  }

  private finishReveal() {
    if (this.cradleMini)
      this.tweens.add({ targets: this.cradleMini, alpha: 0, duration: 500 });
    this.busy = false;
    this.setOpened();
    this.overlay.chip(TEXT.hotspots.passage.label, ICONS.artifact, 3000);
  }

  private dustBurst(x: number, y: number, w: number, h: number, count: number) {
    const reduce = prefersReducedMotion();
    const n = reduce ? Math.ceil(count / 3) : count;
    const e = this.add.particles(0, 0, 'px', {
      x: { min: x, max: x + w },
      y: { min: y, max: y + h },
      lifespan: { min: 700, max: 1600 },
      speedX: { min: -14, max: 6 },
      speedY: { min: -10, max: 4 },
      gravityY: 18,
      alpha: { start: 0.85, end: 0 },
      scale: { start: 1, end: 2 },
      tint: [0xd8b88e, 0xc29d74, 0xe9cfa6],
      emitting: false,
    });
    e.explode(n);
    this.time.delayedCall(1800, () => e.destroy());
  }

  private sandTrickle(duration: number) {
    const e = this.add.particles(0, 0, 'px', {
      x: { min: DOOR.x - 10, max: DOOR.x + DOOR.width + 10 },
      y: P.frieze.y - 4,
      lifespan: 900,
      speedY: { min: 20, max: 40 },
      gravityY: 60,
      alpha: { start: 0.9, end: 0.2 },
      tint: [0xe9c48a, 0xd2a46b],
      frequency: prefersReducedMotion() ? 120 : 30,
    });
    this.time.delayedCall(duration, () => e.stop());
    this.time.delayedCall(duration + 1200, () => e.destroy());
  }

  private enterPassage() {
    this.busy = true;
    this.overlay.clearCaption();
    const cam = this.cameras.main;
    this.panTo(DOOR.x + DOOR.width / 2, 500, DOOR.y + DOOR.height / 2);
    this.time.delayedCall(450, () => {
      this.tweens.add({
        targets: this.view,
        zoom: this.view.zoom * 3,
        duration: prefersReducedMotion() ? 200 : 900,
        ease: 'Cubic.easeIn',
        onUpdate: () => cam.setZoom(this.view.zoom),
      });
      this.leave('chapter1-gate', 900);
    });
  }

  private leave(key: string, fade = 500) {
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(fade, 4, 6, 8);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start(key),
    );
  }
}
