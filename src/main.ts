import Phaser from 'phaser';
import './style.css';
import { ChamberScene } from './game/scenes/ChamberScene';
import { MenuScene } from './game/scenes/MenuScene';
import { VisualLabScene } from './game/scenes/VisualLabScene';
import { SealedSunCloseUpScene } from './experiments/sealed-sun/scenes/SealedSunCloseUpScene';
import { SealedSunScene } from './experiments/sealed-sun/scenes/SealedSunScene';
import { HorizonScene } from './experiments/hidden-horizon/HorizonScene';

// ?experiment=sealed-sun opens the Sealed Sun room-art experiment directly.
const directToExperiment =
  new URLSearchParams(window.location.search).get('experiment') ===
  'sealed-sun';

const scenes = [
  MenuScene,
  ChamberScene,
  VisualLabScene,
  SealedSunScene,
  SealedSunCloseUpScene,
  HorizonScene,
];
if (directToExperiment) scenes.unshift(scenes.splice(3, 1)[0]);
if (
  new URLSearchParams(window.location.search).get('experiment') ===
  'hidden-horizon'
) {
  scenes.unshift(scenes.splice(scenes.indexOf(HorizonScene), 1)[0]);
}

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
  scene: scenes,
  input: { activePointers: 3 },
  render: { antialias: true, pixelArt: false },
});
