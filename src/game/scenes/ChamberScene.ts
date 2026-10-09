import Phaser from 'phaser';
import { rooms } from '../world/rooms';
import type { HotspotDefinition } from '../world/types';

export class ChamberScene extends Phaser.Scene {
  private focusPanel?: Phaser.GameObjects.Container;
  private focusCamera?: Phaser.Cameras.Scene2D.Camera;
  private focusedHotspot?: HotspotDefinition;
  private isFocused = false;
  private room = rooms.entrance;

  constructor() {
    super('chamber');
  }

  create(data: { focusedHotspotId?: string } = {}) {
    const { width: w, height: h } = this.scale;
    this.isFocused = false;
    this.focusPanel?.destroy();
    this.drawRoom(w, h);

    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.024, h * 0.045), 13, 23);
    const hintSize = Phaser.Math.Clamp(Math.min(w * 0.016, h * 0.026), 10, 15);
    this.add
      .text(24, 20, this.room.title.toLocaleUpperCase('sv-SE'), {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f0dfbf',
        letterSpacing: 2,
        backgroundColor: '#1a140eee',
        padding: { x: 12, y: 8 },
      })
      .setDepth(2);
    this.add
      .text(w - 24, 20, 'TRYCK PÅ ETT MARKERAT FÖREMÅL', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${hintSize}px`,
        color: '#f3dfbb',
        letterSpacing: 0.5,
        align: 'right',
        backgroundColor: '#1a140eee',
        padding: { x: 12, y: 9 },
        wordWrap: { width: Math.max(130, w * 0.57) },
      })
      .setOrigin(1, 0)
      .setDepth(2);

    for (const hotspot of this.room.hotspots) this.addHotspot(hotspot, w, h);
    this.input.keyboard?.on('keydown-ESC', this.closeFocus, this);
    this.input.keyboard?.on('keydown-BACKSPACE', this.closeFocus, this);
    this.room.hotspots.forEach((hotspot, index) => {
      this.input.keyboard?.on(`keydown-F${index + 1}`, () =>
        this.openFocus(hotspot),
      );
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
    this.cameras.main.fadeIn(320, 15, 11, 7);

    const hotspotToRestore = this.room.hotspots.find(
      ({ id }) => id === data.focusedHotspotId,
    );
    if (hotspotToRestore) {
      this.time.delayedCall(0, () => this.openFocus(hotspotToRestore));
    }
  }

  private drawRoom(w: number, h: number) {
    const { top, bottom, wall } = this.room.background;
    const g = this.add.graphics();
    g.fillGradientStyle(top, top, bottom, bottom, 1);
    g.fillRect(0, 0, w, h);

    // Layered stone shapes make the temporary chamber read as a real room.
    g.fillStyle(0x17120f, 0.48);
    g.fillPoints(
      [
        { x: 0, y: h * 0.13 },
        { x: w * 0.5, y: h * 0.02 },
        { x: w, y: h * 0.13 },
        { x: w, y: h * 0.72 },
        { x: 0, y: h * 0.72 },
      ],
      true,
    );
    g.fillStyle(wall, 1);
    g.fillPoints(
      [
        { x: w * 0.08, y: h * 0.16 },
        { x: w * 0.92, y: h * 0.16 },
        { x: w * 0.79, y: h * 0.72 },
        { x: w * 0.21, y: h * 0.72 },
      ],
      true,
    );
    g.fillStyle(0x241b13, 1);
    g.fillPoints(
      [
        { x: w * 0.21, y: h * 0.72 },
        { x: w * 0.79, y: h * 0.72 },
        { x: w, y: h },
        { x: 0, y: h },
      ],
      true,
    );

    // Recessed doorway, pillars and torch glow give the room visual landmarks.
    const doorW = Math.min(w * 0.27, h * 0.54);
    const doorX = (w - doorW) / 2;
    const doorY = h * 0.18;
    const doorH = h * 0.46;
    g.fillStyle(0x21180f, 0.97);
    g.fillRoundedRect(doorX, doorY, doorW, doorH, Math.min(doorW * 0.45, 90));
    g.fillStyle(0x100d0a, 0.66);
    g.fillRect(
      doorX + doorW * 0.14,
      doorY + doorH * 0.3,
      doorW * 0.72,
      doorH * 0.7,
    );
    g.fillStyle(0x9c7848, 0.8);
    for (const side of [0.09, 0.88]) {
      g.fillRoundedRect(w * side, h * 0.2, w * 0.035, h * 0.51, 5);
      g.fillStyle(0xc3a16b, 0.8);
      g.fillRect(w * (side - 0.009), h * 0.2, w * 0.053, h * 0.024);
      g.fillStyle(0x9c7848, 0.8);
    }
    g.fillStyle(0xf4b356, 0.1);
    g.fillCircle(w * 0.13, h * 0.34, Math.min(w, h) * 0.18);
    g.fillCircle(w * 0.87, h * 0.34, Math.min(w, h) * 0.18);

    g.lineStyle(2, 0x9a7950, 0.3);
    g.lineBetween(w * 0.08, h * 0.16, w * 0.21, h * 0.72);
    g.lineBetween(w * 0.92, h * 0.16, w * 0.79, h * 0.72);
    for (let i = 1; i <= 4; i++) {
      const y = h * (0.72 + i * 0.07);
      g.lineStyle(2, 0x8a6c48, 0.2);
      g.lineBetween(w * (0.21 - i * 0.052), y, w * (0.79 + i * 0.052), y);
    }
    g.fillStyle(0xc49354, 0.2);
    g.fillEllipse(w * 0.5, h * 0.72, w * 0.48, h * 0.045);

    // Draw each authored object from its normalized hotspot definition.
    for (const hotspot of this.room.hotspots) {
      const area = hotspot.area;
      const bounds = {
        x: area.x * w,
        y: area.y * h,
        width: area.width * w,
        height: area.height * h,
      };
      const artifact = this.add.graphics();
      this.drawArtifact(artifact, hotspot.visual, bounds.width, bounds.height);
      artifact.setPosition(bounds.x, bounds.y).setDepth(1);
    }
  }

  private drawArtifact(
    graphics: Phaser.GameObjects.Graphics,
    visual: HotspotDefinition['visual'],
    width: number,
    height: number,
  ) {
    if (visual === 'vessel') {
      graphics.fillStyle(0x0b0907, 0.38);
      graphics.fillEllipse(
        width * 0.52,
        height * 0.91,
        width * 0.86,
        height * 0.13,
      );
      graphics.fillStyle(0x59432d, 1);
      graphics.fillPoints(
        [
          { x: width * 0.31, y: height * 0.23 },
          { x: width * 0.69, y: height * 0.23 },
          { x: width * 0.78, y: height * 0.79 },
          { x: width * 0.66, y: height * 0.9 },
          { x: width * 0.34, y: height * 0.9 },
          { x: width * 0.22, y: height * 0.79 },
        ],
        true,
      );
      graphics.fillStyle(0x9a7548, 0.8);
      graphics.fillRoundedRect(
        width * 0.4,
        height * 0.08,
        width * 0.2,
        height * 0.2,
        3,
      );
      graphics.lineStyle(3, 0xb29260, 0.8);
      graphics.strokeEllipse(
        width * 0.5,
        height * 0.25,
        width * 0.39,
        height * 0.1,
      );
      graphics.lineStyle(2, 0x2b2016, 0.6);
      graphics.lineBetween(
        width * 0.34,
        height * 0.57,
        width * 0.68,
        height * 0.57,
      );
    } else {
      graphics.fillStyle(0x443321, 0.88);
      graphics.fillRoundedRect(
        width * 0.1,
        height * 0.08,
        width * 0.8,
        height * 0.84,
        5,
      );
      graphics.lineStyle(4, 0xb3915e, 0.8);
      graphics.strokeRoundedRect(
        width * 0.15,
        height * 0.13,
        width * 0.7,
        height * 0.74,
        3,
      );
      graphics.lineStyle(3, 0xd0b077, 0.82);
      const marks = [
        [0.37, 0.28, 0.37, 0.47],
        [0.59, 0.25, 0.69, 0.34],
        [0.58, 0.43, 0.7, 0.52],
        [0.35, 0.61, 0.46, 0.71],
        [0.59, 0.63, 0.59, 0.78],
      ];
      for (const [x1, y1, x2, y2] of marks) {
        graphics.lineBetween(width * x1, height * y1, width * x2, height * y2);
      }
      graphics.strokeCircle(
        width * 0.48,
        height * 0.35,
        Math.min(width, height) * 0.07,
      );
      graphics.strokeTriangle(
        width * 0.42,
        height * 0.55,
        width * 0.55,
        height * 0.55,
        width * 0.48,
        height * 0.43,
      );
    }
  }

  private addHotspot(hotspot: HotspotDefinition, w: number, h: number) {
    const area = hotspot.area;
    const x = area.x * w;
    const y = area.y * h;
    const width = area.width * w;
    const height = area.height * h;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const outline = this.add.graphics().setDepth(3);
    const drawOutline = (active: boolean) => {
      outline.clear();
      outline.fillStyle(0xd2a75e, active ? 0.14 : 0.035);
      outline.lineStyle(
        active ? 3 : 2,
        active ? 0xffd88c : 0xe2c17d,
        active ? 0.96 : 0.6,
      );
      outline.fillRoundedRect(x, y, width, height, Math.min(16, width * 0.08));
      outline.strokeRoundedRect(
        x,
        y,
        width,
        height,
        Math.min(16, width * 0.08),
      );
      outline.fillStyle(active ? 0xffd88c : 0xd9b06b, active ? 1 : 0.88);
      outline.fillCircle(cx, y + 12, 4);
    };
    drawOutline(false);

    const labelSize = Phaser.Math.Clamp(Math.min(w * 0.018, h * 0.03), 12, 17);
    const caption = this.add
      .text(cx, y + height + 7, hotspot.label, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${labelSize}px`,
        color: '#fff0d2',
        fontStyle: '600',
        backgroundColor: '#21180feF',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5, 0)
      .setDepth(4);
    const tapW = Math.min(w, Math.max(width, 116));
    const tapH = Math.min(h, Math.max(height, 110));
    const tapX = Phaser.Math.Clamp(cx, tapW / 2 + 8, w - tapW / 2 - 8);
    const tapY = Phaser.Math.Clamp(cy, tapH / 2 + 8, h - tapH / 2 - 8);
    const target = this.add
      .rectangle(tapX, tapY, tapW, tapH, 0xffffff, 0.001)
      .setDepth(5)
      .setInteractive({ useHandCursor: true });

    target.on('pointerover', () => drawOutline(true));
    target.on('pointerout', () => drawOutline(false));
    target.on('pointerdown', () => {
      drawOutline(true);
      this.tweens.add({
        targets: [outline, caption],
        scaleX: 1.035,
        scaleY: 1.035,
        duration: 90,
        yoyo: true,
        onComplete: () => this.openFocus(hotspot),
      });
    });
  }

  private openFocus(hotspot: HotspotDefinition) {
    if (this.isFocused) return;
    this.isFocused = true;
    this.focusedHotspot = hotspot;
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.pan(
      hotspot.focus.x * w,
      hotspot.focus.y * h,
      360,
      'Sine.easeInOut',
    );
    this.cameras.main.zoomTo(1.32, 360, 'Sine.easeInOut');
    this.time.delayedCall(360, () => this.showFocusPanel(hotspot, w, h));
  }

  private showFocusPanel(hotspot: HotspotDefinition, w: number, h: number) {
    if (!this.isFocused) return;
    const focusCamera = this.cameras.add(0, 0, w, h);
    focusCamera.ignore(this.children.list);
    this.focusCamera = focusCamera;
    const panelW = Math.min(w - 28, 760);
    const panelH = Math.min(h - 28, 500);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.045, h * 0.075), 21, 34);
    const bodySize = Phaser.Math.Clamp(Math.min(w * 0.026, h * 0.045), 14, 20);
    const artW = Math.min(panelW * 0.25, panelH * 0.25, 138);
    const artH = Math.min(panelH * 0.25, artW * 1.08);

    const shade = this.add
      .rectangle(0, 0, w, h, 0x100c08, 0.78)
      .setOrigin(0)
      .setDepth(10)
      .setInteractive();
    const card = this.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x2b2117)
      .setStrokeStyle(2, 0xb18a50)
      .setDepth(11);
    const rule = this.add.graphics().setDepth(12);
    rule.lineStyle(1, 0xc69b5d, 0.46);
    rule.lineBetween(
      panelX + panelW * 0.12,
      panelY + panelH * 0.18,
      panelX + panelW * 0.88,
      panelY + panelH * 0.18,
    );
    rule.lineBetween(
      panelX + panelW * 0.12,
      panelY + panelH * 0.69,
      panelX + panelW * 0.88,
      panelY + panelH * 0.69,
    );

    const title = this.add
      .text(w / 2, panelY + panelH * 0.1, hotspot.label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f1dfbc',
        align: 'center',
        wordWrap: { width: panelW - 40 },
      })
      .setOrigin(0.5)
      .setDepth(12);
    const art = this.add.graphics().setDepth(12);
    this.drawArtifact(art, hotspot.visual, artW, artH);
    art.setPosition(w / 2 - artW / 2, panelY + panelH * 0.22);
    const description = this.add
      .text(w / 2, panelY + panelH * 0.56, hotspot.description, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${bodySize}px`,
        color: '#e1d2b9',
        align: 'center',
        wordWrap: { width: panelW * 0.78 },
        lineSpacing: 5,
      })
      .setOrigin(0.5)
      .setDepth(12);

    const buttonW = Math.min(panelW - 36, 300);
    const buttonH = Math.min(68, Math.max(54, panelH * 0.15));
    const buttonY = panelY + panelH * 0.85;
    const back = this.add
      .rectangle(w / 2, buttonY, buttonW, buttonH, 0xc49a5b)
      .setStrokeStyle(2, 0xe7ca92, 0.9)
      .setDepth(12)
      .setInteractive({ useHandCursor: true });
    const backLabel = this.add
      .text(w / 2, buttonY, '←  TILL KAMMAREN', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.022, h * 0.034), 14, 17)}px`,
        color: '#21180f',
        fontStyle: 'bold',
        letterSpacing: 0.4,
      })
      .setOrigin(0.5)
      .setDepth(13)
      .setInteractive({ useHandCursor: true });
    const onBackOver = () => back.setFillStyle(0xe0bb77);
    const onBackOut = () => back.setFillStyle(0xc49a5b);
    back.on('pointerover', onBackOver);
    backLabel.on('pointerover', onBackOver);
    back.on('pointerout', onBackOut);
    backLabel.on('pointerout', onBackOut);
    back.on('pointerdown', () => this.closeFocus());
    backLabel.on('pointerdown', () => this.closeFocus());

    const panel = this.add
      .container(0, 0, [
        shade,
        card,
        rule,
        title,
        art,
        description,
        back,
        backLabel,
      ])
      .setDepth(10);
    this.focusPanel = panel;
    this.cameras.main.ignore(panel);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      alpha: 1,
      duration: 170,
      ease: 'Sine.easeOut',
    });
  }

  private closeFocus() {
    if (!this.isFocused) return;
    this.isFocused = false;
    this.focusedHotspot = undefined;
    this.focusPanel?.destroy();
    this.focusPanel = undefined;
    if (this.focusCamera) {
      this.cameras.remove(this.focusCamera);
      this.focusCamera = undefined;
    }
    this.cameras.main.pan(
      this.scale.width / 2,
      this.scale.height / 2,
      300,
      'Sine.easeInOut',
    );
    this.cameras.main.zoomTo(1, 300, 'Sine.easeInOut');
  }

  private handleResize() {
    this.scene.restart({ focusedHotspotId: this.focusedHotspot?.id });
  }
}
