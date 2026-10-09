import Phaser from 'phaser';
import type { RoomDefinition } from '../world/types';

export function createPyramidMap(
  scene: Phaser.Scene,
  rooms: Record<string, RoomDefinition>,
  visited: string[],
  current: string,
  solved: string[],
  width: number,
  height: number,
  onClose: () => void,
) {
  const root = scene.add.container(0, 0).setDepth(20);
  root.add(
    scene.add
      .rectangle(0, 0, width, height, 0x090806, 0.88)
      .setOrigin(0)
      .setInteractive(),
  );
  const panelW = Math.min(width - 28, 720);
  const panelH = Math.min(height - 28, 520);
  const cx = width / 2;
  const cy = height / 2;
  root.add(
    scene.add
      .rectangle(cx, cy, panelW, panelH, 0x241b14)
      .setStrokeStyle(2, 0xb89358),
  );
  root.add(
    scene.add
      .text(cx, cy - panelH * 0.4, 'PYRAMIDENS KAMRAR', {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${Phaser.Math.Clamp(width * 0.04, 20, 32)}px`,
        color: '#f1dfbc',
        letterSpacing: 2,
      })
      .setOrigin(0.5),
  );
  const art = scene.add.graphics();
  const mapW = Math.min(panelW * 0.6, 390);
  const mapH = panelH * 0.48;
  const top = cy - panelH * 0.23;
  art.fillStyle(0x49351f, 0.74);
  art.fillPoints(
    [
      { x: cx, y: top },
      { x: cx + mapW / 2, y: top + mapH },
      { x: cx - mapW / 2, y: top + mapH },
    ],
    true,
  );
  art.lineStyle(3, 0xb28d56, 0.8);
  art.strokePoints(
    [
      { x: cx, y: top },
      { x: cx + mapW / 2, y: top + mapH },
      { x: cx - mapW / 2, y: top },
    ],
    true,
  );
  const nodes = Object.values(rooms).map((room) => {
    const geometry = room.mapGeometry;
    const worldCenterX = geometry.x + geometry.width / 2;
    const worldCenterY = geometry.y + geometry.height / 2;
    return {
      id: room.id,
      x: cx + (worldCenterX / 3000 - 0.5) * mapW * 0.78,
      y: top + (1 - worldCenterY / 1600) * mapH * 0.78,
    };
  });
  art.lineStyle(5, 0xc2a06a, 0.66);
  nodes.slice(0, 2).forEach((node, i) => {
    if (visited.includes(node.id) && visited.includes(nodes[i + 1].id))
      art.lineBetween(node.x, node.y, nodes[i + 1].x, nodes[i + 1].y);
  });
  root.add(art);
  for (const node of nodes) {
    if (!visited.includes(node.id)) continue;
    const isCurrent = current === node.id;
    const room = rooms[node.id];
    const unlocked = room.exits.filter(
      (exit) =>
        !exit.requiredPuzzleId || solved.includes(exit.requiredPuzzleId),
    ).length;
    const dot = scene.add
      .circle(
        node.x,
        node.y,
        isCurrent ? 18 : 13,
        isCurrent ? 0xe0bc72 : 0x806744,
      )
      .setStrokeStyle(3, isCurrent ? 0xffe5a8 : 0xd3b47e);
    const label = scene.add
      .text(node.x, node.y + 26, room.title, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '13px',
        color: '#e6d7bd',
        align: 'center',
        wordWrap: { width: 130 },
      })
      .setOrigin(0.5, 0);
    const state = scene.add
      .text(
        node.x,
        node.y - 35,
        `${isCurrent ? 'NU' : 'UPPTÄCKT'} · ${unlocked} VÄG`,
        {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '9px',
          color: '#c8a66d',
          letterSpacing: 0.5,
        },
      )
      .setOrigin(0.5);
    root.add([dot, label, state]);
  }
  root.add(
    scene.add
      .text(cx, cy + panelH * 0.29, 'Okända rum visas inte på kartan.', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '14px',
        color: '#c8b798',
      })
      .setOrigin(0.5),
  );
  const button = scene.add
    .rectangle(cx, cy + panelH * 0.4, Math.min(280, panelW - 42), 56, 0x9d7845)
    .setStrokeStyle(2, 0xe0bf80)
    .setInteractive({ useHandCursor: true });
  const text = scene.add
    .text(cx, cy + panelH * 0.4, '← TILL KAMMAREN', {
      fontFamily: 'DM Sans, sans-serif',
      fontSize: '16px',
      color: '#20170f',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });
  button.on('pointerdown', onClose);
  text.on('pointerdown', onClose);
  root.add([button, text]);
  return root;
}
