import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    const { width: w, height: h } = this.scale;
    const cx = w / 2;
    const graphics = this.add.graphics();

    graphics.fillGradientStyle(0x21170f, 0x21170f, 0x0d0b09, 0x0d0b09, 1);
    graphics.fillRect(0, 0, w, h);
    graphics.fillStyle(0xc48e49, 0.08);
    graphics.fillCircle(cx, h * 0.39, Math.min(w, h) * 0.48);
    graphics.fillStyle(0x49351f, 1);
    graphics.fillPoints(
      [
        { x: cx, y: h * 0.1 },
        { x: w * 0.82, y: h * 0.61 },
        { x: w * 0.18, y: h * 0.61 },
      ],
      true,
    );
    graphics.fillStyle(0x80613a, 0.85);
    graphics.fillPoints(
      [
        { x: cx, y: h * 0.1 },
        { x: w * 0.5, y: h * 0.61 },
        { x: w * 0.18, y: h * 0.61 },
      ],
      true,
    );
    graphics.fillStyle(0x2b2016, 0.8);
    graphics.fillRect(w * 0.12, h * 0.61, w * 0.76, h * 0.39);
    graphics.lineStyle(2, 0xc39a5c, 0.42);
    graphics.lineBetween(w * 0.18, h * 0.61, w * 0.82, h * 0.61);

    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.09, h * 0.115), 32, 84);
    const title = this.add
      .text(cx, h * 0.69, 'ENIGMA', {
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
      .text(cx, h * 0.77, 'ETT MYSTERIUM VÄNTAR UNDER SANDEN', {
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

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });

    // Small decorative divider ties the title to the room illustration.
    const dividerY = title.y + title.height * 0.72;
    graphics.lineStyle(1, 0xc19a5c, 0.52);
    graphics.lineBetween(
      cx - Math.min(w * 0.19, 190),
      dividerY,
      cx + Math.min(w * 0.19, 190),
      dividerY,
    );
  }

  private handleResize() {
    this.scene.restart();
  }
}
