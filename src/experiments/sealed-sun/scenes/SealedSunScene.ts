import Phaser from 'phaser';
import { isPanGesture } from '../../../game/navigation/cameraPan';
import {
  DOOR,
  DOOR_HOLE,
  DOOR_SLAB,
  HOTSPOTS,
  ROOM,
  ROOM_H,
  ROOM_W,
  STAND_RECT,
  TORCHES,
  pointInPolygon,
  project,
  type Hotspot,
} from '../layout.ts';
import { PALETTE, toHexNumber, type Rgb } from '../art/palette.ts';
import { PixelCanvas } from '../art/pixelCanvas.ts';
import { FLAME_FRAMES, FLAME_H, FLAME_W } from '../art/propsArt.ts';
import { frameGeometry } from '../art/roomArt.ts';
import { drawSealMini } from '../art/sealArt.ts';
import { getArt, prefersReducedMotion, uploadCanvas } from '../phaserBridge.ts';
import {
  clearProgress,
  loadProgress,
  saveProgress,
  type SealedSunProgress,
} from '../state.ts';
import { TEXT } from '../text.ts';
import { Overlay } from '../ui/overlay.ts';
import type { CloseUpResult } from './SealedSunCloseUpScene.ts';

/**
 * The Sealed Sun chamber. Owns the room camera (pan, focus), the layered
 * door, ambient motion and the activation / opening sequence. The art comes
 * from the generators; puzzle rules from puzzle/sunSeal.ts; this scene only
 * composes and animates them.
 */

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: number;
  gravity: number;
}

const SLAB_TRAVEL = DOOR_HOLE.h + 3;

export class SealedSunScene extends Phaser.Scene {
  private progress!: SealedSunProgress;
  private overlay!: Overlay;
  private ready = false;
  private busy = false;
  private baseZoom = 1;

