import Phaser from 'phaser';
import { crispen, setPixelMode } from '../prologue/assets';
import { ArtView } from '../prologue/artView';
import { TEXT } from '../prologue/content';
import { ICONS, Overlay } from '../prologue/overlay';
import {
  openInspectorPanel,
  openNotePanel,
  openSettingsPanel,
} from '../prologue/panels';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { crispenHall, preloadHall } from '../hall/assets';
import { HALL_TEXT } from '../hall/content';
import { EXIT } from '../world/pyramidMap';

const ART_W = 640;
const ART_H = 360;
const FAR_DOOR = { x: 320, y: 204 };
const MAX_BOOST = 2.2;

const HOTSPOTS = [
  {
    id: 'inscription',
    x: 229,
    y: 201,
    label: HALL_TEXT.corridor.inscriptionLabel,
  },
  {
    id: 'toHall',
    x: FAR_DOOR.x,
    y: FAR_DOOR.y,
    label: HALL_TEXT.corridor.toHall,
  },
] as const;

/** The short passage between the opened exterior door and the great hall. */
export class CorridorScene extends Phaser.Scene {
  private view!: ArtView;
  private overlay!: Overlay;
  private glow!: Phaser.GameObjects.Image;
  private busy = false;
  private ready = false;

  constructor() {
    super('corridor');
  }

  init() {
    this.busy = false;
    this.ready = false;
  }

  preload() {
    preloadHall(this, ['cor-main', 'cor-glow']);
  }

  create() {
    crispen(this);
    crispenHall(this);
    setPixelMode(true);
    const cam = this.cameras.main;
    cam.setRoundPixels(true);
    cam.setBackgroundColor('#0b0a0e');
    this.view = new ArtView(this, ART_W, ART_H, {
      x: ART_W / 2,
      y: ART_H / 2,
    });

    this.add.image(0, 0, 'cor-main').setOrigin(0);
    this.glow = this.add
      .image(0, 0, 'cor-glow')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.7);
    if (!prefersReducedMotion())
      this.tweens.add({
        targets: this.glow,
        alpha: 0.45,
        duration: 2800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    this.addParticles();
    this.view.layout();

    this.overlay = new Overlay('pro-corridor');
    this.buildHud();
    for (const h of HOTSPOTS)
      this.overlay.marker(h.id, h.label, () => this.inspect(h.id));
    this.refreshMarkers();

    this.input.keyboard?.on('keydown-ENTER', () => this.walk());
    this.input.keyboard?.on('keydown-UP', () => this.walk());

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      this.overlay.destroy();
    });

    void progress.load().then(() => this.start());
  }

  private start() {
    progress.advanceTo('corridor');
    progress.visitRoom('entrance-passage');
    progress.traverseExit(EXIT.entrance);
    progress.seeExit(EXIT.passageToHall);
    progress.commit((s) => (s.world.currentRoom = 'entrance-passage'));
    this.ready = true;
    this.cameras.main.fadeIn(700, 4, 6, 8);
    if (!progress.current().discoveredHotspots.includes('corridor-entered')) {
      progress.discover('corridor-entered');
      this.overlay.caption(HALL_TEXT.corridor.enter);
    }
    this.refreshMarkers();
  }

  private addParticles() {
    const reduce = prefersReducedMotion();
    this.add.particles(0, 0, 'px', {
      x: { min: 120, max: 520 },
      y: { min: 90, max: 290 },
      lifespan: 5200,
      speedX: { min: -3, max: 3 },
      speedY: { min: -4, max: 1 },
      alpha: {
        start: 0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.45,
      },
      tint: [0xf2d199, 0xe6b877],
      frequency: reduce ? 900 : 420,
      blendMode: Phaser.BlendModes.ADD,
    });
    this.add.particles(0, 0, 'px', {
      x: { min: FAR_DOOR.x - 22, max: FAR_DOOR.x + 22 },
      y: { min: FAR_DOOR.y - 30, max: FAR_DOOR.y + 24 },
      lifespan: 2800,
      speedX: { min: -4, max: 4 },
      speedY: { min: -6, max: -1 },
      alpha: {
        start: 0,
        end: 0,
        ease: (v: number) => Math.sin(v * Math.PI) * 0.5,
      },
      tint: [0x8fd6dc, 0x5fa9b4],
      frequency: reduce ? 700 : 280,
      blendMode: Phaser.BlendModes.ADD,
    });
  }

  private onResize() {
    this.view.layout();
  }

  // -- UI -------------------------------------------------------------------

  private buildHud() {
    this.overlay.hud([
      {
        id: 'hint',
        label: TEXT.ui.hint,
        icon: ICONS.hint,
        onClick: () => this.overlay.caption(HALL_TEXT.corridor.far),
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
        id: 'back',
        label: HALL_TEXT.corridor.back,
        icon: ICONS.back,
        onClick: () => this.leave('exterior'),
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

  private refreshMarkers() {
    const seen = progress.save?.discoveredHotspots ?? [];
    for (const h of HOTSPOTS) {
      const el = this.overlay.marker(h.id, h.label, () => this.inspect(h.id));
      el.dataset.seen = String(seen.includes(h.id));
      el.dataset.action = String(h.id === 'toHall');
    }
  }

  private inspect(id: (typeof HOTSPOTS)[number]['id']) {
    if (this.busy || !this.ready) return;
    if (id === 'toHall') return this.walk();
    progress.discover(id);
    this.refreshMarkers();
    this.overlay.caption(HALL_TEXT.corridor.inscription);
  }

  update() {
    for (const h of HOTSPOTS) {
      const s = this.view.worldToScreen(h.x, h.y);
      this.overlay.placeMarker(
        h.id,
        s.x,
        s.y,
        !this.busy &&
          !this.overlay.panelOpen &&
          this.view.isVisible(h.x, h.y, 4),
      );
    }
  }

  // -- Movement -------------------------------------------------------------

  private walk() {
    if (this.busy || !this.ready) return;
    this.busy = true;
    this.overlay.clearCaption();
    progress.traverseExit(EXIT.passageToHall);
    const reduce = prefersReducedMotion();
    const duration = reduce ? 300 : 1400;
    const startX = this.view.centerX;
    const startY = this.view.centerY;
    const state = { t: 0 };
    this.tweens.add({
      targets: state,
      t: 1,
      duration,
      ease: 'Cubic.easeIn',
      onUpdate: () => {
        const t = state.t;
        const bob = reduce
          ? 0
          : Math.sin(t * Math.PI * 5) * 2.2 * (1 - t * 0.4);
        this.view.setZoomBoost(1 + (MAX_BOOST - 1) * t);
        this.view.setCenter(
          startX + (FAR_DOOR.x - startX) * t,
          startY + (FAR_DOOR.y - startY) * t + bob,
        );
      },
    });
    this.time.delayedCall(duration - 450, () =>
      this.cameras.main.fadeOut(450, 4, 6, 8),
    );
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start('hall', { from: 'corridor' }),
    );
  }

  private leave(key: string, fade = 500) {
    if (this.busy) return;
    this.busy = true;
    this.overlay.clearCaption();
    this.cameras.main.fadeOut(fade, 4, 6, 8);
    this.cameras.main.once(
      Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE,
      () => this.scene.start(key),
    );
  }
}
