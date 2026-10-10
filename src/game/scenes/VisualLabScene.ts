import Phaser from 'phaser';
import {
  createSunSealState,
  rotateSunSeal,
  SUN_SEAL_HINTS,
  SEALED_SUN_ROOM,
  VISUAL_STYLES,
  type DoorState,
  type SunSealState,
  type RoomArtPack,
  type VisualStyleId,
} from '../visual-lab/model';

const ROOM = SEALED_SUN_ROOM;
// A 12px threshold is too sensitive to natural finger drift on phones; it
// turned ordinary taps on small hotspots into cancelled pan gestures.
const PAN_THRESHOLD = 22;

interface DoorLayers {
  corridor: Phaser.GameObjects.Image;
  doorGlow: Phaser.GameObjects.Arc;
  left: Phaser.GameObjects.Image;
  right: Phaser.GameObjects.Image;
  dust: Phaser.GameObjects.Particles.ParticleEmitter;
}

export class VisualLabScene extends Phaser.Scene {
  private ui!: Phaser.GameObjects.Container;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private roomObjects: Phaser.GameObjects.GameObject[] = [];
  private roomMode = false;
  private styleId: VisualStyleId = 'classic';
  private puzzle: SunSealState = createSunSealState();
  private doorState: DoorState = 'closed';
  private pointerStart?: {
    x: number;
    y: number;
    scrollX: number;
    moved: boolean;
  };
  private isOpening = false;
  private doorLayers?: DoorLayers;
  private puzzleView?: Phaser.GameObjects.Container;
  private hintLevel = 0;
  private panVelocity = 0;
  private lastPointerSample?: { x: number; time: number };
  private suppressTapUntil = 0;
  private hotspotTap?: { pointerId: number; onTap: () => void };
  private openingTweens: Phaser.Tweens.Tween[] = [];
  private puzzleDiscs: Phaser.GameObjects.Image[] = [];
  private puzzleBoard?: Phaser.GameObjects.Rectangle;
  private puzzleBoardArt?: Phaser.GameObjects.Image;
  private baseRoomZoom = 1;

  constructor() {
    super('visual-lab');
  }

  update(_time: number, delta: number) {
    if (
      this.pointerStart?.moved ||
      this.puzzleView ||
      this.doorState !== 'closed'
    )
      return;
    if (Math.abs(this.panVelocity) < 0.012) {
      this.panVelocity = 0;
      return;
    }
    const camera = this.cameras.main;
    const next = Phaser.Math.Clamp(
      camera.scrollX + this.panVelocity * delta,
      0,
      Math.max(0, ROOM.width - camera.width / camera.zoom),
    );
    if (next === camera.scrollX) this.panVelocity = 0;
    else camera.scrollX = next;
    this.panVelocity *= Math.pow(0.92, delta / 16.67);
  }

  init(data: { mode?: 'styles' | 'room'; style?: VisualStyleId }) {
    this.roomMode = data.mode === 'room';
    this.styleId = data.style ?? 'classic';
    this.puzzle = createSunSealState();
    this.doorState = 'closed';
    this.isOpening = false;
    this.pointerStart = undefined;
    this.hotspotTap = undefined;
    this.roomObjects = [];
    this.doorLayers = undefined;
    this.puzzleView = undefined;
    this.hintLevel = 0;
    this.panVelocity = 0;
    this.openingTweens = [];
    this.puzzleDiscs = [];
    this.puzzleBoard = undefined;
    this.puzzleBoardArt = undefined;
  }

  preload() {
    if (!this.roomMode) return;
    const style = VISUAL_STYLES.find(({ id }) => id === this.styleId);
    if (!style?.art) return;
    for (const [name, asset] of Object.entries(style.art)) {
      const key = this.textureKey(name);
      if (!this.textures.exists(key)) this.load.image(key, asset);
    }
  }

