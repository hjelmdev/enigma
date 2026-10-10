import Phaser from 'phaser';
import { generateArt, GATE, OBJECTS, ROOM } from './art/generate';
import { activate, initialize, moveMarker, type HorizonState } from './model';
import { HorizonSave } from './persistence';
import { HorizonUI } from './ui';

type Inspection = keyof typeof OBJECTS;
interface Dust {
  sprite: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  life: number;
}

export class HorizonScene extends Phaser.Scene {
  private state: HorizonState = initialize();
  private save!: HorizonSave;
  private ui!: HorizonUI;
  private slab!: Phaser.GameObjects.Image;
  private spill!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private flame!: Phaser.GameObjects.Graphics;
  private highlight!: Phaser.GameObjects.Graphics;
  private motes!: Phaser.GameObjects.Graphics;
  private opened = false;
  private opening = false;
  private inspection?: Inspection;
  private drag?: {
    x: number;
    y: number;
    scroll: number;
    moved: boolean;
    id: number;
  };
  private dust: Dust[] = [];
  private zoom = 1;
  private alive = false;
  private ready = false;
  private reduced = false;
  private savedCenter = 510;
  private keys?: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor() {
    super('hidden-horizon');
  }

  create() {
    this.alive = true;
    this.ready = false;
    this.opened = false;
    this.opening = false;
    this.inspection = undefined;
    this.dust = [];
    this.drag = undefined;
    this.reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const art = generateArt();
    for (const [name, raster] of Object.entries(art)) {
      const key = `horizon-${name}`;
      if (!this.textures.exists(key))
        this.textures
          .addCanvas(key, raster.canvas())!
          .setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.add.image(GATE.x, GATE.y, 'horizon-passage').setOrigin(0).setDepth(0);
    this.slab = this.add
      .image(GATE.x, GATE.y, 'horizon-slab')
      .setOrigin(0)
      .setDepth(1);
    this.add.image(0, 0, 'horizon-room').setOrigin(0).setDepth(2);
    this.spill = this.add
      .image(0, 0, 'horizon-spill')
      .setOrigin(0)
      .setDepth(3)
      .setAlpha(0);
    this.add.image(0, 0, 'horizon-atmosphere').setOrigin(0).setDepth(4);
    this.add
      .image(254, 125, 'horizon-relief')
      .setOrigin(0)
      .setDisplaySize(124, 119)
      .setDepth(4);
    this.add.image(377, 273, 'horizon-mechanism').setOrigin(0).setDepth(4);
    this.glow = this.add
      .image(422, 309, 'horizon-activation')
      .setAlpha(0)
      .setDepth(5)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.flame = this.add.graphics().setDepth(5);
    this.highlight = this.add.graphics().setDepth(6);
    this.motes = this.add.graphics().setDepth(5);
    this.keys = this.input.keyboard?.createCursorKeys();
    this.ui = new HorizonUI({
      inspect: (kind) => this.inspect(kind),
      close: () => this.close(),
      move: (index, delta) => {
        this.state = moveMarker(this.state, index, delta);
        this.ui.refresh(this.state);
        this.persist();
      },
      activate: () => this.tryActivate(),
      reset: () => {
        if (!this.ready || this.opening) return;
        this.state = initialize();
        this.persist();
        this.close();
        this.opened = false;
        this.slab.setY(GATE.y);
        this.spill.setAlpha(0);
        this.glow.setAlpha(0);
        this.ui.say(
          'Stjärnorna har flyttats. Kammaren väntar på en ny himmel.',
        );
      },
      menu: () => this.scene.start('menu'),
    });
    this.ui.busy(true);
    this.resize();
    this.cameras.main.scrollX = this.clampScroll(510 - this.scale.width / 2);
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.cancelDrag, this);
    this.input.on('gameout', this.cancelDrag, this);
    this.input.keyboard?.on('keydown-ONE', () => this.inspect('relief'));
    this.input.keyboard?.on('keydown-TWO', () => this.inspect('mechanism'));
    this.scale.on('resize', this.resize, this);
    this.save = new HorizonSave();
    void this.save.load().then((state) => {
      if (!this.alive) return;
      this.state = state;
      this.ready = true;
      this.ui.busy(false);
      if (state.solved) this.finishDoor();
    });
    this.events.once('shutdown', () => {
      this.alive = false;
      this.save.close();
      this.ui.destroy();
      this.scale.off('resize', this.resize, this);
      this.input.off('pointerdown', this.pointerDown, this);
      this.input.off('pointermove', this.pointerMove, this);
      this.input.off('pointerup', this.pointerUp, this);
      this.input.off('pointerupoutside', this.cancelDrag, this);
      this.input.off('gameout', this.cancelDrag, this);
      this.input.keyboard?.removeAllListeners();
    });
  }

