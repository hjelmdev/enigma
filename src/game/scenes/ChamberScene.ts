import Phaser from 'phaser';
import { rooms } from '../world/rooms';
import type { HotspotDefinition } from '../world/types';

const W = 1280;
const H = 720;

export class ChamberScene extends Phaser.Scene {
  private focusPanel?: Phaser.GameObjects.Container;
  private isFocused = false;
  private room = rooms.entrance;

  constructor() {
    super('chamber');
  }

  create() {
    this.isFocused = false;
    this.focusPanel?.destroy();
    this.drawRoom();
    this.add.text(38, 28, this.room.title.toLocaleUpperCase('sv-SE'), {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: '22px',
      color: '#f0dfbf',
      letterSpacing: 2,
    });
    this.add
      .text(W - 38, 35, 'TRYCK PÅ ETT FÖREMÅL FÖR ATT UNDERSÖKA', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        color: '#d2bc96',
        letterSpacing: 1,
      })
      .setOrigin(1, 0);

    for (const hotspot of this.room.hotspots) this.addHotspot(hotspot);
    this.input.keyboard?.on('keydown-ESC', this.closeFocus, this);
    this.input.keyboard?.on('keydown-BACKSPACE', this.closeFocus, this);
    this.room.hotspots.forEach((hotspot, index) => {
      this.input.keyboard?.on(`keydown-F${index + 1}`, () =>
        this.openFocus(hotspot),
      );
    });
  }

  private drawRoom() {
    const { top, bottom, wall } = this.room.background;
    const g = this.add.graphics();
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, W, H);
    // Placeholder architecture: central perspective and floor slabs.
    g.fillStyle(wall, 1);
    g.fillPoints(
      [
        { x: 105, y: 90 },
        { x: 1175, y: 90 },
        { x: 1010, y: 510 },
        { x: 270, y: 510 },
      ],
      true,
    );
    g.fillStyle(0x241b13, 1);
    g.fillPoints(
      [
        { x: 270, y: 510 },
        { x: 1010, y: 510 },
        { x: 1280, y: 720 },
        { x: 0, y: 720 },
      ],
      true,
    );
    g.lineStyle(4, 0x9a7950, 0.42);
    g.lineBetween(105, 90, 270, 510);
    g.lineBetween(1175, 90, 1010, 510);
    for (let i = 1; i <= 4; i++) {
      const y = 510 + i * 42;
      g.lineStyle(2, 0x8a6c48, 0.18);
      g.lineBetween(270 - i * 27, y, 1010 + i * 27, y);
    }
    // Recess and warm light create depth without implying final art.
    g.fillStyle(0x21180f, 0.9);
    g.fillRoundedRect(475, 126, 330, 330, 8);
    g.fillStyle(0xc58a3c, 0.09);
    g.fillCircle(640, 280, 280);
    g.fillStyle(0xc49354, 0.22);
    g.fillEllipse(640, 506, 600, 35);
  }

  private addHotspot(hotspot: HotspotDefinition) {
    const { x, y, width, height } = hotspot.area;
    const rect = new Phaser.Geom.Rectangle(x * W, y * H, width * W, height * H);
    const shape = this.add.graphics();
    shape.fillStyle(0xd2a75e, 0.18).lineStyle(2, 0xe2c17d, 0.66);
    shape.fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    shape.strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 14);
    shape.setVisible(false);
    const hit = this.add
      .rectangle(
        rect.centerX,
        rect.centerY,
        rect.width,
        rect.height,
        0xffffff,
        0.001,
      )
      .setInteractive({ useHandCursor: true });
    const caption = this.add
      .text(rect.centerX, rect.bottom + 8, hotspot.label, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '16px',
        color: '#f5e7ce',
        backgroundColor: '#1c1711dd',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0);
    caption.setVisible(false);
    hit.on('pointerover', () => {
      shape.setVisible(true);
      caption.setVisible(true);
    });
    hit.on('pointerout', () => {
      shape.setVisible(false);
      caption.setVisible(false);
    });
    hit.on('pointerdown', () => this.openFocus(hotspot));

    // Show the same large targets to keyboard users; Enter/Space activates one.
    const key = this.add
      .text(
        rect.x,
        rect.y - 27,
        `F${this.room.hotspots.indexOf(hotspot) + 1} · ${hotspot.label}`,
        {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '13px',
          color: '#ddc99f',
        },
      )
      .setInteractive({ useHandCursor: true });
    key.on('pointerdown', () => this.openFocus(hotspot));
    key.setVisible(false);
    hit.on('pointerover', () => key.setVisible(true));
    hit.on('pointerout', () => key.setVisible(false));
  }

  private openFocus(hotspot: HotspotDefinition) {
    if (this.isFocused) return;
    this.isFocused = true;
    this.cameras.main.pan(
      hotspot.focus.x * W,
      hotspot.focus.y * H,
      420,
      'Sine.easeInOut',
    );
    this.cameras.main.zoomTo(hotspot.focus.zoom, 420, 'Sine.easeInOut');
    this.time.delayedCall(380, () => this.showFocusPanel(hotspot));
  }

  private showFocusPanel(hotspot: HotspotDefinition) {
    const shade = this.add
      .rectangle(0, 0, W, H, 0x100c08, 0.75)
      .setOrigin(0)
      .setInteractive();
    const card = this.add
      .rectangle(W / 2, H / 2, 560, 300, 0x2b2117)
      .setStrokeStyle(2, 0xb18a50);
    const title = this.add
      .text(W / 2, H / 2 - 92, hotspot.label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '30px',
        color: '#f1dfbc',
      })
      .setOrigin(0.5);
    const description = this.add
      .text(W / 2, H / 2 - 20, hotspot.description, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '19px',
        color: '#e1d2b9',
        align: 'center',
        wordWrap: { width: 430 },
        lineSpacing: 8,
      })
      .setOrigin(0.5);
    const back = this.add
      .text(W / 2, H / 2 + 92, 'TILLBAKA  ·  ESC', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '16px',
        color: '#21180f',
        backgroundColor: '#c49a5b',
        padding: { x: 22, y: 13 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.closeFocus());
    this.focusPanel = this.add
      .container(0, 0, [shade, card, title, description, back])
      .setDepth(10);
    this.cameras.main.ignore([shade, card, title, description, back]);
  }

  private closeFocus() {
    if (!this.isFocused) return;
    this.isFocused = false;
    this.focusPanel?.destroy();
    this.focusPanel = undefined;
    this.cameras.main.pan(W / 2, H / 2, 350, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1, 350, 'Sine.easeInOut');
  }
}
