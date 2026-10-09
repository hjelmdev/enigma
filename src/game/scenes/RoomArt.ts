import Phaser from 'phaser';
import type { HotspotDefinition, RoomDefinition } from '../world/types';

export function drawChamber(
  scene: Phaser.Scene,
  room: RoomDefinition,
  solvedExitIds: string[],
) {
  const { x, y, width, height } = room.worldBounds;
  const art = scene.add.graphics().setDepth(0);
  art.fillGradientStyle(
    room.background.top,
    room.background.top,
    room.background.bottom,
    room.background.bottom,
    1,
  );
  art.fillRect(x, y, width, height);

  const horizon = 1030;
  art.fillStyle(0x100e0c, 0.38);
  art.fillRect(x, 0, width, 265);
  art.fillStyle(room.background.wall, 1);
  art.fillRect(x, 265, width, horizon - 265);
  drawMasonry(art, width, room.background.wall);
  drawCornice(art, width, room.background.accent);
  drawFloor(art, width, height, horizon, room.background.accent);
  drawColumns(art, room);
  drawAlcoves(art, room);

  const doorLeaves: Phaser.GameObjects.Graphics[] = [];
  for (const exit of room.exits) {
    const open = exit.initiallyUnlocked || solvedExitIds.includes(exit.id);
    doorLeaves.push(
      ...drawDoor(scene, art, exit.x, exit.id, open, room.background.accent),
    );
  }

  for (const hotspot of room.hotspots) {
    if (hotspot.visual === 'door') continue;
    drawObject(scene, hotspot, room.background.accent, room.id);
  }
  return { art, doorLeaves };
}

function drawMasonry(
  g: Phaser.GameObjects.Graphics,
  width: number,
  wall: number,
) {
  g.lineStyle(2, 0x241c15, 0.28);
  for (let row = 0; row < 4; row++) {
    const top = 310 + row * 178;
    g.lineBetween(0, top, width, top);
    const offset = row % 2 ? -95 : 95;
    for (let col = 0; col < 13; col++) {
      const px = offset + col * 250;
      g.lineBetween(px, top, px, top + 178);
    }
  }
  g.lineStyle(1, 0xf0d29a, 0.12);
  for (let row = 0; row < 4; row++) {
    const top = 312 + row * 178;
    g.lineBetween(0, top, width, top);
  }
  g.fillStyle(wall, 0.07);
  for (let i = 0; i < 22; i++) {
    const px = (i * 421 + 73) % width;
    const py = 330 + ((i * 197) % 630);
    g.fillEllipse(px, py, 52 + (i % 3) * 18, 18, 0.11);
  }
}

function drawCornice(
  g: Phaser.GameObjects.Graphics,
  width: number,
  accent: number,
) {
  g.fillStyle(0x291f17, 0.86);
  g.fillRect(0, 236, width, 42);
  g.fillStyle(0x9b784d, 0.72);
  g.fillRect(0, 275, width, 14);
  g.lineStyle(3, accent, 0.3);
  g.lineBetween(0, 292, width, 292);
  g.lineStyle(1, 0xead1a1, 0.15);
  g.lineBetween(0, 240, width, 240);
}

