import Phaser from 'phaser';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create() {
    this.add.rectangle(640, 360, 1280, 720, 0x17120e);
    this.add
      .polygon(640, 286, [0, 210, 220, -120, 440, 210], 0x3a2b1d)
      .setOrigin(0.5);
    this.add
      .polygon(640, 286, [0, 150, 150, -75, 300, 150], 0x604a30)
      .setOrigin(0.5);
    this.add
      .text(640, 330, 'ENIGMA', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: '76px',
        color: '#f1dfbc',
        fontStyle: '600',
        letterSpacing: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(640, 397, 'ETT MYSTERIUM VÄNTAR UNDER SANDEN', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '16px',
        color: '#c8ad7e',
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    const button = this.add
      .rectangle(640, 500, 230, 62, 0xb18a50)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(640, 500, 'BÖRJA UTFORSKA', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '16px',
        color: '#20170f',
        fontStyle: 'bold',
        letterSpacing: 1,
      })
      .setOrigin(0.5);
    button.on('pointerover', () => button.setFillStyle(0xd0a966));
    button.on('pointerout', () => button.setFillStyle(0xb18a50));
    button.on('pointerdown', () => this.scene.start('chamber'));
    label.setInteractive().on('pointerdown', () => this.scene.start('chamber'));
    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('chamber'));
  }
}
