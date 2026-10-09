import Phaser from 'phaser';
import './style.css';
import { ChamberScene } from './game/scenes/ChamberScene';
import { MenuScene } from './game/scenes/MenuScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17120e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [MenuScene, ChamberScene],
  input: { activePointers: 3 },
  render: { antialias: true, pixelArt: false },
});