function drawFloor(
  g: Phaser.GameObjects.Graphics,
  width: number,
  height: number,
  horizon: number,
  accent: number,
) {
  g.fillStyle(0x1b1510, 1);
  g.fillPoints(
    [
      { x: 0, y: horizon },
      { x: width, y: horizon },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    true,
  );
  g.fillGradientStyle(0x6b5030, 0x6b5030, 0x17120e, 0x17120e, 0.28);
  g.fillPoints(
    [
      { x: 0, y: horizon },
      { x: width, y: horizon },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    true,
  );
  g.lineStyle(3, accent, 0.24);
  g.lineBetween(0, horizon, width, horizon);
  g.lineStyle(2, 0x927452, 0.22);
  for (let i = 1; i <= 6; i++) {
    const lineY = horizon + i * 82;
    const inset = i * 74;
    g.lineBetween(inset, lineY, width - inset, lineY);
  }
  for (let i = 0; i <= 12; i++)
    g.lineBetween(width / 2, horizon, i * (width / 12), height);
}

function drawColumns(g: Phaser.GameObjects.Graphics, room: RoomDefinition) {
  const columns =
    room.id === 'relief' ? [360, 850, 2180, 2670] : [300, 880, 2120, 2700];
  for (const cx of columns) {
    g.fillStyle(0x080706, 0.28);
    g.fillEllipse(cx + 18, 1030, 190, 62);
    g.fillStyle(0x382a1d, 1);
    g.fillPoints(
      [
        { x: cx - 43, y: 336 },
        { x: cx + 43, y: 336 },
        { x: cx + 65, y: 1015 },
        { x: cx - 65, y: 1015 },
      ],
      true,
    );
    g.fillStyle(0x98764d, 1);
    g.fillPoints(
      [
        { x: cx - 25, y: 350 },
        { x: cx + 25, y: 350 },
        { x: cx + 43, y: 997 },
        { x: cx - 43, y: 997 },
      ],
      true,
    );
    g.lineStyle(2, 0xe1c28b, 0.48);
    g.lineBetween(cx - 24, 354, cx - 40, 992);
    g.lineStyle(3, 0x33271c, 0.8);
    for (let i = 0; i < 5; i++)
      g.lineBetween(cx - 41, 470 + i * 104, cx + 40, 470 + i * 104);
    g.fillStyle(0x211910, 1);
    g.fillPoints(
      [
        { x: cx - 82, y: 318 },
        { x: cx + 82, y: 318 },
        { x: cx + 63, y: 362 },
        { x: cx - 62, y: 362 },
      ],
      true,
    );
    g.fillStyle(0xb28b56, 0.95);
    g.fillRect(cx - 91, 300, 182, 23);
    g.fillRect(cx - 72, 1000, 144, 34);
    g.fillStyle(0xdcae63, 0.09);
    g.fillEllipse(cx, 600, 265, 820);
  }
}

function drawAlcoves(g: Phaser.GameObjects.Graphics, room: RoomDefinition) {
  const centers =
    room.id === 'inner'
      ? [1500]
      : room.id === 'relief'
        ? [1200, 1840]
        : [1160, 1820];
  for (const cx of centers) {
    g.fillStyle(0x241b14, 0.52);
    g.fillPoints(archPoints(cx - 150, 390, 300, 620), true);
    g.lineStyle(15, 0x35281c, 1);
    g.strokePoints(archPoints(cx - 150, 390, 300, 620), false);
    g.lineStyle(3, 0xc7a36b, 0.42);
    g.strokePoints(archPoints(cx - 127, 414, 254, 596), false);
    g.fillStyle(0x100d0a, 0.58);
    g.fillPoints(archPoints(cx - 90, 478, 180, 532), true);
    g.fillStyle(0xd8ad67, 0.06);
    g.fillEllipse(cx, 700, 120, 430);
  }
  if (room.id === 'inner') {
    g.fillStyle(0xe5b45e, 0.1);
    g.fillCircle(1500, 620, 210);
    g.lineStyle(9, 0xae884e, 0.78);
    g.strokeCircle(1500, 620, 104);
    g.lineStyle(2, 0xe1c784, 0.6);
    g.strokeCircle(1500, 620, 80);
  }
}

function drawDoor(
  scene: Phaser.Scene,
  base: Phaser.GameObjects.Graphics,
  x: number,
  exitId: string,
  open: boolean,
  accent: number,
) {
  const y = 338;
  const w = exitId.startsWith('back-') ? 360 : 440;
  const h = 710;
  const left = x - w / 2;
  base.fillStyle(0x080706, 0.58);
  base.fillPoints(archPoints(left - 30, y - 26, w + 60, h + 50), true);
  base.fillStyle(0x322519, 1);
  base.fillPoints(archPoints(left - 18, y - 20, w + 36, h + 30), true);
  base.lineStyle(15, 0x9a774b, 0.94);
  base.strokePoints(archPoints(left, y, w, h), true);
  base.lineStyle(4, accent, 0.75);
  base.strokePoints(archPoints(left + 18, y + 18, w - 36, h - 36), true);
  base.fillStyle(open ? 0x080706 : 0x60482f, 1);
  base.fillPoints(archPoints(left + 32, y + 32, w - 64, h - 64), true);
  base.fillStyle(0x090807, 0.86);
  base.fillPoints(archPoints(left + 65, y + 70, w - 130, h - 100), true);
  base.lineStyle(2, 0xd5b679, 0.34);
  for (let i = 0; i < 5; i++) {
    const gx = left + 88 + i * ((w - 176) / 4);
    base.lineBetween(gx, y + 48, gx, y + 105);
    base.fillTriangle(gx - 10, y + 96, gx + 10, y + 96, gx, y + 118);
  }
  base.fillStyle(0xb89054, 0.9);
  base.fillCircle(x, y + h - 88, 16);
  base.fillStyle(0x2a2017, 1);
  base.fillCircle(x, y + h - 88, 8);

  const leaves: Phaser.GameObjects.Graphics[] = [];
  const half = (w - 72) / 2;
  for (const side of [-1, 1]) {
    const leaf = scene.add.graphics().setDepth(3);
    const lx = x + (side < 0 ? -half - 36 : 36);
    leaf.fillStyle(0x65503a, 1);
    leaf.fillPoints(doorLeafPoints(half, h - 74), true);
    leaf.fillStyle(0x90734b, 0.78);
    leaf.fillPoints(doorLeafPoints(half - 24, h - 102, 12, 14), true);
    leaf.lineStyle(3, 0x33271b, 0.9);
    leaf.strokePoints(doorLeafPoints(half - 52, h - 134, 26, 30), true);
    for (let i = 0; i < 4; i++) {
      leaf.lineStyle(2, 0x34271a, 0.68);
      leaf.lineBetween(35, 180 + i * 104, half - 35, 180 + i * 104);
    }
    leaf.fillStyle(0xc4a16a, 0.86);
    leaf.fillCircle(half / 2, h / 2, 9);
    leaf.setPosition(lx, y + 37);
    leaf.setVisible(!open);
    leaves.push(leaf);
  }
  if (open) {
    base.fillStyle(0xffcd75, 0.12);
    base.fillRoundedRect(left + 56, y + 54, w - 112, h - 106, 120);
  }
  return leaves;
}

function drawObject(
  scene: Phaser.Scene,
  hotspot: HotspotDefinition,
  accent: number,
  roomId: string,
) {
  const { x, y, width: w, height: h } = hotspot.area;
  const g = scene.add.graphics().setDepth(2);
  g.fillStyle(0x090807, 0.45);
  g.fillEllipse(x + w / 2, y + h * 0.94, w * 1.12, 58);
  if (hotspot.visual === 'vessel') {
    g.fillStyle(0x30251b, 1);
    g.fillPoints(
      [
        { x: x + w * 0.24, y: y + h * 0.24 },
        { x: x + w * 0.76, y: y + h * 0.24 },
        { x: x + w * 0.83, y: y + h * 0.73 },
        { x: x + w * 0.67, y: y + h * 0.91 },
        { x: x + w * 0.33, y: y + h * 0.91 },
        { x: x + w * 0.17, y: y + h * 0.73 },
      ],
      true,
    );
    g.fillStyle(0x90704a, 1);
    g.fillPoints(
      [
        { x: x + w * 0.3, y: y + h * 0.28 },
        { x: x + w * 0.7, y: y + h * 0.28 },
        { x: x + w * 0.74, y: y + h * 0.7 },
        { x: x + w * 0.62, y: y + h * 0.83 },
        { x: x + w * 0.38, y: y + h * 0.83 },
        { x: x + w * 0.26, y: y + h * 0.7 },
      ],
      true,
    );
    g.fillStyle(0x241b14, 1);
    g.fillEllipse(x + w / 2, y + h * 0.27, w * 0.48, 42);
    g.lineStyle(8, accent, 0.9);
    g.strokeEllipse(x + w / 2, y + h * 0.27, w * 0.5, 44);
    g.lineStyle(4, 0x32271b, 0.9);
    g.lineBetween(x + w * 0.32, y + h * 0.56, x + w * 0.68, y + h * 0.56);
  } else if (hotspot.visual === 'relief') {
    g.fillStyle(0x392b1e, 1);
    g.fillPoints(
      [
        { x: x + w * 0.12, y: y + 8 },
        { x: x + w * 0.88, y: y + 8 },
        { x: x + w - 12, y: y + h * 0.16 },
        { x: x + w - 12, y: y + h * 0.88 },
        { x: x + w * 0.82, y: y + h - 8 },
        { x: x + w * 0.18, y: y + h - 8 },
        { x: x + 12, y: y + h * 0.88 },
        { x: x + 12, y: y + h * 0.16 },
      ],
      true,
    );
    g.fillStyle(0x6d5638, 1);
    g.fillPoints(
      [
        { x: x + w * 0.16, y: y + 26 },
        { x: x + w * 0.84, y: y + 26 },
        { x: x + w * 0.8, y: y + h - 28 },
        { x: x + w * 0.2, y: y + h - 28 },
      ],
      true,
    );
    g.lineStyle(6, accent, 0.82);
    g.strokePoints(
      [
        { x: x + w * 0.19, y: y + 38 },
        { x: x + w * 0.81, y: y + 38 },
        { x: x + w * 0.77, y: y + h - 40 },
        { x: x + w * 0.23, y: y + h - 40 },
      ],
      true,
    );
    g.lineStyle(7, 0xe0c17f, 0.76);
    const cx = x + w / 2;
    g.strokeCircle(cx, y + h * 0.35, Math.min(w, h) * 0.13);
    g.lineBetween(cx - 68, y + h * 0.64, cx - 20, y + h * 0.64);
    g.lineBetween(cx + 20, y + h * 0.64, cx + 68, y + h * 0.64);
    g.strokeTriangle(
      cx,
      y + h * 0.56,
      cx - 44,
      y + h * 0.73,
      cx + 44,
      y + h * 0.73,
    );
  } else if (hotspot.visual === 'mirror') {
    for (let i = 0; i < 3; i++) {
      const mx = x + 50 + (i * (w - 100)) / 2;
      g.fillStyle(0x32271c, 1);
      g.fillRoundedRect(mx - 36, y + 35, 72, h - 90, 22);
      g.fillStyle(0x9e8056, 1);
      g.fillRoundedRect(mx - 25, y + 48, 50, h - 116, 20);
      g.fillStyle(0xb7a481, 0.7);
      g.fillPoints(
        [
          { x: mx - 15, y: y + 62 },
          { x: mx - 3, y: y + 62 },
          { x: mx + 15, y: y + h - 90 },
          { x: mx + 3, y: y + h - 90 },
        ],
        true,
      );
    }
    g.lineStyle(3, accent, 0.6);
    g.lineBetween(x + 25, y + h * 0.55, x + w - 25, y + h * 0.55);
  } else {
    g.fillStyle(0x312419, 1);
    g.fillPoints(
      [
        { x: x + w * 0.24, y: y + h * 0.55 },
        { x: x + w * 0.76, y: y + h * 0.55 },
        { x: x + w * 0.84, y: y + h * 0.88 },
        { x: x + w * 0.16, y: y + h * 0.88 },
      ],
      true,
    );
    g.fillStyle(0x9e7b4d, 1);
    g.fillPoints(
      [
        { x: x + w * 0.08, y: y + h * 0.49 },
        { x: x + w * 0.92, y: y + h * 0.49 },
        { x: x + w * 0.86, y: y + h * 0.63 },
        { x: x + w * 0.14, y: y + h * 0.63 },
      ],
      true,
    );
    g.fillStyle(0x403021, 1);
    g.fillPoints(
      [
        { x: x + w * 0.2, y: y + h * 0.19 },
        { x: x + w * 0.8, y: y + h * 0.19 },
        { x: x + w * 0.72, y: y + h * 0.47 },
        { x: x + w * 0.28, y: y + h * 0.47 },
      ],
      true,
    );
    g.lineStyle(4, accent, 0.7);
    g.strokePoints(
      [
        { x: x + w * 0.23, y: y + h * 0.22 },
        { x: x + w * 0.77, y: y + h * 0.22 },
        { x: x + w * 0.7, y: y + h * 0.44 },
        { x: x + w * 0.3, y: y + h * 0.44 },
      ],
      true,
    );
    if (roomId === 'entrance') {
      const glyphs = ['☼', '≋', '◉'];
      glyphs.forEach((glyph, i) =>
        scene.add
          .text(x + w * (0.3 + i * 0.2), y + h * 0.31, glyph, {
            fontFamily: 'Georgia, serif',
            fontSize: '28px',
            color: '#e7c47d',
          })
          .setOrigin(0.5)
          .setDepth(3),
      );
    }
  }
}

export function animateDoorOpen(
  scene: Phaser.Scene,
  leaves: Phaser.GameObjects.Graphics[],
) {
  leaves.forEach((leaf, index) => {
    leaf.setVisible(true);
    scene.tweens.add({
      targets: leaf,
      x: leaf.x + (index === 0 ? -180 : 180),
      alpha: 0,
      duration: 700,
      ease: 'Cubic.easeInOut',
      onComplete: () => leaf.setVisible(false),
    });
  });
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

function doorLeafPoints(width: number, height: number, x = 0, y = 0) {
  return archPoints(x, y, width, height);
}
