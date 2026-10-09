import Phaser from 'phaser';
import {
  initialSunSeal,
  isSunSealSolved,
  rotateRing,
  SEALED_SUN_ROOM,
  VISUAL_STYLES,
  type DoorState,
  type RingAngles,
  type RoomArtPack,
  type VisualStyleId,
} from '../visual-lab/model';

const ROOM = SEALED_SUN_ROOM;
const PAN_THRESHOLD = 12;

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
  private angles: RingAngles = initialSunSeal();
  private doorState: DoorState = 'closed';
  private pointerStart?: {
    x: number;
    y: number;
    scrollX: number;
    moved: boolean;
  };
  private isOpening = false;
  private doorLayers?: DoorLayers;

  constructor() {
    super('visual-lab');
  }

  init(data: { mode?: 'styles' | 'room'; style?: VisualStyleId }) {
    this.roomMode = data.mode === 'room';
    this.styleId = data.style ?? 'classic';
    this.angles = initialSunSeal();
    this.doorState = 'closed';
    this.isOpening = false;
    this.pointerStart = undefined;
    this.roomObjects = [];
    this.doorLayers = undefined;
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

    const left = addImage('leftLeaf', ROOM.door.x - 45, ROOM.door.y);
    const right = addImage('rightLeaf', ROOM.door.x + 45, ROOM.door.y);
    left.setDepth(2);
    right.setDepth(2);
    // The frame overlays the door edges and acts as a physical mask while the leaves slide away.
    const frame = addImage('frame', ROOM.door.x, ROOM.height / 2).setDepth(3);
    frame.setOrigin(0.5);

    const mechanism = addImage('mechanism', 345, 362).setDepth(4);
    mechanism.setOrigin(0.5, 0.78);
    const clue = addImage('clue', ROOM.clue.x, ROOM.clue.y).setDepth(4);
    const vessel = addImage('vessel', ROOM.vessel.x, ROOM.vessel.y).setDepth(4);
    clue.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, clue.width, clue.height),
      Phaser.Geom.Rectangle.Contains,
    );
    vessel.setInteractive({ useHandCursor: true });
    clue.on('pointerup', () => {
      if (!this.pointerStart?.moved)
        this.setStatus(
          'Reliefen visar riktningarna för de tre solringarna. Läs den från vänster till höger.',
        );
    });
    vessel.on('pointerup', () => {
      if (!this.pointerStart?.moved)
        this.setStatus(
          'En gravyr på kärlet visar en stigande, kulminerande och sjunkande sol.',
        );
    });

    this.addHotspot(ROOM.door.x, ROOM.door.y, 170, 264, () => {
      this.setStatus(
        this.doorState === 'open'
          ? 'Stenporten står öppen mot den mörka gången.'
          : 'Två massiva stenblad håller passagen förseglad.',
      );
    });

    ROOM.rings.forEach((position, index) => {
      const ring = this.add
        .image(position.x, position.y, this.textureKey('ring'))
        .setScale(artScale)
        .setDepth(5)
        .setInteractive(
          new Phaser.Geom.Circle(
            7 * (this.styleId === 'hd' ? 2 : 1),
            7 * (this.styleId === 'hd' ? 2 : 1),
            8 * (this.styleId === 'hd' ? 2 : 1),
          ),
          Phaser.Geom.Circle.Contains,
        );
      ring.setOrigin(0.5).setData('baseRotation', 0);
      this.roomObjects.push(ring);
      ring.on('pointerover', () => ring.setTint(0xffe5a2));
      ring.on('pointerout', () => ring.clearTint());
      ring.on('pointerup', () => {
        if (!this.pointerStart?.moved) this.turnRing(index, ring, artScale);
      });
    });

    const dust = this.add
      .particles(ROOM.door.x, 330, this.createDustTexture(), {
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

    this.input.keyboard?.on('keydown-ESC', () =>
      this.scene.start('visual-lab', { mode: 'styles' }),
    );
  }

  private addHotspot(
    x: number,
    y: number,
    width: number,
    height: number,
    onTap: () => void,
  ) {
    const zone = this.add
      .zone(x, y, width, height)
      .setInteractive({ useHandCursor: true });
    this.roomObjects.push(zone);
    zone.on('pointerup', () => {
      if (!this.pointerStart?.moved) onTap();
    });
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
          fontSize: '16px',
          color: '#e8d0a5',
          letterSpacing: 1,
        })
        .setOrigin(0.5),
    );
    this.ui.add(
      this.add
        .text(w - 20, 28, 'HUVUDMENY', {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '14px',
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
        'Utforska rummet. Tryck på de tre ringarna för att vrida solsigillet.',
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
          'DRA FÖR ATT PANORERA  ·  TRYCK PÅ SIGILLET FÖR ATT VRIDA',
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

  private turnRing(
    index: number,
    ring: Phaser.GameObjects.Image,
    artScale: number,
  ) {
    if (this.doorState !== 'closed' || this.isOpening) return;
    this.angles = rotateRing(this.angles, index);
    ring.rotation = this.angles[index] * (Math.PI / 2);
    this.tweens.add({
      targets: ring,
      scale: artScale * 1.06,
      duration: 90,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    this.setStatus(
      `Solseglet rör sig. Ringar: ${this.angles.map((angle) => ['N', 'Ö', 'S', 'V'][angle]).join(' · ')}`,
    );
    if (isSunSealSolved(this.angles)) {
      this.setStatus('Mekanismen hakar i. Stenarna börjar röra sig…');
      this.beginDoorOpening();
    }
  }

  private beginDoorOpening() {
    if (this.isOpening) return;
    this.isOpening = true;
    this.doorState = 'opening';
    const layers = this.doorLayers;
    if (!layers) return;
    const camera = this.cameras.main;
    camera.pan(ROOM.door.x, ROOM.door.y, 520, 'Sine.easeInOut');
    camera.shake(320, 0.0018);
    this.tweens.add({
      targets: camera,
      zoom: camera.zoom * 1.035,
      duration: 520,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: layers.doorGlow,
      alpha: 0.46,
      scale: 1.6,
      duration: 500,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
    layers.dust.start();
    this.tweens.add({
      targets: layers.corridor,
      alpha: 1,
      duration: 1000,
      delay: 450,
      ease: 'Sine.easeIn',
    });
    this.tweens.add({
      targets: [layers.left, layers.right],
      x: (target: Phaser.GameObjects.Image) =>
        target === layers.left
          ? ROOM.door.x - ROOM.door.leafOffset
          : ROOM.door.x + ROOM.door.leafOffset,
      duration: 2350,
      delay: 500,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        this.doorState = 'open';
        this.isOpening = false;
        layers.dust.stop();
        this.setStatus(
          'SOLSIGILLET ÖPPNAT. Den dolda gången ligger kvar öppen.',
        );
      },
    });
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
      if (!start.moved && Math.hypot(deltaX, deltaY) >= PAN_THRESHOLD)
        start.moved = true;
      if (start.moved) camera.scrollX = start.scrollX - deltaX / camera.zoom;
    });
    this.input.on('pointerup', () => {
      this.pointerStart = undefined;
    });
    this.input.on('pointerupoutside', () => {
      this.pointerStart = undefined;
    });
  }

  private layoutCamera() {
    const camera = this.cameras.main;
    const zoom = Math.max(
      this.scale.width / ROOM.width,
      this.scale.height / ROOM.height,
    );
    camera.setZoom(zoom);
    camera.setBounds(0, 0, ROOM.width, ROOM.height);
    const visibleWidth = this.scale.width / zoom;
    const visibleHeight = this.scale.height / zoom;
    camera.setScroll(
      Phaser.Math.Clamp(
        ROOM.door.x - visibleWidth / 2,
        0,
        ROOM.width - visibleWidth,
      ),
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
  }
}

// Re-exported for focused unit tests without coupling puzzle rules to Phaser.
export { isSunSealSolved, rotateRing } from '../visual-lab/model';
