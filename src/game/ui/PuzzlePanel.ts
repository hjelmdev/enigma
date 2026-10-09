import Phaser from 'phaser';
import {
  isBalanceSolved,
  isLightAligned,
  isSequenceSolved,
  type SequenceSymbol,
} from '../puzzles/logic';
import type { PuzzleId } from '../world/types';

export function createPuzzlePanel(
  scene: Phaser.Scene,
  width: number,
  height: number,
  id: PuzzleId,
  onSolved: () => void,
  onClose: () => void,
) {
  const root = scene.add.container(0, 0).setDepth(20);
  const panelW = Math.min(width - 28, 700);
  const panelH = Math.min(height - 28, 500);
  const x = width / 2;
  const y = height / 2;
  root.add(
    scene.add
      .rectangle(0, 0, width, height, 0x090806, 0.82)
      .setOrigin(0)
      .setInteractive(),
  );
  root.add(
    scene.add
      .rectangle(x, y, panelW, panelH, 0x2a2017)
      .setStrokeStyle(2, 0xc29b5c),
  );
  const header = scene.add
    .text(x, y - panelH * 0.39, puzzleTitle(id), {
      fontFamily: 'Cinzel, Georgia, serif',
      fontSize: `${Phaser.Math.Clamp(width * 0.045, 22, 34)}px`,
      color: '#f2dfbd',
    })
    .setOrigin(0.5);
  root.add(header);
  const status = scene.add
    .text(x, y - panelH * 0.23, clue(id), {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: `${Phaser.Math.Clamp(width * 0.024, 14, 18)}px`,
      color: '#d8c6a6',
      align: 'center',
      wordWrap: { width: panelW - 54 },
    })
    .setOrigin(0.5);
  root.add(status);

  const addButton = (
    bx: number,
    by: number,
    bw: number,
    bh: number,
    label: string,
    action: () => void,
    color = 0x685033,
  ) => {
    const bg = scene.add
      .rectangle(bx, by, bw, bh, color)
      .setStrokeStyle(2, 0xb99356)
      .setInteractive({ useHandCursor: true });
    const text = scene.add
      .text(bx, by, label, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(Math.min(bw * 0.19, bh * 0.4), 14, 25)}px`,
        color: '#f2e4cb',
        align: 'center',
        fontStyle: '600',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setFillStyle(0x9a7442));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', action);
    text.on('pointerdown', action);
    root.add([bg, text]);
    return { bg, text };
  };
  const finish = () => {
    if (completed) return;
    completed = true;
    status.setText('Mekanismen svarar. Stenens lås släpper.');
    scene.time.delayedCall(700, () => {
      root.destroy();
      onSolved();
    });
  };
  let completed = false;

  if (id === 'glyph-sequence') {
    const selected: SequenceSymbol[] = [];
    const names: SequenceSymbol[] = ['SOL', 'FLOD', 'ÖGA'];
    const drawProgress = () =>
      status.setText(
        selected.length ? `Tecken: ${selected.join('  ·  ')}` : clue(id),
      );
    names.forEach((name, i) =>
      addButton(
        x + (i - 1) * Math.min(138, panelW * 0.22),
        y,
        Math.min(120, panelW * 0.2),
        70,
        name,
        () => {
          if (selected.length >= 3) return;
          selected.push(name);
          if (
            selected.some(
              (value, index) => value !== ['SOL', 'FLOD', 'ÖGA'][index],
            )
          ) {
            selected.splice(0);
            status.setText('Stenarna skälver. Läs reliefen och försök igen.');
          } else if (isSequenceSolved(selected)) finish();
          else drawProgress();
        },
      ),
    );
  } else if (id === 'balanced-stones') {
    const sides = [0, 0, 0];
    balanceWeights.forEach((weight, i) =>
      addButton(
        x + (i - 1) * Math.min(138, panelW * 0.22),
        y,
        94,
        74,
        `${weight} STEN`,
        () => {
          sides[i] = (sides[i] + 1) % 3;
          status.setText(
            `Vänster ${sides.reduce((sum, side, index) => sum + (side === 1 ? balanceWeights[index] : 0), 0)}   ·   Höger ${sides.reduce((sum, side, index) => sum + (side === 2 ? balanceWeights[index] : 0), 0)}\nTryck igen för att flytta vikten.`,
          );
          if (isBalanceSolved(sides)) finish();
        },
      ),
    );
  } else {
    const angles = [0, 0, 0];
    const mirrorLabels: Phaser.GameObjects.Text[] = [];
    const symbolForAngle = (angle: number) => ['│', '╱', '╲', '—'][angle];
    angles.forEach((_, i) => {
      const control = addButton(
        x + (i - 1) * Math.min(138, panelW * 0.22),
        y,
        92,
        82,
        symbolForAngle(angles[i]),
        () => {
          angles[i] = (angles[i] + 1) % 4;
          const label = symbolForAngle(angles[i]);
          mirrorLabels[i]?.setText(label);
          status.setText(
            `Spegel ${i + 1}: ${label}   ·   Ljuset går vidare längs väggen.`,
          );
          if (isLightAligned(angles)) finish();
        },
      );
      mirrorLabels[i] = control.text;
    });
  }

  addButton(
    x,
    y + panelH * 0.37,
    Math.min(290, panelW - 40),
    58,
    '← TILL KAMMAREN',
    onClose,
    0x9c7745,
  );
  return root;
}

function puzzleTitle(id: PuzzleId) {
  return id === 'glyph-sequence'
    ? 'Stjärnornas lås'
    : id === 'balanced-stones'
      ? 'Stenvågen'
      : 'Solens speglar';
}

function clue(id: PuzzleId) {
  if (id === 'glyph-sequence')
    return 'Reliefen visar ordningen: Sol · Flod · Öga. Tryck tecknen i följd.';
  if (id === 'balanced-stones')
    return 'Lejonet väger tre stenar. Fördela vikterna jämnt mellan skålarna. Tryck en vikt för att flytta den.';
  return 'Vrid speglarna tills ljusstrålen följer den ingraverade vinkeln: upp, ned, upp.';
}

const balanceWeights = [1, 2, 3] as const;
