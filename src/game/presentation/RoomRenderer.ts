import Phaser from 'phaser';
import type {
  DoorVisualState,
  ExitDefinition,
  RoomDefinition,
  RoomObjectDefinition,
} from '../world/types';
import { initialDoorState, transitionDoorState } from './doorState';

export interface DoorView {
  exitId: string;
  x: number;
  y: number;
  width: number;
  state: DoorVisualState;
  reveal: Phaser.GameObjects.Graphics;
  leaves: Phaser.GameObjects.Graphics[];
}

export function renderRoomLayers(
  scene: Phaser.Scene,
  room: RoomDefinition,
  solvedExitIds: string[],
) {
  const { x, y, width, height } = room.worldBounds;
  const backgroundKey = `room-background-${room.id}`;
  if (
    room.presentation.backgroundImage &&
    scene.textures.exists(backgroundKey)
  ) {
    scene.add
      .image(x, y, backgroundKey)
      .setOrigin(0)
      .setDisplaySize(width, height)
      .setDepth(0);
  } else {
    const background = scene.add.graphics().setDepth(0);
    background.fillGradientStyle(
      room.background.top,
      room.background.top,
      room.background.bottom,
      room.background.bottom,
      1,
    );
    background.fillRect(x, y, width, height);
  }

  // Architecture sits above the swappable background as its own presentation layer.
  const architecture = scene.add.graphics().setDepth(1);
  const horizon = 1030;
  if (
    !room.presentation.backgroundImage ||
    !scene.textures.exists(backgroundKey)
  ) {
    architecture.fillStyle(0x100e0c, 0.38);
    architecture.fillRect(x, 0, width, 265);
    architecture.fillStyle(room.background.wall, 1);
    architecture.fillRect(x, 265, width, horizon - 265);
    drawMasonry(architecture, width, room.background.wall);
    drawCornice(architecture, width, room.background.accent);
    drawFloor(architecture, width, height, horizon, room.background.accent);
  }

  const alcoves = scene.add.graphics().setDepth(1.5);
  drawAlcoves(alcoves, room);
  const columns = scene.add.graphics().setDepth(2);
  drawColumns(columns, room);

  for (const object of room.presentation.objects) {
    drawObject(scene, object, room.background.accent, room.id);
  }

  const doorViews = new Map<string, DoorView>();
  for (const exit of room.exits) {
    const art = room.presentation.doorways.find(
      ({ exitId }) => exitId === exit.id,
    );
    if (!art) continue;
    const state = initialDoorState(
      Boolean(exit.initiallyUnlocked || solvedExitIds.includes(exit.id)),
    );
    doorViews.set(
      exit.id,
      drawDoor(scene, room, exit, art.width, art.height, state),
    );
  }

  drawAtmosphere(scene, room);
  return { doorViews };
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
  for (const cx of room.presentation.columns) {
    // Deep side shadow, tapered shaft, carved flutes, and broad lotus capital.
    g.fillStyle(0x080706, 0.42);
    g.fillEllipse(cx + 24, 1035, 220, 72);
    g.fillStyle(0x251b13, 1);
    g.fillPoints(
      [
        { x: cx - 63, y: 354 },
        { x: cx + 58, y: 354 },
        { x: cx + 88, y: 1010 },
        { x: cx - 75, y: 1010 },
      ],
      true,
    );
    g.fillStyle(0x705637, 1);
    g.fillPoints(
      [
        { x: cx - 38, y: 365 },
        { x: cx + 30, y: 365 },
        { x: cx + 55, y: 986 },
        { x: cx - 44, y: 986 },
      ],
      true,
    );
    g.fillStyle(0xb28e5b, 0.7);
    g.fillPoints(
      [
        { x: cx - 25, y: 375 },
        { x: cx - 14, y: 375 },
        { x: cx - 20, y: 975 },
        { x: cx - 34, y: 975 },
      ],
      true,
    );
    g.lineStyle(3, 0x33271c, 0.76);
    for (let i = 0; i < 6; i++) {
      const yy = 470 + i * 88;
      const halfWidth = 42 + i * 2;
      g.lineBetween(cx - halfWidth, yy, cx + halfWidth, yy + 2);
    }
    g.lineStyle(2, 0xd9bd89, 0.52);
    g.lineBetween(cx - 34, 382, cx - 43, 966);
    g.lineStyle(2, 0x33271c, 0.85);
    g.lineBetween(cx + 22, 380, cx + 49, 975);
    g.fillStyle(0x211910, 1);
    g.fillPoints(
      [
        { x: cx - 104, y: 331 },
        { x: cx + 104, y: 331 },
        { x: cx + 72, y: 391 },
        { x: cx - 72, y: 391 },
      ],
      true,
    );
    g.fillStyle(0xb28b56, 0.95);
    g.fillRect(cx - 112, 315, 224, 19);
    g.fillRect(cx - 82, 382, 164, 12);
    g.fillRect(cx - 91, 988, 182, 38);
    g.fillStyle(0x49351f, 1);
    for (let petal = -2; petal <= 2; petal++) {
      g.fillEllipse(cx + petal * 30, 347, 32, 54);
    }
    g.lineStyle(2, 0xd5b477, 0.72);
    for (let petal = -2; petal <= 2; petal++) {
      g.lineBetween(cx + petal * 30, 324, cx + petal * 30, 365);
    }
  }
}

