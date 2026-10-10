import Phaser from 'phaser';
import './style.css';
import './game/prologue/prologue.css';
import { ChamberScene } from './game/scenes/ChamberScene';
import { Chapter1GateScene } from './game/scenes/Chapter1GateScene';
import { ExteriorScene } from './game/scenes/ExteriorScene';
import { IntroScene } from './game/scenes/IntroScene';
import { MenuScene } from './game/scenes/MenuScene';
import { SunPuzzleScene } from './game/scenes/SunPuzzleScene';
import { TitleScene } from './game/scenes/TitleScene';
import { VisualLabScene } from './game/scenes/VisualLabScene';

// Review shortcuts: ?scene=exterior|sun-puzzle|intro|chapter1-gate|menu and
// ?review=reveal (replays the entrance reveal), ?renderer=canvas (no WebGL).
// The prologue starts at title.
const params = new URLSearchParams(window.location.search);
const scenes: Array<[string, Phaser.Types.Scenes.SceneType]> = [
  ['title', TitleScene],
  ['intro', IntroScene],
  ['exterior', ExteriorScene],
  ['sun-puzzle', SunPuzzleScene],
  ['chapter1-gate', Chapter1GateScene],
  ['menu', MenuScene],
  ['chamber', ChamberScene],
  ['visual-lab', VisualLabScene],
];
const requested =
  params.get('review') === 'reveal' ? 'exterior' : params.get('scene');
const first = scenes.findIndex(([key]) => key === requested);
if (first > 0) scenes.unshift(...scenes.splice(first, 1));

const game = new Phaser.Game({
  type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#17120e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: scenes.map(([, scene]) => scene),
  input: { activePointers: 3 },
  render: { antialias: true, pixelArt: false },
});

// Development-only handle for automated visual checks.
if (import.meta.env.DEV) Object.assign(window, { __enigma: game });
