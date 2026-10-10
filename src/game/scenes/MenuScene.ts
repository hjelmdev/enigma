import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    const { width: w, height: h } = this.scale;
    const cx = w / 2;
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(0x332316, 0x241a11, 0x090807, 0x090807, 1);
    graphics.fillRect(0, 0, w, h);
    graphics.fillStyle(0xd8a754, 0.1);
    graphics.fillCircle(cx, h * 0.37, Math.min(w, h) * 0.62);
    graphics.fillStyle(0x17120e, 0.64);
    graphics.fillPoints(
      [
        { x: w * 0.72, y: h * 0.18 },
        { x: w * 0.96, y: h * 0.56 },
        { x: w * 0.48, y: h * 0.56 },
      ],
      true,
    );
    const frameW = Math.min(w * 0.76, 780);
    const frameX = cx - frameW / 2;
    const frameY = h * 0.1;
    const frameH = h * 0.72;
    graphics.fillStyle(0x080706, 0.58);
    graphics.fillPoints(
      archPoints(frameX - 34, frameY - 18, frameW + 68, frameH + 45),
      true,
    );
    graphics.fillStyle(0x9a784d, 1);
    graphics.fillPoints(archPoints(frameX, frameY, frameW, frameH), true);
    graphics.fillStyle(0x302316, 1);
    graphics.fillPoints(
      archPoints(frameX + 18, frameY + 14, frameW - 36, frameH - 2),
      true,
    );
    graphics.lineStyle(3, 0xd2ad72, 0.6);
    graphics.strokePoints(
      archPoints(frameX + 14, frameY + 12, frameW - 28, frameH - 2),
      true,
    );
    graphics.fillStyle(0x0a0908, 0.96);
    graphics.fillPoints(
      archPoints(frameX + 48, frameY + 72, frameW - 96, frameH - 78),
      true,
    );
    for (const side of [-1, 1]) {
      const px = cx + side * (frameW * 0.41);
      graphics.fillStyle(0x2a2017, 1);
      graphics.fillPoints(
        [
          { x: px - 24, y: h * 0.3 },
          { x: px + 24, y: h * 0.3 },
          { x: px + 39, y: h * 0.78 },
          { x: px - 39, y: h * 0.78 },
        ],
        true,
      );
      graphics.fillStyle(0x98764b, 0.78);
      graphics.fillPoints(
        [
          { x: px - 15, y: h * 0.31 },
          { x: px + 15, y: h * 0.31 },
          { x: px + 25, y: h * 0.77 },
          { x: px - 25, y: h * 0.77 },
        ],
        true,
      );
      graphics.fillStyle(0xc4a16c, 0.88);
      graphics.fillRect(px - 46, h * 0.28, 92, 14);
      graphics.fillRect(px - 38, h * 0.77, 76, 20);
      graphics.fillStyle(0xe2ad57, 0.12);
      graphics.fillCircle(px, h * 0.49, Math.min(w, h) * 0.2);
    }
    graphics.fillStyle(0x1a140f, 0.94);
    graphics.fillRect(0, h * 0.81, w, h * 0.19);
    graphics.lineStyle(2, 0xc09a62, 0.35);
    graphics.lineBetween(0, h * 0.81, w, h * 0.81);
    graphics.lineStyle(1, 0xe3c894, 0.16);
    for (let i = 1; i < 5; i++) {
      const yy = h * (0.81 + i * 0.035);
      graphics.lineBetween(0, yy, w, yy);
    }

    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.09, h * 0.115), 32, 84);
    this.add
      .text(cx, h * 0.53, 'ENIGMA', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f1dfbc',
        fontStyle: '600',
        letterSpacing: Math.max(2, titleSize * 0.13),
        shadow: {
          offsetX: 0,
          offsetY: 4,
          color: '#000000',
          blur: 18,
          fill: true,
        },
      })
      .setOrigin(0.5);

    const taglineSize = Phaser.Math.Clamp(
      Math.min(w * 0.022, h * 0.03),
      10,
      17,
    );
    this.add
      .text(cx, h * 0.62, 'ETT MYSTERIUM VÄNTAR UNDER SANDEN', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${taglineSize}px`,
        color: '#d7bd91',
        letterSpacing: Math.max(1, taglineSize * 0.16),
        align: 'center',
        wordWrap: { width: Math.min(w * 0.9, 600) },
      })
      .setOrigin(0.5);

    const buttonW = Math.min(w - 40, 300);
    const buttonH = Phaser.Math.Clamp(h * 0.09, 54, 72);
    const buttonY = Math.min(h - buttonH / 2 - 20, h * 0.89);
    const button = this.add
      .rectangle(cx, buttonY, buttonW, buttonH, 0xb18a50)
      .setStrokeStyle(1, 0xe2c58e, 0.8)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(cx, buttonY, 'BÖRJA UTFORSKA', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(w * 0.018, 14, 17)}px`,
        color: '#20170f',
        fontStyle: 'bold',
        letterSpacing: 1,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const start = () => {
      button.setFillStyle(0xd4af72);
      this.cameras.main.fadeOut(220, 15, 11, 7);
      this.time.delayedCall(220, () => this.scene.start('chamber'));
    };
    button.on('pointerover', () => button.setFillStyle(0xd0a966));
    button.on('pointerout', () => button.setFillStyle(0xb18a50));
    button.on('pointerdown', start);
    label.on('pointerdown', start);
    this.input.keyboard?.on('keydown-ENTER', start);

    const labY = Math.min(h - buttonH / 2 - 12, buttonY - buttonH - 12);
    const labButton = this.add
      .rectangle(cx, labY, buttonW, buttonH, 0x30251a)
      .setStrokeStyle(1, 0xb18a50, 0.8)
      .setInteractive({ useHandCursor: true });
    const labLabel = this.add
      .text(cx, labY, 'VISUAL LAB  ·  JÄMFÖR GRAFIKSTILAR', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(w * 0.015, 12, 15)}px`,
        color: '#ead4ac',
        fontStyle: 'bold',
        letterSpacing: 0.5,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const openLab = () => this.scene.start('visual-lab', { mode: 'styles' });
    labButton.on('pointerover', () => labButton.setFillStyle(0x55402a));
    labButton.on('pointerout', () => labButton.setFillStyle(0x30251a));
    labButton.on('pointerup', openLab);
    labLabel.on('pointerup', openLab);

    // Separate entry for the clean-room Sealed Sun room-art experiment.
    const stackedY = labY - buttonH - 12;
    const stacked = stackedY - buttonH / 2 > h * 0.665;
    const expW = stacked ? buttonW : Math.min(230, w * 0.5);
    const expH = stacked ? buttonH : 44;
    const expX = stacked ? cx : w - expW / 2 - 12;
    const expY = stacked ? stackedY : expH / 2 + 12;
    const expButton = this.add
      .rectangle(expX, expY, expW, expH, 0x14204a)
      .setStrokeStyle(1, 0xe0a630, 0.85)
      .setInteractive({ useHandCursor: true });
    const expLabel = this.add
      .text(
        expX,
        expY,
        stacked ? 'EXPERIMENT  ·  SOLKAMMAREN' : 'SOLKAMMAREN',
        {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: `${Phaser.Math.Clamp(w * 0.015, 12, 15)}px`,
          color: '#f6d35e',
          fontStyle: 'bold',
          letterSpacing: 0.5,
        },
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const openExperiment = () => this.scene.start('sealed-sun');
    expButton.on('pointerover', () => expButton.setFillStyle(0x1f3271));
    expButton.on('pointerout', () => expButton.setFillStyle(0x14204a));
    expButton.on('pointerup', openExperiment);
    expLabel.on('pointerup', openExperiment);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });

    // Small decorative divider ties the title to the room illustration.
    graphics.lineStyle(1, 0xc19a5c, 0.52);
    graphics.lineBetween(
      cx - Math.min(w * 0.19, 190),
      h * 0.665,
      cx + Math.min(w * 0.19, 190),
      h * 0.665,
    );
  }

  private handleResize() {
    this.scene.restart();
  }
}

function archPoints(x: number, y: number, width: number, height: number) {
  const radius = width / 2;
  const centerX = x + radius;
  const points: Array<{ x: number; y: number }> = [
    { x, y: y + height },
    { x, y: y + radius },
  ];
  for (let step = 0; step <= 12; step++) {
    const angle = Math.PI - (Math.PI * step) / 12;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: y + radius - Math.sin(angle) * radius,
    });
  }
  points.push({ x: x + width, y: y + height });
  return points;
}