function drawAlcoves(g: Phaser.GameObjects.Graphics, room: RoomDefinition) {
  for (const cx of room.presentation.alcoves) {
    g.fillStyle(0x090807, 0.5);
    g.fillPoints(archPoints(cx - 150, 390, 300, 620), true);
    g.fillStyle(0x3b2c1c, 0.86);
    g.fillRect(cx - 120, 590, 240, 350);
    g.lineStyle(22, 0x281d14, 1);
    g.strokePoints(archPoints(cx - 150, 390, 300, 620), false);
    g.lineStyle(8, 0x8b6a40, 0.9);
    g.strokePoints(archPoints(cx - 134, 406, 268, 588), false);
    g.lineStyle(2, 0xd9bd89, 0.52);
    g.strokePoints(archPoints(cx - 127, 414, 254, 596), false);
    g.fillStyle(0x120d08, 0.66);
    g.fillPoints(archPoints(cx - 96, 480, 192, 510), true);
    g.fillStyle(0x725536, 0.52);
    g.fillRect(cx - 126, 920, 252, 22);
    g.fillStyle(0xd8ad67, 0.08);
    g.fillEllipse(cx, 700, 170, 440);
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
  room: RoomDefinition,
  exit: ExitDefinition,
  width: number,
  height: number,
  state: DoorVisualState,
): DoorView {
  const x = exit.x;
  const y = 338;
  const left = x - width / 2;

  // A recessed reveal/corridor is independently visible behind the moving slabs.
  const reveal = scene.add.graphics().setDepth(2.6);
  reveal.fillStyle(0x060504, 1);
  reveal.fillPoints(
    archPoints(left + 30, y + 30, width - 60, height - 30),
    true,
  );
  reveal.fillStyle(0x130e08, 0.96);
  reveal.fillPoints(
    archPoints(left + 84, y + 94, width - 168, height - 112),
    true,
  );
  reveal.fillStyle(room.background.accent, 0.12);
  reveal.fillEllipse(x, y + height * 0.53, width * 0.65, height * 0.7);
  reveal.fillStyle(0xf3c774, 0.15);
  reveal.fillEllipse(x, y + height * 0.48, width * 0.32, height * 0.44);
  reveal.setAlpha(state === 'open' ? 1 : 0);

  // The carved frame is a separate static component around the doorway.
  const frame = scene.add.graphics().setDepth(3);
  frame.fillStyle(0x080706, 0.72);
  frame.fillPoints(
    archPoints(left - 32, y - 28, width + 64, height + 54),
    true,
  );
  frame.fillStyle(0x33261a, 1);
  frame.fillPoints(
    archPoints(left - 17, y - 17, width + 34, height + 34),
    true,
  );
  frame.lineStyle(24, 0x6a5032, 1);
  frame.strokePoints(archPoints(left, y, width, height), true);
  frame.lineStyle(8, 0xb18a53, 0.94);
  frame.strokePoints(
    archPoints(left + 17, y + 15, width - 34, height - 29),
    true,
  );
  frame.lineStyle(2, 0xe2c58d, 0.62);
  frame.strokePoints(
    archPoints(left + 32, y + 30, width - 64, height - 56),
    true,
  );
  for (let i = 0; i < 5; i++) {
    const glyphX = left + 62 + i * ((width - 124) / 4);
    frame.fillStyle(0xd4b477, 0.66);
    frame.fillTriangle(glyphX - 9, y + 50, glyphX + 9, y + 50, glyphX, y + 68);
    frame.lineStyle(2, 0xe4c990, 0.42);
    frame.lineBetween(glyphX, y + 73, glyphX, y + 112);
  }
  frame.fillStyle(0xb89054, 0.92);
  frame.fillCircle(x, y + height - 82, 18);
  frame.fillStyle(0x2a2017, 1);
  frame.fillCircle(x, y + height - 82, 9);

  const leaves: Phaser.GameObjects.Graphics[] = [];
  const leafWidth = (width - 76) / 2;
  for (const side of [-1, 1]) {
    const leaf = scene.add.graphics().setDepth(4);
    const lx = side < 0 ? left + 35 : x + 3;
    const ly = y + 38;
    leaf.fillStyle(0x140f0a, 0.76);
    leaf.fillRect(6, 12, leafWidth, height - 76);
    leaf.fillStyle(0x58432c, 1);
    leaf.fillPoints(
      [
        { x: 0, y: 8 },
        { x: leafWidth, y: 0 },
        { x: leafWidth - 3, y: height - 86 },
        { x: 0, y: height - 76 },
      ],
      true,
    );
    leaf.fillStyle(0x94764c, 0.64);
    leaf.fillPoints(
      [
        { x: 12, y: 22 },
        { x: leafWidth - 14, y: 14 },
        { x: leafWidth - 17, y: height - 102 },
        { x: 12, y: height - 93 },
      ],
      true,
    );
    leaf.lineStyle(4, 0x34271b, 0.86);
    leaf.strokeRect(22, 36, leafWidth - 44, height - 146);
    leaf.lineStyle(2, 0xc2a16d, 0.7);
    for (let i = 0; i < 5; i++) {
      const markY = 132 + i * 94;
      leaf.lineBetween(leafWidth * 0.25, markY, leafWidth * 0.75, markY - 5);
    }
    leaf.fillStyle(0xd0ac70, 0.88);
    leaf.fillCircle(leafWidth / 2, height * 0.57, 10);
    leaf.setPosition(lx, ly);
    leaf.setVisible(state !== 'open');
    leaves.push(leaf);
  }

  return { exitId: exit.id, x, y, width, state, reveal, leaves };
}

function drawObject(
  scene: Phaser.Scene,
  object: RoomObjectDefinition,
  accent: number,
  roomId: string,
) {
  const { x, y, width: w, height: h } = object.area;
  const g = scene.add.graphics().setDepth(3);
  g.fillStyle(0x090807, 0.45);
  g.fillEllipse(x + w / 2, y + h * 0.94, w * 1.12, 58);
  if (object.visual === 'vessel') {
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
  } else if (object.visual === 'relief') {
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
  } else if (object.visual === 'mirror') {
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

  // The interaction rectangle stays generous; the rendered prop has breathing room.
  const visualScale = 0.78;
  g.setScale(visualScale).setPosition(
    (1 - visualScale) * (x + w / 2),
    (1 - visualScale) * (y + h / 2),
  );
}

export function animateDoorOpen(scene: Phaser.Scene, door: DoorView) {
  door.state = transitionDoorState(door.state, 'begin-opening');
  if (door.state !== 'opening') return;
  scene.cameras.main.shake(280, 0.0022);
  scene.tweens.add({
    targets: door.reveal,
    alpha: 1,
    duration: 520,
    ease: 'Sine.easeOut',
  });

  let completedLeaves = 0;
  const finishLeaf = () => {
    completedLeaves += 1;
    if (completedLeaves === door.leaves.length) {
      door.state = transitionDoorState(door.state, 'finish-opening');
    }
  };
  door.leaves.forEach((leaf, index) => {
    const direction = index === 0 ? -1 : 1;
    leaf.setVisible(true).setAlpha(1);
    scene.tweens.add({
      targets: leaf,
      x: leaf.x + direction * (door.width * 0.47),
      angle: direction * 2,
      duration: 860,
      ease: 'Cubic.easeInOut',
      onComplete: () => {
        leaf.setAngle(0).setVisible(false);
        finishLeaf();
      },
    });
  });

  const thresholdY = door.y + 620;
  for (let i = 0; i < 16; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const particle = scene.add
      .circle(
        door.x + Phaser.Math.Between(-55, 55),
        thresholdY + Phaser.Math.Between(-8, 14),
        Phaser.Math.Between(2, 5),
        i % 3 === 0 ? 0xe2c58d : 0xb59a70,
        0.42,
      )
      .setDepth(5);
    scene.tweens.add({
      targets: particle,
      x: particle.x + side * Phaser.Math.Between(35, 145),
      y: particle.y - Phaser.Math.Between(30, 110),
      alpha: 0,
      scale: 1.8,
      duration: Phaser.Math.Between(520, 980),
      ease: 'Sine.easeOut',
      onComplete: () => particle.destroy(),
    });
  }
}

function drawAtmosphere(scene: Phaser.Scene, room: RoomDefinition) {
  for (const x of room.presentation.torchPositions) {
    const glow = scene.add.graphics().setDepth(1.8);
    glow.fillStyle(0xe6a64d, 0.035);
    glow.fillEllipse(x, 560, 430, 670);
    glow.fillStyle(0xf0ba62, 0.045);
    glow.fillEllipse(x, 490, 240, 470);
    glow.fillStyle(0xffd48a, 0.07);
    glow.fillEllipse(x, 430, 78, 280);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.72, to: 1 },
      duration: Phaser.Math.Between(1700, 2400),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  for (let i = 0; i < 22; i++) {
    const x = (i * 317 + 113) % room.worldBounds.width;
    const y = 380 + ((i * 149) % 620);
    const dust = scene.add
      .circle(x, y, i % 4 === 0 ? 2.5 : 1.5, 0xe7d4b1, 0.16)
      .setDepth(4.5);
    scene.tweens.add({
      targets: dust,
      x: x + 22 + (i % 3) * 9,
      y: y - 48 - (i % 5) * 10,
      alpha: 0.03,
      duration: 5200 + (i % 5) * 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
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