  private persist() {
    void this.save.save(this.state).then((ok) => {
      if (!ok && this.alive)
        this.ui.say(
          'Framstegen finns kvar här, men webbläsaren kunde inte spara dem till nästa besök.',
        );
    });
  }
  private clampScroll(value: number) {
    // Phaser zooms about the viewport centre. Scroll is offset by half the
    // unscaled viewport; its bounds account for the visible world dimensions.
    return this.cameras.main.clampX(value);
  }
  private resize() {
    const center = this.ready ? this.cameras.main.midPoint.x : 510;
    this.zoom = Math.max(
      this.scale.height / ROOM.height,
      this.scale.width / ROOM.width,
    );
    this.cameras.main
      .setSize(this.scale.width, this.scale.height)
      .setZoom(this.zoom)
      .setRoundPixels(true)
      .setBounds(0, 0, ROOM.width, ROOM.height);
    this.cameras.main.centerOnY(ROOM.height / 2);
    this.cameras.main.scrollX = this.clampScroll(center - this.scale.width / 2);
  }
  private pointerDown(pointer: Phaser.Input.Pointer) {
    if (!this.ready || this.inspection || this.opening) return;
    this.drag = {
      x: pointer.x,
      y: pointer.y,
      scroll: this.cameras.main.scrollX,
      moved: false,
      id: pointer.id,
    };
  }
  private pointerMove(pointer: Phaser.Input.Pointer) {
    if (this.inspection || this.opening) return;
    if (this.drag && pointer.id === this.drag.id && pointer.isDown) {
      if (Math.hypot(pointer.x - this.drag.x, pointer.y - this.drag.y) > 14)
        this.drag.moved = true;
      if (this.drag.moved)
        this.cameras.main.scrollX = this.clampScroll(
          this.drag.scroll - (pointer.x - this.drag.x) / this.zoom,
        );
    }
    this.highlight.clear();
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const object = this.findObject(world.x, world.y);
    if (object && !this.drag?.moved) {
      const pos = OBJECTS[object];
      this.highlight.lineStyle(1, 0xd7e7c4, 0.75).strokeCircle(pos.x, pos.y, 8);
      this.game.canvas.style.cursor = 'pointer';
    } else this.game.canvas.style.cursor = 'grab';
  }
  private pointerUp(pointer: Phaser.Input.Pointer) {
    if (!this.drag || pointer.id !== this.drag.id) return;
    const moved =
      this.drag.moved ||
      Math.hypot(pointer.x - this.drag.x, pointer.y - this.drag.y) > 14;
    this.drag = undefined;
    if (moved) return;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const kind = this.findObject(point.x, point.y);
    if (kind) this.inspect(kind);
  }
  private cancelDrag() {
    this.drag = undefined;
  }
  private findObject(x: number, y: number): Inspection | undefined {
    return (Object.keys(OBJECTS) as Inspection[]).find((id) => {
      const object = OBJECTS[id];
      return (
        Math.abs(x - object.x) < object.width / 2 &&
        Math.abs(y - object.y) < object.height / 2
      );
    });
  }
  private inspect(kind: Inspection) {
    if (!this.ready || this.opening) return;
    if (!this.inspection)
      this.savedCenter = this.cameras.main.scrollX + this.scale.width / 2;
    this.inspection = kind;
    this.drag = undefined;
    this.highlight.clear();
    const object = OBJECTS[kind];
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: this.clampScroll(object.x - this.scale.width / 2),
      duration: this.reduced ? 0 : 230,
      ease: 'Sine.easeInOut',
    });
    this.ui.open(kind, this.state);
  }
  private close() {
    if (this.opening) return;
    this.inspection = undefined;
    this.ui.close();
    this.tweens.killTweensOf(this.cameras.main);
    this.tweens.add({
      targets: this.cameras.main,
      scrollX: this.clampScroll(this.savedCenter - this.scale.width / 2),
      duration: this.reduced ? 0 : 200,
    });
  }
  private tryActivate() {
    if (this.opening || this.state.solved) return;
    const next = activate(this.state);
    if (!next.solved) {
      this.ui.feedback(
        'Ett mjukt klick. Stjärnorna stämmer ännu inte med reliefens himmel.',
      );
      return;
    }
    this.state = next;
    this.persist();
    this.ui.refresh(this.state);
    this.ui.feedback('Stjärnorna låser sig. Något vaknar inne i stenen.');
    this.ui.celebrate();
    this.opening = true;
    this.time.delayedCall(this.reduced ? 100 : 950, () => {
      this.inspection = undefined;
      this.ui.close();
      this.ui.busy(true);
      this.ui.say('Bronsen sjunger till. Damm faller från portens överkant.');
      this.tweens.add({
        targets: this.glow,
        alpha: 1,
        duration: 550,
        yoyo: true,
        repeat: 1,
      });
      this.tweens.killTweensOf(this.cameras.main);
      this.tweens.add({
        targets: this.cameras.main,
        scrollX: this.clampScroll(550 - this.scale.width / 2),
        duration: 600,
        ease: 'Sine.easeInOut',
      });
      this.time.delayedCall(850, () => this.liftDoor());
    });
  }
  private emitDust(count: number, y = GATE.y) {
    for (let i = 0; i < count; i++) {
      const sprite = this.add
        .rectangle(
          GATE.x + Math.random() * GATE.width,
          y + Math.random() * 4,
          1 + Math.floor(Math.random() * 2),
          1,
          0xd4c09b,
          0.65,
        )
        .setDepth(7);
      this.dust.push({
        sprite,
        vx: (Math.random() - 0.5) * 15,
        vy: 4 + Math.random() * 13,
        life: 1 + Math.random() * 1.5,
      });
    }
  }
  private liftDoor() {
    this.emitDust(this.reduced ? 6 : 35);
    if (!this.reduced) this.cameras.main.shake(180, 0.002);
    // First take up the load, pause under tension, then haul the massive slab.
    this.tweens.add({
      targets: this.slab,
      y: GATE.y - 3,
      duration: 280,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.time.delayedCall(420, () => {
          this.ui.say('Långsamt dras basaltblocket upp i takets mörker.');
          this.tweens.add({
            targets: this.slab,
            y: GATE.y - GATE.height - 2,
            duration: this.reduced ? 1200 : 4800,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
              const progress = Phaser.Math.Clamp(
                (GATE.y - this.slab.y) / GATE.height,
                0,
                1,
              );
              this.spill.setAlpha(progress);
              if (Math.random() < 0.25 && !this.reduced)
                this.emitDust(1, Math.max(GATE.y, this.slab.y + GATE.height));
            },
            onComplete: () => {
              if (!this.reduced) this.cameras.main.shake(220, 0.004);
              this.emitDust(this.reduced ? 5 : 48);
              this.time.delayedCall(350, () => this.finishDoor());
            },
          });
        });
      },
    });
  }
  private finishDoor() {
    this.opening = false;
    this.opened = true;
    this.slab.setY(GATE.y - GATE.height - 2);
    this.spill.setAlpha(1);
    this.ui.busy(false);
    this.ui.say(
      'Stenen stannar med en tung suck. En trappa sjunker mot ett ljus som ingen borde ha tänt.',
    );
  }
  update(time: number, delta: number) {
    if (!this.flame) return;
    this.flame.clear();
    const flicker = Math.floor(time / 130) % 4;
    this.flame.fillStyle(0xffbe69, 0.07).fillCircle(217, 270, 34 + flicker);
    this.flame.fillStyle(0xc86b44).fillPoints(
      [
        { x: 206, y: 277 },
        { x: 210, y: 263 - flicker },
        { x: 216, y: 268 },
        { x: 222, y: 256 + flicker },
        { x: 228, y: 270 },
        { x: 228, y: 278 },
      ],
      true,
    );
    this.flame
      .fillStyle(0xefb96e)
      .fillRect(212, 269 - flicker, 11, 8 + flicker);
    this.flame.fillStyle(0xffe7b1).fillRect(216, 272, 5, 5);
    this.motes.clear();
    if (!this.reduced)
      for (let i = 0; i < 18; i++) {
        const phase = (time * 0.002 + i * 17) % 240;
        const x = 284 + i * 3.6 + Math.sin(time / 6000 + i) * 5;
        this.motes
          .fillStyle(0xe9d8ac, 0.08 + Math.sin((phase / 240) * Math.PI) * 0.18)
          .fillRect(Math.round(x), Math.round(92 + phase), 1, 1);
      }
    if (!this.inspection && !this.opening && this.keys) {
      const direction =
        (this.keys.right.isDown ? 1 : 0) - (this.keys.left.isDown ? 1 : 0);
      this.cameras.main.scrollX = this.clampScroll(
        this.cameras.main.scrollX + (direction * delta * 0.2) / this.zoom,
      );
    }
    const dt = Math.min(delta / 1000, 0.05);
    this.dust = this.dust.filter((particle) => {
      particle.life -= dt;
      particle.vy += dt * 12;
      particle.sprite.x += particle.vx * dt;
      particle.sprite.y += particle.vy * dt;
      particle.sprite.alpha = Math.min(0.6, particle.life * 0.4);
      if (particle.life <= 0) {
        particle.sprite.destroy();
        return false;
      }
      return true;
    });
    if (this.opened) this.glow.setAlpha(0.2);
  }
}