  create() {
    this.cameras.main.setBackgroundColor('#100d0b');
    this.cameras.main.fadeIn(180, 14, 10, 7);
    if (this.roomMode) this.createRoom();
    else this.createStyleMenu();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    });
  }

  private createStyleMenu() {
    const { width: w, height: h } = this.scale;
    this.add.rectangle(w / 2, h / 2, w, h, 0x100d0b).setDepth(-1);
    this.add
      .text(w / 2, h * 0.17, 'VISUAL LAB', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${Math.min(38, h * 0.075)}px`,
        color: '#eedab2',
        letterSpacing: 4,
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.25, 'KAMMAREN MED DET FÖRSEGLADE SOLSIGILLET', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Math.min(14, h * 0.026)}px`,
        color: '#af9875',
        letterSpacing: 1.4,
        align: 'center',
      })
      .setOrigin(0.5);

    const cardW = Math.min(380, w - 34);
    const gap = Math.min(18, h * 0.025);
    const cardH = Math.min(
      112,
      Math.max(48, (h - h * 0.28 - 60 - 2 * gap) / 3),
    );
    const totalH = 3 * cardH + 2 * gap;
    const startY = Math.max(h * 0.28, (h - totalH - 60) / 2);
    VISUAL_STYLES.forEach((style, index) => {
      const y = startY + index * (cardH + gap);
      const card = this.add
        .rectangle(w / 2, y + cardH / 2, cardW, cardH, 0x241a13, 1)
        .setStrokeStyle(1, style.id === 'classic' ? 0x9a7443 : 0x59452e, 0.9)
        .setInteractive({ useHandCursor: true });
      const title = this.add
        .text(w / 2, y + cardH * 0.37, style.title.toUpperCase(), {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: `${Math.min(19, h * 0.036)}px`,
          color: '#eedab2',
          letterSpacing: 1.5,
        })
        .setOrigin(0.5);
      const subtitle = this.add
        .text(w / 2, y + cardH * 0.67, style.subtitle, {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: `${Math.min(12, h * 0.023)}px`,
          color: style.id === 'illustrated' ? '#b5a08a' : '#b99b6e',
          align: 'center',
          wordWrap: { width: cardW - 24 },
        })
        .setOrigin(0.5);
      const enter = () => {
        if (style.art)
          this.scene.start('visual-lab', { mode: 'room', style: style.id });
        else this.showIllustratedNote(card, subtitle);
      };
      card.on('pointerover', () => card.setFillStyle(0x38271a));
      card.on('pointerout', () => card.setFillStyle(0x241a13));
      card.on('pointerup', enter);
      title.setInteractive({ useHandCursor: true }).on('pointerup', enter);
      subtitle.setInteractive({ useHandCursor: true }).on('pointerup', enter);
    });
    const backY = Math.min(h - 36, startY + totalH + 34);
    const back = this.add
      .rectangle(w / 2, backY, 220, 44, 0x35291d)
      .setStrokeStyle(1, 0x9a7443, 0.8)
      .setInteractive({ useHandCursor: true });
    const backText = this.add
      .text(w / 2, backY, 'TILL HUVUDMENYN', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        color: '#ead4ac',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const backToMain = () => this.scene.start('menu');
    back.on('pointerup', backToMain);
    backText.on('pointerup', backToMain);
  }

  private showIllustratedNote(
    card: Phaser.GameObjects.Rectangle,
    subtitle: Phaser.GameObjects.Text,
  ) {
    card.setFillStyle(0x2a241d);
    subtitle.setText(
      'Samma rumslager är redo för godkända AI-bakgrunder och separata dörrlager. Illustrerad konst har inte levererats ännu.',
    );
    this.time.delayedCall(4200, () => {
      if (subtitle.active)
        subtitle.setText('Integrationsläge · godkända illustrationer saknas');
      if (card.active) card.setFillStyle(0x241a13);
    });
  }

  private createRoom() {
    const style = VISUAL_STYLES.find(({ id }) => id === this.styleId)!;
    const art = style.art!;
    this.createWorld(art);
    this.createUi(style.title);
    this.setupPan();
    this.layoutCamera();
  }

  private createWorld(art: RoomArtPack) {
    const artScale = this.styleId === 'hd' ? 1.5 : 3;
    const addImage = (
      name: keyof RoomArtPack,
      x: number,
      y: number,
      scale = artScale,
    ) => {
      const image = this.add
        .image(x, y, this.textureKey(name))
        .setScale(scale)
        .setDepth(0);
      this.roomObjects.push(image);
      return image;
    };
    const bg = addImage('background', ROOM.width / 2, ROOM.height / 2);
    bg.setOrigin(0.5);
    // Reassert nearest-neighbour filtering for deliberately authored pixel clusters.
    Object.keys(art).forEach((name) =>
      this.textures
        .get(this.textureKey(name))
        .setFilter(Phaser.Textures.FilterMode.NEAREST),
    );

    const corridor = addImage('corridor', ROOM.door.x, 275);
    corridor.setScale(artScale).setAlpha(0).setDepth(1);
    const doorGlow = this.add
      .circle(ROOM.door.x, 300, 62, 0xe6b854, 0.08)
      .setDepth(1.1)
      .setAlpha(0);
    this.roomObjects.push(corridor, doorGlow);

    const left = addImage('leftLeaf', ROOM.door.x - 44, ROOM.door.y);
    const right = addImage('rightLeaf', ROOM.door.x + 44, ROOM.door.y);
    left.setDepth(2);
    right.setDepth(2);
    // The frame overlays the door edges and acts as a physical mask while the leaves slide away.
    const frame = addImage('frame', ROOM.door.x, ROOM.height / 2).setDepth(3);
    frame.setOrigin(0.5);

    const mechanism = addImage('mechanism', 345, 362).setDepth(4);
    mechanism.setOrigin(0.5, 0.78);
    const clue = addImage('clue', ROOM.clue.x, ROOM.clue.y).setDepth(4);
    const vessel = addImage('vessel', ROOM.vessel.x, ROOM.vessel.y).setDepth(4);
    clue.setInteractive({ useHandCursor: true });
    vessel.setInteractive({ useHandCursor: true });
    clue.on('pointerover', () => clue.setTint(0xffe2a0));
    clue.on('pointerout', () => clue.clearTint());
    clue.on('pointerup', () => {
      if (!this.pointerStart?.moved && this.time.now > this.suppressTapUntil)
        this.setStatus(SUN_SEAL_HINTS[0]);
    });
    vessel.on('pointerup', () => {
      if (!this.pointerStart?.moved && this.time.now > this.suppressTapUntil)
        this.setStatus(
          'En gravyr på kärlet visar en stigande, kulminerande och sjunkande sol.',
        );
    });

    this.addHotspot(ROOM.door.x, ROOM.door.y, 120, 264, () => {
      this.setStatus(
        this.doorState === 'open'
          ? 'Stenporten står öppen mot den mörka gången.'
          : 'Två massiva stenblad håller passagen förseglad.',
      );
    });

    const mechanismHotspot = this.addHotspot(345, 350, 112, 104, () =>
      this.openPuzzleView(),
    );
    mechanismHotspot.on('pointerover', () => mechanism.setTint(0xffe1a0));
    mechanismHotspot.on('pointerout', () => mechanism.clearTint());

    const dust = this.add
      .particles(ROOM.door.x, 220, this.createDustTexture(), {
        speed: { min: 10, max: 52 },
        angle: { min: 220, max: 320 },
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.65, end: 0 },
        lifespan: { min: 600, max: 1500 },
        quantity: 2,
        frequency: 110,
        emitting: false,
        tint: [0xd7ba83, 0x8d714b],
      })
      .setDepth(4);
    this.roomObjects.push(dust);
    this.doorLayers = {
      corridor,
      doorGlow,
      left,
      right,
      dust,
    };

    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.puzzleView) this.closePuzzleView();
      else this.scene.start('visual-lab', { mode: 'styles' });
    });
  }

  private addHotspot(
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
  ): Phaser.GameObjects.Zone {
    const zone = this.add
      .zone(x, y, width, height)
      .setInteractive({ useHandCursor: true });
    this.roomObjects.push(zone);
    // Keep the intent on pointerdown, then let the scene-level release decide
    // whether this was a tap or a pan. Game-object pointerup can be omitted on
    // some touch browsers when pointer capture changes during a camera drag.
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.hotspotTap = { pointerId: pointer.id, onTap };
    });
    return zone;
  }

  private createUi(styleTitle: string) {
    const { width: w, height: h } = this.scale;
    this.ui = this.add.container(0, 0).setScrollFactor(0).setDepth(100);
    this.uiCamera = this.cameras.add(0, 0, w, h);
    this.uiCamera.setZoom(1).setScroll(0, 0);
    this.cameras.main.ignore(this.ui);
    this.uiCamera.ignore(this.roomObjects);
    this.ui.add(this.add.rectangle(w / 2, 28, w, 56, 0x100d0b, 0.92));
    this.ui.add(
      this.add
        .text(20, 28, '‹  STILVAL', {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '15px',
          color: '#ead4ac',
        })
        .setOrigin(0, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () =>
          this.scene.start('visual-lab', { mode: 'styles' }),
        ),
    );
    this.ui.add(
      this.add
        .text(w / 2, 28, styleTitle.toUpperCase(), {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: `${Math.min(16, w * 0.035)}px`,
          color: '#e8d0a5',
          letterSpacing: 1,
        })
        .setOrigin(0.5),
    );
    this.ui.add(
      this.add
        .text(w - 20, 28, 'HUVUDMENY', {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: `${Math.min(14, w * 0.032)}px`,
          color: '#c9ad7c',
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.scene.start('menu')),
    );

    const footerY = h - 42;
    this.ui.add(this.add.rectangle(w / 2, footerY, w, 84, 0x100d0b, 0.94));
    const status = this.add
      .text(
        18,
        footerY - 14,
        'Undersök sigillet för att vrida ringarna. Reliefen intill visar solens färd.',
        {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: '#d5c09d',
          wordWrap: {
            width: Math.max(100, w - Math.min(120, w * 0.3) - 56),
          },
        },
      )
      .setOrigin(0, 0.5)
      .setName('status');
    this.ui.add(status);
    status.setText(
      'SVEP I RUMMET FÖR ATT UTFORSKA  ·  UNDERSÖK SIGILLET NÄRA VÄNSTERKANTEN',
    );
    this.time.delayedCall(4200, () => {
      if (status.active)
        status.setText(
          'Undersök sigillet för att vrida ringarna. Reliefen intill visar solens färd.',
        );
    });
    const buttonW = Math.min(120, w * 0.3);
    this.addUiButton(
      'CENTRERA',
      w - buttonW / 2 - 14,
      footerY - 26,
      buttonW,
      34,
      () => this.centerCamera(),
    );
    this.addUiButton(
      'ÅTERSTÄLL',
      w - buttonW / 2 - 14,
      footerY + 12,
      buttonW,
      34,
      () => this.resetRoom(),
    );
    this.ui.add(
      this.add
        .text(
          18,
          h - 12,
          'DRA FÖR ATT UTFORSKA  ·  TRYCK PÅ SIGILLET FÖR ATT UNDERSÖKA',
          {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '9px',
            color: '#8f7b60',
            letterSpacing: 0.6,
          },
        )
        .setOrigin(0, 1),
    );
    this.layoutUi();
  }

  private addUiButton(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    action: () => void,
  ) {
    const button = this.add
      .rectangle(x, y, width, height, 0x3a2b1d, 1)
      .setStrokeStyle(1, 0xb49460, 0.8)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '10px',
        color: '#ead9b9',
        letterSpacing: 0.5,
      })
      .setOrigin(0.5);
    button.on('pointerover', () => button.setFillStyle(0x59432a));
    button.on('pointerout', () => button.setFillStyle(0x3a2b1d));
    button.on('pointerup', action);
    text.setInteractive({ useHandCursor: true }).on('pointerup', action);
    this.ui.add([button, text]);
  }

  private openPuzzleView() {
    if (this.puzzleView || this.doorState !== 'closed') return;
    const mechanismX = 345;
    const mechanismY = 352;
    const camera = this.cameras.main;
    this.tweens.add({
      targets: camera,
      scrollX: Phaser.Math.Clamp(
        mechanismX - this.scale.width / (camera.zoom * 2),
        0,
        ROOM.width - this.scale.width / camera.zoom,
      ),
      scrollY: Phaser.Math.Clamp(
        mechanismY - this.scale.height / (camera.zoom * 2),
        0,
        ROOM.height - this.scale.height / camera.zoom,
      ),
      zoom: this.baseRoomZoom * 1.12,
      duration: 360,
      ease: 'Sine.easeInOut',
      onComplete: () => this.showPuzzleView(),
    });
  }

  private showPuzzleView() {
    const { width: w, height: h } = this.scale;
    this.panVelocity = 0;
    this.puzzleView = this.add.container(0, 0).setScrollFactor(0).setDepth(200);
    this.cameras.main.ignore(this.puzzleView);
    const shade = this.add.rectangle(w / 2, h / 2, w, h, 0x090d13, 0.93);
    this.puzzleView.add(shade);
    this.puzzleBoard = this.add
      .rectangle(
        w / 2,
        h / 2,
        Math.min(w - 26, 760),
        Math.min(h - 112, 520),
        0x171f22,
        1,
      )
      .setStrokeStyle(2, 0x9a8054, 0.95);
    this.puzzleView.add(this.puzzleBoard);
    this.puzzleBoardArt = this.add.image(
      w / 2,
      h / 2,
      this.textureKey('puzzleBoard'),
    );
    this.puzzleView.add(this.puzzleBoardArt);
    this.puzzleView.add(
      this.add
        .text(
          w / 2,
          h < 520 ? 42 : Math.max(74, h * 0.17),
          'SOLENS TRE VÄNDNINGAR',
          {
            fontFamily: 'Cinzel, Georgia, serif',
            fontSize: `${Math.min(22, w * 0.055)}px`,
            color: '#eddbb7',
            letterSpacing: 1.5,
          },
        )
        .setOrigin(0.5),
    );
    this.puzzleView.add(
      this.add
        .text(
          w / 2,
          h < 520 ? 70 : Math.max(100, h * 0.23),
          'Vrid skivorna och följ reliefens väg från gryning till skymning.',
          {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: `${Math.min(13, w * 0.034)}px`,
            color: '#b7c2c5',
            align: 'center',
            wordWrap: { width: w - 52 },
          },
        )
        .setOrigin(0.5),
    );

    const boardWidth = this.puzzleBoardWidth(w, h);
    const diameter = Math.max(68, Math.min(174, (boardWidth * 86) / 320));
    const centerY = h / 2;
    this.layoutPuzzleBoardArt(w, h, centerY);
    this.puzzleDiscs = [];
    ROOM.rings.forEach((_, index) => {
      const x = w / 2 + (([44, 160, 276][index] - 160) / 320) * boardWidth;
      const mount = this.add
        .ellipse(
          x,
          centerY + 8,
          diameter * 0.52,
          diameter * 0.52,
          0x10171c,
          0.94,
        )
        .setStrokeStyle(4, 0x655d4b, 1);
      const disc = this.add
        .image(x, centerY, this.textureKey('ring'))
        .setDisplaySize(diameter, diameter)
        .setInteractive(
          new Phaser.Geom.Circle(diameter / 2, diameter / 2, diameter * 0.48),
          Phaser.Geom.Circle.Contains,
        );
      disc.input!.cursor = 'pointer';
      const label = this.add
        .text(
          x,
          centerY + diameter * 0.72,
          this.ringLabel(index, this.puzzle.angles[index]),
          {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: `${Math.min(h < 520 ? 10 : 12, w * 0.03)}px`,
            color: '#d8c69e',
            letterSpacing: 0.6,
          },
        )
        .setOrigin(0.5);
      disc.rotation = (this.puzzle.angles[index] * Math.PI) / 2;
      disc.on('pointerover', () => disc.setTint(0xffe9bd));
      disc.on('pointerout', () => disc.clearTint());
      disc.on('pointerup', () => this.turnRing(index, disc, label));
      this.puzzleView!.add([mount, disc, label]);
      this.puzzleDiscs.push(disc);
    });
    const shortView = h < 520;
    this.addPuzzleButton(
      'LEDTRÅD',
      shortView ? w * 0.3 : w / 2,
      shortView ? h - 34 : h - 136,
      shortView ? Math.min(132, w * 0.43) : Math.min(144, w * 0.38),
      () => this.showNextHint(),
    );
    this.addPuzzleButton(
      'TILLBAKA',
      shortView ? w * 0.7 : w / 2,
      shortView ? h - 34 : h - 80,
      shortView ? Math.min(132, w * 0.43) : Math.min(190, w * 0.5),
      () => this.closePuzzleView(),
    );
    const hint = this.add
      .text(w / 2, shortView ? h - 82 : h - 178, '', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Math.min(12, w * 0.031)}px`,
        color: '#eedbb5',
        align: 'center',
        wordWrap: { width: w - 64 },
      })
      .setOrigin(0.5);
    hint.setName('puzzle-hint');
    this.puzzleView.add(hint);
    this.layoutPuzzleView();
  }

  private addPuzzleButton(
    label: string,
    x: number,
    y: number,
    width: number,
    action: () => void,
  ) {
    const button = this.add
      .rectangle(x, y, width, 42, 0x3d4648)
      .setStrokeStyle(1, 0xb69a64, 0.85)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(x, y, label, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '12px',
        color: '#f1e2c1',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    button.on('pointerover', () => button.setFillStyle(0x59635f));
    button.on('pointerout', () => button.setFillStyle(0x3d4648));
    button.on('pointerup', action);
    text.on('pointerup', action);
    this.puzzleView?.add([button, text]);
  }

  private showNextHint() {
    this.hintLevel = Math.min(3, this.hintLevel + 1);
    const text = this.puzzleView?.getByName('puzzle-hint') as
      Phaser.GameObjects.Text | undefined;
    text?.setText(
      `LEDTRÅD ${this.hintLevel}/3  ${SUN_SEAL_HINTS[this.hintLevel - 1]}`,
    );
    this.layoutPuzzleView();
  }

  private closePuzzleView() {
    if (!this.puzzleView) return;
    const view = this.puzzleView;
    this.puzzleView = undefined;
    this.puzzleDiscs = [];
    view.destroy(true);
    if (this.puzzle.solved) this.beginDoorOpening();
    else {
      this.cameras.main.pan(ROOM.door.x, ROOM.door.y, 320, 'Sine.easeInOut');
      this.tweens.add({
        targets: this.cameras.main,
        zoom: this.baseRoomZoom,
        duration: 320,
        ease: 'Sine.easeInOut',
      });
      this.setStatus(
        'Sigillet väntar. Undersök reliefen och vrid skivorna i solens ordning.',
      );
    }
  }

  private turnRing(
    index: number,
    ring: Phaser.GameObjects.Image,
    label: Phaser.GameObjects.Text,
  ) {
    if (this.puzzle.solved || this.doorState !== 'closed' || this.isOpening)
      return;
    const previous = this.puzzle.angles[index];
    this.puzzle = rotateSunSeal(this.puzzle, index);
    this.tweens.add({
      targets: ring,
      rotation: (this.puzzle.angles[index] * Math.PI) / 2,
      scale: 1.045,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.setScale(1),
    });
    this.tweens.add({ targets: label, alpha: 0.45, duration: 80, yoyo: true });
    label.setText(this.ringLabel(index, this.puzzle.angles[index]));
    this.events.emit('visual-lab:seal-turn', {
      index,
      from: previous,
      to: this.puzzle.angles[index],
      style: this.styleId,
    });
    if (this.puzzle.solved) {
      this.events.emit('visual-lab:seal-activate', { style: this.styleId });
      this.closePuzzleView();
    }
  }

  private layoutPuzzleView() {
    if (!this.puzzleView) return;
    const { width: w, height: h } = this.scale;
    const children = this.puzzleView.list;
    (children[0] as Phaser.GameObjects.Rectangle)
      .setPosition(w / 2, h / 2)
      .setSize(w, h);
    this.puzzleBoard
      ?.setPosition(w / 2, h / 2)
      .setSize(Math.min(w - 26, 760), Math.min(h - 112, 520));
    (children[3] as Phaser.GameObjects.Text).setPosition(
      w / 2,
      h < 520 ? 42 : Math.max(74, h * 0.17),
    );
    (children[4] as Phaser.GameObjects.Text)
      .setPosition(w / 2, h < 520 ? 70 : Math.max(100, h * 0.23))
      .setWordWrapWidth(w - 52);
    const boardWidth = this.puzzleBoardWidth(w, h);
    const diameter = Math.max(68, Math.min(174, (boardWidth * 86) / 320));
    const centerY = h / 2;
    this.layoutPuzzleBoardArt(w, h, centerY);
    const discs = this.puzzleDiscs;
    for (let i = 0; i < discs.length; i++) {
      const x = w / 2 + (([44, 160, 276][i] - 160) / 320) * boardWidth;
      const mount = children[5 + i * 3] as Phaser.GameObjects.Ellipse;
      const label = children[7 + i * 3] as Phaser.GameObjects.Text;
      mount
        .setPosition(x, centerY + 8)
        .setSize(diameter * 1.04, diameter * 1.04);
      discs[i].setPosition(x, centerY).setDisplaySize(diameter, diameter);
      label
        .setPosition(x, centerY + diameter * 0.72)
        .setText(this.ringLabel(i, this.puzzle.angles[i]));
    }
    const shortView = h < 520;
    for (const index of [14, 15]) {
      const item = children[index] as Phaser.GameObjects.GameObject & {
        setPosition?: (x: number, y: number) => unknown;
      };
      item.setPosition?.(
        shortView ? w * 0.3 : w / 2,
        shortView ? h - 34 : h - 136,
      );
    }
    for (const index of [16, 17]) {
      const item = children[index] as Phaser.GameObjects.GameObject & {
        setPosition?: (x: number, y: number) => unknown;
      };
      item.setPosition?.(
        shortView ? w * 0.7 : w / 2,
        shortView ? h - 34 : h - 80,
      );
    }
    const hint = this.puzzleView.getByName(
      'puzzle-hint',
    ) as Phaser.GameObjects.Text;
    hint
      .setPosition(w / 2, shortView ? h - 82 : h - 178)
      .setWordWrapWidth(w - 64);
  }

  private layoutPuzzleBoardArt(width: number, height: number, discY: number) {
    if (!this.puzzleBoardArt) return;
    const source = this.puzzleBoardArt.texture.getSourceImage() as {
      width: number;
      height: number;
    };
    const boardWidth = this.puzzleBoardWidth(width, height);
    this.puzzleBoardArt
      .setScale(boardWidth / source.width)
      .setPosition(width / 2, discY);
  }

  private puzzleBoardWidth(width: number, height: number) {
    return Math.min(width - 58, 690, Math.max(220, (height - 160) * (4 / 3)));
  }

  private ringLabel(index: number, angle: number) {
    const direction = ['N', 'Ö', 'S', 'V'][angle];
    return this.scale.height < 520
      ? `${index + 1} · ${direction}`
      : `SKIVA ${index + 1}  ·  ${direction}`;
  }

  private beginDoorOpening() {
    if (this.isOpening) return;
    this.isOpening = true;
    this.doorState = 'opening';
    const layers = this.doorLayers;
    if (!layers) return;
    const camera = this.cameras.main;
    camera.pan(ROOM.door.x, ROOM.door.y, 850, 'Sine.easeInOut');
    camera.shake(540, 0.0012);
    this.events.emit('visual-lab:stone-grind', { style: this.styleId });
    this.tweens.add({
      targets: camera,
      zoom: this.baseRoomZoom * 1.035,
      duration: 720,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: layers.doorGlow,
      alpha: 0.62,
      scale: 2.0,
      duration: 1150,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    const skip = this.add
      .text(this.scale.width - 22, 76, 'SKIPPA  ›', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '12px',
        color: '#ead4ac',
        backgroundColor: '#17130f',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setScrollFactor(0)
      .setDepth(130)
      .setInteractive({ useHandCursor: true });
    this.ui.add(skip);
    skip.on('pointerup', () => this.finishDoorOpening());
    layers.dust.start();
    this.tweens.add({
      targets: layers.corridor,
      alpha: 1,
      duration: 1000,
      delay: 450,
      ease: 'Sine.easeIn',
    });
    this.time.delayedCall(480, () => {
      if (!this.isOpening) return;
      const first = this.tweens.add({
        targets: [layers.left, layers.right],
        x: (target: Phaser.GameObjects.Image) =>
          target === layers.left ? ROOM.door.x - 174 : ROOM.door.x + 174,
        duration: 1750,
        ease: 'Cubic.easeIn',
        onComplete: () => {
          if (!this.isOpening) return;
          const final = this.tweens.add({
            targets: [layers.left, layers.right],
            x: (target: Phaser.GameObjects.Image) =>
              target === layers.left
                ? ROOM.door.x - ROOM.door.leafOffset
                : ROOM.door.x + ROOM.door.leafOffset,
            duration: 900,
            ease: 'Quintic.easeOut',
            onComplete: () => this.finishDoorOpening(),
          });
          this.openingTweens.push(final);
        },
      });
      this.openingTweens.push(first);
    });
  }

  private finishDoorOpening() {
    if (!this.isOpening) return;
    this.openingTweens.forEach((tween) => tween.stop());
    this.openingTweens = [];
    const layers = this.doorLayers;
    if (!layers) return;
    layers.left.x = ROOM.door.x - ROOM.door.leafOffset;
    layers.right.x = ROOM.door.x + ROOM.door.leafOffset;
    layers.corridor.setAlpha(1);
    layers.dust.stop();
    this.tweens.add({
      targets: this.cameras.main,
      zoom: this.baseRoomZoom,
      duration: 460,
      ease: 'Sine.easeOut',
    });
    const skip = this.ui?.list.find(
      (item) =>
        item instanceof Phaser.GameObjects.Text && item.text === 'SKIPPA  ›',
    );
    skip?.destroy();
    this.doorState = 'open';
    this.isOpening = false;
    this.setStatus('SOLSIGILLET ÖPPNAT. Den dolda gången ligger kvar öppen.');
  }

  private resetRoom() {
    this.scene.restart({ mode: 'room', style: this.styleId });
  }

  private setStatus(message: string) {
    const status = this.ui?.getByName('status') as
      Phaser.GameObjects.Text | undefined;
    status?.setText(message);
  }

  private setupPan() {
    const camera = this.cameras.main;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < 58 || pointer.y > this.scale.height - 82) return;
      this.panVelocity = 0;
      this.lastPointerSample = { x: pointer.x, time: this.time.now };
      this.pointerStart = {
        x: pointer.x,
        y: pointer.y,
        scrollX: camera.scrollX,
        moved: false,
      };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const start = this.pointerStart;
      if (!start || !pointer.isDown) return;
      const deltaX = pointer.x - start.x;
      const deltaY = pointer.y - start.y;
      if (!start.moved && Math.hypot(deltaX, deltaY) >= PAN_THRESHOLD) {
        start.moved = true;
        this.hotspotTap = undefined;
      }
      if (start.moved) {
        camera.scrollX = Phaser.Math.Clamp(
          start.scrollX - deltaX / camera.zoom,
          0,
          Math.max(0, ROOM.width - camera.width / camera.zoom),
        );
        const sample = this.lastPointerSample;
        if (sample) {
          const elapsed = Math.max(1, this.time.now - sample.time);
          this.panVelocity = Phaser.Math.Clamp(
            -(pointer.x - sample.x) / camera.zoom / elapsed,
            -1.8,
            1.8,
          );
        }
        this.lastPointerSample = { x: pointer.x, time: this.time.now };
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const tap = this.hotspotTap;
      if (
        tap?.pointerId === pointer.id &&
        !this.pointerStart?.moved &&
        this.time.now > this.suppressTapUntil
      )
        tap.onTap();
      this.hotspotTap = undefined;
      if (this.pointerStart?.moved) this.suppressTapUntil = this.time.now + 140;
      this.pointerStart = undefined;
      this.lastPointerSample = undefined;
    });
    this.input.on('pointerupoutside', () => {
      this.hotspotTap = undefined;
      if (this.pointerStart?.moved) this.suppressTapUntil = this.time.now + 140;
      this.pointerStart = undefined;
      this.lastPointerSample = undefined;
    });
  }

  private layoutCamera() {
    const camera = this.cameras.main;
    const zoom = Math.max(
      this.scale.width / ROOM.width,
      this.scale.height / ROOM.height,
    );
    camera.setZoom(zoom);
    this.baseRoomZoom = zoom;
    camera.setBounds(0, 0, ROOM.width, ROOM.height);
    const visibleWidth = this.scale.width / zoom;
    const visibleHeight = this.scale.height / zoom;
    camera.setScroll(
      Phaser.Math.Clamp(360 - visibleWidth / 2, 0, ROOM.width - visibleWidth),
      Phaser.Math.Clamp(
        ROOM.height / 2 - visibleHeight / 2,
        0,
        ROOM.height - visibleHeight,
      ),
    );
  }

  private centerCamera() {
    const camera = this.cameras.main;
    const visibleWidth = this.scale.width / camera.zoom;
    camera.scrollX = Phaser.Math.Clamp(
      ROOM.door.x - visibleWidth / 2,
      0,
      ROOM.width - visibleWidth,
    );
    this.panVelocity = 0;
  }

  private createDustTexture() {
    const key = 'visual-lab-dust';
    if (this.textures.exists(key)) return key;
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics
      .fillStyle(0xf0d49a, 1)
      .fillCircle(3, 3, 3)
      .generateTexture(key, 6, 6);
    graphics.destroy();
    return key;
  }

  private textureKey(name: string) {
    return `visual-lab-${this.styleId}-${name}`;
  }

  private layoutUi() {
    if (!this.ui) return;
    const { width: w, height: h } = this.scale;
    this.uiCamera.setViewport(0, 0, w, h).setZoom(1).setScroll(0, 0);
    const children = this.ui.list;
    const barTop = children[0] as Phaser.GameObjects.Rectangle;
    const back = children[1] as Phaser.GameObjects.Text;
    const title = children[2] as Phaser.GameObjects.Text;
    const main = children[3] as Phaser.GameObjects.Text;
    const footer = children[4] as Phaser.GameObjects.Rectangle;
    const status = children[5] as Phaser.GameObjects.Text;
    barTop.setPosition(w / 2, 28).setSize(w, 56);
    back.setPosition(20, 28);
    title.setPosition(w / 2, 28);
    main.setPosition(w - 20, 28);
    const footerY = h - 42;
    footer.setPosition(w / 2, footerY).setSize(w, 84);
    status
      .setPosition(18, footerY - 14)
      .setWordWrapWidth(Math.max(100, w - Math.min(120, w * 0.3) - 56));
    const controls = children.slice(6, 10) as Phaser.GameObjects.GameObject[];
    const buttonW = Math.min(120, w * 0.3);
    controls.forEach((item, index) => {
      const row = Math.floor(index / 2);
      const x = w - buttonW / 2 - 14;
      const y = footerY - 26 + row * 38;
      if (item instanceof Phaser.GameObjects.Rectangle)
        item.setPosition(x, y).setSize(buttonW, 34);
      if (item instanceof Phaser.GameObjects.Text && item.name !== 'status')
        item.setPosition(x, y);
    });
    const hint = children[10] as Phaser.GameObjects.Text | undefined;
    hint?.setPosition(18, h - 12);
    hint?.setWordWrapWidth(Math.max(110, w - Math.min(120, w * 0.3) - 56));
  }

  private onResize() {
    if (!this.roomMode) {
      this.scene.restart({ mode: 'styles' });
      return;
    }
    this.layoutCamera();
    this.layoutUi();
    this.layoutPuzzleView();
  }
}

// Re-exported for focused unit tests without coupling puzzle rules to Phaser.
export { isSunSealSolved, rotateRing } from '../visual-lab/model';
