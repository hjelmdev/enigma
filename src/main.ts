import Phaser from 'phaser';
import './style.css';
import { ChamberScene } from './game/scenes/ChamberScene';
import { MenuScene } from './game/scenes/MenuScene';
import { VisualLabScene } from './game/scenes/VisualLabScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17120e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [MenuScene, ChamberScene, VisualLabScene],
  input: { activePointers: 3 },
  render: { antialias: true, pixelArt: false },
});