  private slab!: Phaser.GameObjects.Image;
  private slabGlow!: Phaser.GameObjects.Image;
  private beam!: Phaser.GameObjects.Image;
  private warmth!: Phaser.GameObjects.Rectangle;
  private spillCanvas!: PixelCanvas;
  private spillImage!: Phaser.GameObjects.Image;
  private channelCanvas!: PixelCanvas;
  private channelImage!: Phaser.GameObjects.Image;
  private miniCanvas!: PixelCanvas;
  private flames: Phaser.GameObjects.Image[] = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private markers: Phaser.GameObjects.Image[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private motes: Mote[] = [];
  private ambient: Mote[] = [];

  private drag: {
    x: number;
    y: number;
    scrollX: number;
    scrollY: number;
    panning: boolean;
    t: number;
  } | null = null;
  private velocity = { x: 0, y: 0 };
  private keyboardIndex = -1;
  private flameClock = 0;
  private slabDrop = 0;
  private reducedMotion = false;

  constructor() {
    super('sealed-sun');
  }

  create() {
    this.ready = false;
    this.busy = false;
    this.motes = [];
    this.ambient = [];
    this.flames = [];
    this.glows = [];
    this.markers = [];
    this.keyboardIndex = -1;
    this.reducedMotion = prefersReducedMotion();
    this.progress = loadProgress();
    this.cameras.main.setBackgroundColor('#07050b');
    const loading = this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'Stenen huggs ut …', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '18px',
        color: '#e6cc9c',
      })
      .setOrigin(0.5)
      .setScrollFactor(0);
    const parent = this.game.canvas.parentElement ?? document.body;
    this.overlay = new Overlay(
      parent,
      () => this.leave(),
      () => this.resetExperiment(),
    );
    this.overlay.setNarrative(
      TEXT.title,
      this.progress.doorOpen ? TEXT.introOpen : TEXT.intro,
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.overlay.destroy();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    });
    // Let the loading line paint before generating (a few hundred ms).
    this.time.delayedCall(30, () => {
      this.build();
      loading.destroy();
    });
  }

  private build() {
    const art = getArt();
    const L = art.layers;
    uploadCanvas(this, 'ss-room', L.room);
    uploadCanvas(this, 'ss-corridor', L.corridor);
    uploadCanvas(this, 'ss-slab', L.slab);
    uploadCanvas(this, 'ss-slab-glow', L.slabGlow);
    uploadCanvas(this, 'ss-stand', L.stand);
    uploadCanvas(this, 'ss-beam', L.beam);
    uploadCanvas(this, 'ss-glow', L.glow);
    art.flames.forEach((f, i) => uploadCanvas(this, `ss-flame-${i}`, f));
    uploadCanvas(this, 'ss-glint', glintCanvas());

    // Back to front: corridor, slab, room (with its hole), light, props.
    this.add.image(DOOR_HOLE.x, DOOR_HOLE.y, 'ss-corridor').setOrigin(0);
    this.slab = this.add
      .image(DOOR_SLAB.x, DOOR_SLAB.y, 'ss-slab')
      .setOrigin(0);
    this.slabGlow = this.add
      .image(DOOR_SLAB.x, DOOR_SLAB.y, 'ss-slab-glow')
      .setOrigin(0)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add.image(0, 0, 'ss-room').setOrigin(0);

    this.spillCanvas = new PixelCanvas(ROOM_W, ROOM_H);
    this.spillImage = this.add
      .image(0, 0, uploadCanvas(this, 'ss-spill', this.spillCanvas))
      .setOrigin(0);
    this.spillImage.setBlendMode(Phaser.BlendModes.ADD);
    this.channelCanvas = new PixelCanvas(ROOM_W, ROOM_H);
    this.channelImage = this.add
      .image(0, 0, uploadCanvas(this, 'ss-channel', this.channelCanvas))
      .setOrigin(0);
    this.channelImage.setBlendMode(Phaser.BlendModes.ADD);
    this.beam = this.add
      .image(0, 0, 'ss-beam')
      .setOrigin(0)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.warmth = this.add
      .rectangle(0, 0, ROOM_W, ROOM_H, toHexNumber(PALETTE.gold[3]), 1)
      .setOrigin(0)
      .setAlpha(0)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add.image(STAND_RECT.x, STAND_RECT.y, 'ss-stand').setOrigin(0);
    const disc = art.standDisc;
    this.miniCanvas = new PixelCanvas(disc.r * 2, disc.r * 2);
    this.add
      .image(
        STAND_RECT.x + disc.x - disc.r,
        STAND_RECT.y + disc.y - disc.r,
        uploadCanvas(this, 'ss-mini', this.miniCanvas),
      )
      .setOrigin(0);
    this.drawMini(this.progress.doorOpen ? 1 : 0);

    for (const torch of TORCHES) {
      const p = project(torch.x, torch.y, torch.z);
      const glow = this.add
        .image(Math.round(p.x), Math.round(p.y) - 6, 'ss-glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.5);
      const flame = this.add
        .image(
          Math.round(p.x - FLAME_W / 2),
          Math.round(p.y - FLAME_H + 1),
          'ss-flame-0',
        )
        .setOrigin(0);
      this.glows.push(glow);
      this.flames.push(flame);
    }
    this.fx = this.add.graphics();
    for (const h of HOTSPOTS) {
      const m = this.add
        .image(Math.round(h.marker.x), Math.round(h.marker.y), 'ss-glint')
        .setAlpha(0.7);
      this.markers.push(m);
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: m,
          alpha: 0.25,
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          delay: HOTSPOTS.indexOf(h) * 300,
        });
      }
    }
    for (let i = 0; i < 26; i++) this.ambient.push(this.newAmbientMote(true));

    if (this.progress.doorOpen) this.applyOpenState();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, ROOM_W, ROOM_H);
    cam.setRoundPixels(true);
    this.layout();
    cam.centerOn(ROOM_W / 2, ROOM_H / 2);
    this.clampCamera();
    if (!this.reducedMotion) cam.fadeIn(500, 7, 5, 11);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.bindInput();
    this.ready = true;
  }

  // -------------------------------------------------------------------------
  // Camera

  private layout() {
    const cam = this.cameras.main;
    const { width, height } = this.scale;
    cam.setSize(width, height);
    // Fill the viewport: the room height always fits, wider screens see more
    // of the room, narrow ones pan. Never letterbox.
    this.baseZoom = Math.max(height / ROOM_H, width / ROOM_W);
    if (!this.busy) cam.setZoom(this.baseZoom);
    this.clampCamera();
  }

  private clampCamera() {
    const cam = this.cameras.main;
    cam.scrollX = cam.clampX(cam.scrollX);
    cam.scrollY = cam.clampY(cam.scrollY);
    const view = cam.worldView;
    const left = cam.scrollX > cam.clampX(-Infinity) + 1;
    const right = cam.scrollX < cam.clampX(Infinity) - 1;
    if (view.width > 0)
      this.overlay.setPanCues(left && !this.busy, right && !this.busy);
  }

  private bindInput() {
    this.input.on(
      Phaser.Input.Events.POINTER_DOWN,
      (p: Phaser.Input.Pointer) => {
        if (this.busy) return;
        this.velocity = { x: 0, y: 0 };
        const cam = this.cameras.main;
        this.drag = {
          x: p.x,
          y: p.y,
          scrollX: cam.scrollX,
          scrollY: cam.scrollY,
          panning: false,
          t: p.time,
        };
      },
    );
    this.input.on(
      Phaser.Input.Events.POINTER_MOVE,
      (p: Phaser.Input.Pointer) => {
        if (!this.drag) {
          this.hover(p);
          return;
        }
        const dx = p.x - this.drag.x;
        const dy = p.y - this.drag.y;
        if (!this.drag.panning && isPanGesture(dx, dy))
          this.drag.panning = true;
        if (!this.drag.panning) return;
        const cam = this.cameras.main;
        const prevX = cam.scrollX;
        const prevY = cam.scrollY;
        cam.scrollX = this.drag.scrollX - dx / cam.zoom;
        cam.scrollY = this.drag.scrollY - dy / cam.zoom;
        this.clampCamera();
        const dt = Math.max(1, p.time - this.drag.t);
        // Smoothed, capped fling velocity (world px per ms).
        const cap = 0.25;
        const vx = Phaser.Math.Clamp((cam.scrollX - prevX) / dt, -cap, cap);
        const vy = Phaser.Math.Clamp((cam.scrollY - prevY) / dt, -cap, cap);
        this.velocity = {
          x: this.velocity.x * 0.5 + vx * 0.5,
          y: this.velocity.y * 0.5 + vy * 0.5,
        };
        this.drag.t = p.time;
      },
    );
    const end = (p: Phaser.Input.Pointer) => {
      const drag = this.drag;
      this.drag = null;
      if (!drag || this.busy) return;
      if (drag.panning) {
        // A pause before release means no fling.
        if (p.time - drag.t > 90) this.velocity = { x: 0, y: 0 };
        return;
      }
      this.velocity = { x: 0, y: 0 };
      const world = this.cameras.main.getWorldPoint(p.x, p.y);
      const hit = this.hotspotAt(world.x, world.y);
      if (hit) this.inspect(hit);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, end);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, end);

    const kb = this.input.keyboard;
    kb?.on('keydown-RIGHT', () => this.stepFocus(1));
    kb?.on('keydown-LEFT', () => this.stepFocus(-1));
    const activate = () => {
      if (this.busy || this.keyboardIndex < 0) return;
      this.inspect(this.orderedHotspots()[this.keyboardIndex]);
    };
    kb?.on('keydown-ENTER', activate);
    kb?.on('keydown-SPACE', activate);
  }

  private orderedHotspots() {
    return [...HOTSPOTS].sort((a, b) => a.focus.x - b.focus.x);
  }

  private stepFocus(dir: number) {
    if (this.busy || !this.ready) return;
    const list = this.orderedHotspots();
    this.keyboardIndex =
      this.keyboardIndex < 0
        ? dir > 0
          ? 1
          : 1
        : Phaser.Math.Clamp(this.keyboardIndex + dir, 0, list.length - 1);
    const h = list[this.keyboardIndex];
    this.cameras.main.pan(
      h.focus.x,
      ROOM_H / 2,
      350,
      'Sine.easeInOut',
      true,
      (_c, t) => {
        if (t === 1) this.clampCamera();
      },
    );
    this.markers.forEach((m, i) => m.setScale(HOTSPOTS[i] === h ? 1.6 : 1));
    this.overlay.setNarrative(h.label, 'Tryck Enter för att undersöka.');
  }

  private hotspotAt(x: number, y: number) {
    return HOTSPOTS.find((h) => pointInPolygon(x, y, h.polygon)) ?? null;
  }

  private hover(p: Phaser.Input.Pointer) {
    if (!this.ready || this.busy) return;
    const world = this.cameras.main.getWorldPoint(p.x, p.y);
    const hit = this.hotspotAt(world.x, world.y);
    this.game.canvas.style.cursor = hit ? 'pointer' : 'grab';
    this.markers.forEach((m, i) => m.setScale(HOTSPOTS[i] === hit ? 1.6 : 1));
  }

  // -------------------------------------------------------------------------
  // Inspecting

  private inspect(h: Hotspot) {
    if (h.id === 'door') {
      this.focusDoor();
      this.overlay.setNarrative(
        h.label,
        this.progress.doorOpen ? TEXT.doorOpen : TEXT.doorClosed,
      );
      return;
    }
    this.busy = true;
    this.velocity = { x: 0, y: 0 };
    this.markers.forEach((m) => m.setVisible(false));
    this.overlay.setPanCues(false, false);
    const cam = this.cameras.main;
    const saved = { x: cam.midPoint.x, y: cam.midPoint.y };
    const duration = this.reducedMotion ? 0 : 420;
    cam.pan(h.focus.x, h.focus.y, duration, 'Sine.easeInOut');
    cam.zoomTo(this.baseZoom * 1.7, duration, 'Sine.easeInOut');
    this.time.delayedCall(duration + 20, () => {
      this.scene.launch('sealed-sun-closeup', {
        view: h.id === 'seal' ? 'seal' : 'stele',
        overlay: this.overlay,
        progress: this.progress,
        onClose: (result: CloseUpResult) =>
          this.returnFromCloseup(h, saved, result),
      });
    });
  }

  private returnFromCloseup(
    h: Hotspot,
    saved: { x: number; y: number },
    result: CloseUpResult,
  ) {
    saveProgress(this.progress);
    const cam = this.cameras.main;
    const duration = this.reducedMotion ? 0 : 380;
    if (result.solvedNow) {
      this.drawMini(0);
      this.runActivation();
      return;
    }
    cam.pan(saved.x, saved.y, duration, 'Sine.easeInOut');
    cam.zoomTo(this.baseZoom, duration, 'Sine.easeInOut');
    this.drawMini(this.progress.doorOpen ? 1 : 0);
    if (h.id === 'stele') this.overlay.setNarrative(h.label, TEXT.steleReturn);
    else
      this.overlay.setNarrative(
        h.label,
        this.progress.seal.solved ? TEXT.sealLocked : TEXT.sealReturn,
      );
    this.time.delayedCall(duration + 20, () => {
      this.busy = false;
      this.markers.forEach((m) => m.setVisible(true));
      this.clampCamera();
    });
  }

  private focusDoor(duration = 450) {
    const cam = this.cameras.main;
    const f = frameGeometry();
    cam.pan(
      (f.outerL + f.outerR) / 2,
      ROOM_H / 2,
      this.reducedMotion ? 0 : duration,
      'Sine.easeInOut',
      true,
      (_c, t) => {
        if (t === 1) this.clampCamera();
      },
    );
  }

  private drawMini(glow: number) {
    drawSealMini(this.miniCanvas, this.progress.seal.rotations, 0.5, glow);
    uploadCanvas(this, 'ss-mini', this.miniCanvas);
  }

  // -------------------------------------------------------------------------
  // Activation and the door

  private runActivation() {
    this.busy = true;
    this.overlay.setNarrative(null, TEXT.activation);
    const cam = this.cameras.main;
    const midX =
      (STAND_RECT.x + STAND_RECT.w / 2 + frameGeometry().outerR) / 2 + 10;
    cam.pan(
      midX,
      ROOM_H / 2 + 10,
      this.reducedMotion ? 0 : 600,
      'Sine.easeInOut',
      true,
    );
    cam.zoomTo(this.baseZoom, this.reducedMotion ? 0 : 600, 'Sine.easeInOut');
    const channel = getArt().channel;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      delay: 500,
      duration: 900,
      onUpdate: (tw) => this.drawMini(tw.getValue() ?? 0),
    });
    this.tweens.addCounter({
      from: 0,
      to: 1.15,
      delay: 1200,
      duration: 1500,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const head = tw.getValue() ?? 0;
        this.channelCanvas.data.fill(0);
        for (const c of channel) {
          if (c.t > head) continue;
          const behind = head - c.t;
          const color: Rgb =
            behind < 0.05
              ? PALETTE.gold[6]
              : c.core
                ? PALETTE.gold[5]
                : PALETTE.gold[3];
          this.channelCanvas.put(c.x, c.y, color, behind < 0.05 ? 255 : 200);
          if (behind < 0.04 && Math.random() < 0.08) this.spawnSpark(c.x, c.y);
        }
        uploadCanvas(this, 'ss-channel', this.channelCanvas);
      },
      onComplete: () => {
        this.tweens.add({
          targets: this.slabGlow,
          alpha: { from: 0, to: 1 },
          duration: 500,
          ease: 'Sine.easeOut',
          onComplete: () => this.openDoor(),
        });
        this.focusDoor(700);
      },
    });
  }

  private openDoor() {
    this.overlay.setNarrative(null, TEXT.opening);
    const cam = this.cameras.main;
    const f = frameGeometry();
    const shake = (ms: number, k: number) => {
      if (!this.reducedMotion) cam.shake(ms, k);
    };
    // 1. Rumble; the sand locks drain.
    shake(900, 0.0016);
    const vents = [f.openL - 7, f.openR + 6];
    const sand = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        for (const vx of vents) {
          for (let i = 0; i < 2; i++) {
            this.motes.push({
              x: vx + Math.random() * 2,
              y: f.floor - 7,
              vx: (vx < f.openL ? -1 : 1) * (0.004 + Math.random() * 0.01),
              vy: 0.01,
              life: 0,
              max: 380,
              color: toHexNumber(
                PALETTE.sand[3 + Math.floor(Math.random() * 3)],
              ),
              gravity: 0.0004,
            });
          }
        }
      },
    });
    // 2. The first jolt.
    this.time.delayedCall(900, () => {
      this.slabDrop = 2;
      this.positionSlab();
      shake(140, 0.005);
      this.dustBurst(
        DOOR_HOLE.x,
        DOOR_HOLE.x + DOOR_HOLE.w,
        DOOR_HOLE.y,
        14,
        -1,
      );
      // 3. The slab grinds down into its slot.
      const duration = 4200;
      let lastBand = -1;
      this.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        delay: 300,
        ease: (t: number) =>
          t < 0.18
            ? (t / 0.18) ** 2 * 0.1
            : t > 0.86
              ? 1 - ((1 - t) / 0.14) ** 2 * 0.06
              : 0.1 + ((t - 0.18) / 0.68) * 0.84,
        onUpdate: (tw) => {
          const v = tw.getValue() ?? 0;
          this.slabDrop = 2 + Math.floor(v * (SLAB_TRAVEL - 2));
          this.positionSlab();
          const band = Math.floor(v * 9);
          if (band !== lastBand) {
            lastBand = band;
            shake(110, 0.0012); // grinding pulses
          }
          if (Math.random() < 0.7)
            this.dustBurst(
              DOOR_HOLE.x + 2,
              DOOR_HOLE.x + DOOR_HOLE.w - 2,
              DOOR_HOLE.y + DOOR_HOLE.h - 1,
              2,
              -1,
            );
          if (Math.random() < 0.35)
            this.dustBurst(
              DOOR_HOLE.x + 3,
              DOOR_HOLE.x + DOOR_HOLE.w - 3,
              DOOR_HOLE.y + 1,
              1,
              1,
            );
        },
        onComplete: () => {
          sand.remove();
          // 4. The heavy stop.
          shake(320, 0.007);
          this.dustBurst(
            DOOR_HOLE.x - 4,
            DOOR_HOLE.x + DOOR_HOLE.w + 4,
            DOOR_HOLE.y + DOOR_HOLE.h - 1,
            60,
            -1,
          );
          this.dustBurst(
            DOOR_HOLE.x + 2,
            DOOR_HOLE.x + DOOR_HOLE.w - 2,
            DOOR_HOLE.y + 1,
            18,
            1,
          );
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 260,
            onUpdate: (tw) => {
              const v = tw.getValue() ?? 0;
              this.slabDrop =
                SLAB_TRAVEL - Math.round(Math.sin(v * Math.PI) * 2);
              this.positionSlab();
            },
          });
          this.progress.doorOpen = true;
          saveProgress(this.progress);
          this.overlay.setNarrative(null, TEXT.opened);
          this.time.delayedCall(700, () => {
            this.busy = false;
            this.markers.forEach((m) => m.setVisible(true));
            this.clampCamera();
          });
        },
      });
    });
  }

  /** Slab position and everything keyed to how open the doorway is. */
  private positionSlab() {
    this.slab.y = DOOR_SLAB.y + this.slabDrop;
    this.slabGlow.y = this.slab.y;
    const open = Phaser.Math.Clamp(this.slabDrop / DOOR_HOLE.h, 0, 1);
    const slabTopY = DOOR.topY + open * (ROOM.floorY - DOOR.topY);
    this.spillCanvas.data.fill(0);
    for (const p of getArt().spill) {
      if (p.threshold > slabTopY) continue;
      const level = p.strength > 0.6 ? 4 : p.strength > 0.3 ? 3 : 2;
      this.spillCanvas.put(
        p.x,
        p.y,
        PALETTE.gold[level],
        Math.round(30 + p.strength * 95),
      );
    }
    uploadCanvas(this, 'ss-spill', this.spillCanvas);
    this.beam.setAlpha(open * 0.6);
    this.warmth.setAlpha(open * 0.025);
    this.slabGlow.setAlpha(Math.max(0, 1 - open * 1.4));
  }

  private applyOpenState() {
    this.slabDrop = SLAB_TRAVEL;
    this.positionSlab();
    this.slabGlow.setAlpha(0);
    for (const c of getArt().channel) {
      this.channelCanvas.put(
        c.x,
        c.y,
        c.core ? PALETTE.gold[5] : PALETTE.gold[3],
        200,
      );
    }
    uploadCanvas(this, 'ss-channel', this.channelCanvas);
  }

  // -------------------------------------------------------------------------
  // Particles

  private dustBurst(
    x0: number,
    x1: number,
    y: number,
    count: number,
    dir: 1 | -1,
  ) {
    if (this.reducedMotion) count = Math.ceil(count / 4);
    for (let i = 0; i < count; i++) {
      const rising = dir < 0;
      this.motes.push({
        x: x0 + Math.random() * (x1 - x0),
        y,
        vx: (Math.random() - 0.5) * (rising ? 0.03 : 0.006),
        vy: rising
          ? -(0.004 + Math.random() * 0.018)
          : 0.01 + Math.random() * 0.02,
        life: 0,
        max: rising ? 900 + Math.random() * 900 : 500 + Math.random() * 500,
        color: toHexNumber(
          rising
            ? PALETTE.limestone[6 + Math.floor(Math.random() * 3)]
            : PALETTE.sand[4],
        ),
        gravity: rising ? -0.000004 : 0.00012,
      });
    }
  }

  private spawnSpark(x: number, y: number) {
    this.motes.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.02,
      vy: -0.01 - Math.random() * 0.02,
      life: 0,
      max: 350,
      color: toHexNumber(PALETTE.gold[6]),
      gravity: 0.00004,
    });
  }

  private newAmbientMote(anywhere: boolean): Mote {
    const nearDoor = Math.random() < 0.6;
    const x = nearDoor
      ? DOOR_HOLE.x - 40 + Math.random() * (DOOR_HOLE.w + 80)
      : 160 + Math.random() * 240;
    return {
      x,
      y: anywhere ? 60 + Math.random() * 160 : 220 + Math.random() * 20,
      vx: (Math.random() - 0.5) * 0.004,
      vy: -0.002 - Math.random() * 0.004,
      life: anywhere ? Math.random() * 6000 : 0,
      max: 6000 + Math.random() * 4000,
      color: toHexNumber(PALETTE.limestone[9]),
      gravity: 0,
    };
  }

  update(_time: number, delta: number) {
    if (!this.ready) return;
    const dt = Math.min(delta, 50);
    // Pan momentum.
    if (
      !this.drag &&
      !this.busy &&
      (Math.abs(this.velocity.x) > 0.001 || Math.abs(this.velocity.y) > 0.001)
    ) {
      const cam = this.cameras.main;
      cam.scrollX += this.velocity.x * dt;
      cam.scrollY += this.velocity.y * dt;
      const decay = Math.exp(-dt / 190);
      this.velocity.x *= decay;
      this.velocity.y *= decay;
      this.clampCamera();
    }
    // Torches.
    this.flameClock += dt;
    if (this.flameClock > 85) {
      this.flameClock = 0;
      this.flames.forEach((f, i) => {
        f.setTexture(
          `ss-flame-${(Math.floor(Math.random() * FLAME_FRAMES) + i) % FLAME_FRAMES}`,
        );
      });
      const draft = this.progress.doorOpen ? 0.06 : 0;
      this.glows.forEach((g) => {
        g.setAlpha(0.46 + draft + Math.random() * 0.1);
        g.setScale(0.97 + Math.random() * 0.05);
      });
    }
    // Particles.
    this.fx.clear();
    const open = this.slabDrop / DOOR_HOLE.h;
    for (const m of this.ambient) {
      m.life += dt;
      m.x += m.vx * dt + Math.sin((m.life + m.y * 40) / 900) * 0.006 * dt;
      m.y += m.vy * dt;
      if (m.life > m.max || m.y < 30)
        Object.assign(m, this.newAmbientMote(false));
      const fade = Math.min(1, m.life / 800, (m.max - m.life) / 800);
      const inBeam = open > 0.2 && Math.abs(m.x - 280) < 40 + (m.y - 100) * 0.4;
      this.fx.fillStyle(
        inBeam ? toHexNumber(PALETTE.gold[6]) : m.color,
        fade * (inBeam ? 0.9 : 0.35),
      );
      this.fx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
    }
    this.motes = this.motes.filter((m) => {
      m.life += dt;
      m.vy += m.gravity * dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.life > m.max) return false;
      const a = 1 - m.life / m.max;
      this.fx.fillStyle(m.color, a * 0.9);
      this.fx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
      return true;
    });
  }

  private leave() {
    if (this.scene.isActive('sealed-sun-closeup'))
      this.scene.stop('sealed-sun-closeup');
    this.scene.start('menu');
  }

  private resetExperiment() {
    if (this.busy) return;
    clearProgress();
    this.scene.restart();
  }
}

function glintCanvas() {
  const c = new PixelCanvas(11, 11);
  const g = PALETTE.gold;
  for (let i = 0; i < 9; i++) {
    const d = Math.abs(i - 4);
    c.put(5, i + 1, d < 2 ? g[6] : g[4]);
    c.put(i + 1, 5, d < 2 ? g[6] : g[4]);
  }
  c.put(4, 4, g[5]);
  c.put(6, 4, g[5]);
  c.put(4, 6, g[5]);
  c.put(6, 6, g[5]);
  c.outline(PALETTE.ink);
  return c;
}
