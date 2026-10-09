import Phaser from 'phaser';
import { rooms } from '../world/rooms';
import {
  animateDoorOpen,
  renderRoomLayers,
} from '../presentation/RoomRenderer';
import type { DoorView } from '../presentation/RoomRenderer';
import { session, solvePuzzle, visitRoom } from '../state/session';
import { createPuzzlePanel } from '../ui/PuzzlePanel';
import { createPyramidMap } from '../ui/PyramidMap';
import {
  advancePanMomentum,
  clampCameraScroll,
  getPanAvailability,
  isPanGesture,
} from '../navigation/cameraPan';
import type {
  HotspotDefinition,
  PuzzleId,
  RoomDefinition,
  RoomObjectVisual,
} from '../world/types';

const FOCUS_DURATION = 360;
const RETURN_DURATION = 300;

interface CameraState {
  scrollX: number;
  scrollY: number;
  zoom: number;
  centerX: number;
  centerY: number;
}

interface SceneData {
  roomId?: string;
  scrollX?: number;
  scrollY?: number;
  focusedHotspotId?: string;
  cameraBeforeFocus?: CameraState;
}

interface PointerGesture {
  id: number;
  startX: number;
  startY: number;
  startScrollX: number;
  startScrollY: number;
  moved: boolean;
  tapAllowed: boolean;
  lastMoveAt: number;
  velocityX: number;
  velocityY: number;
}

export class ChamberScene extends Phaser.Scene {
  private room: RoomDefinition = rooms.entrance;
  private isFocused = false;
  private focusedHotspot?: HotspotDefinition;
  private cameraBeforeFocus?: CameraState;
  private focusPanel?: Phaser.GameObjects.Container;
  private uiRoot?: Phaser.GameObjects.Container;
  private hotspotOutlines = new Map<string, Phaser.GameObjects.Graphics>();
  private keyboardHandlers: Array<{ event: string; handler: () => void }> = [];
  private pointerGesture?: PointerGesture;
  private hoveredHotspotId?: string;
  private uiHeaderHeight = 0;
  private uiFooterHeight = 0;
  private modal?: Phaser.GameObjects.Container;
  private doorViews = new Map<string, DoorView>();
  private narrative?: Phaser.GameObjects.Text;
  private roomId = 'entrance';
  private panLeftCue?: Phaser.GameObjects.Text;
  private panRightCue?: Phaser.GameObjects.Text;
  private panUpCue?: Phaser.GameObjects.Text;
  private panDownCue?: Phaser.GameObjects.Text;
  private panInertia = { x: 0, y: 0 };

  constructor() {
    super('chamber');
  }

  preload() {
    for (const room of Object.values(rooms)) {
      const imagePath = room.presentation.backgroundImage;
      if (!imagePath) continue;
      const textureKey = `room-background-${room.id}`;
      if (!this.textures.exists(textureKey)) {
        this.load.image(
          textureKey,
          new URL(imagePath, document.baseURI).toString(),
        );
      }
    }
  }

  update(_time: number, delta: number) {
    if (
      !this.pointerGesture &&
      (Math.abs(this.panInertia.x) >= 0.015 ||
        Math.abs(this.panInertia.y) >= 0.015)
    ) {
      const next = advancePanMomentum(
        this.cameras.main.scrollX,
        this.cameras.main.scrollY,
        this.panInertia.x,
        this.panInertia.y,
        delta,
        this.room.worldBounds,
        this.cameras.main.width,
        this.cameras.main.height,
        this.cameras.main.zoom,
      );
      this.panInertia = { x: next.velocityX, y: next.velocityY };
      this.setCameraScroll(next.scrollX, next.scrollY);
    }
    this.updatePanCues();
  }

  create(data: SceneData = {}) {
    const { width: viewWidth, height: viewHeight } = this.scale;
    this.roomId = data.roomId ?? session.currentRoomId;
    this.room = rooms[this.roomId] ?? rooms.entrance;
    visitRoom(this.room.id);
    const { x, y, width, height } = this.room.worldBounds;
    this.isFocused = false;
    this.focusedHotspot = undefined;
    this.cameraBeforeFocus = data.cameraBeforeFocus;
    this.focusPanel?.destroy();
    this.modal?.destroy();
    this.hotspotOutlines.clear();
    this.pointerGesture = undefined;

    const art = renderRoomLayers(this, this.room, this.openExitIds());
    this.doorViews = art.doorViews;
    this.createHotspots();

    const camera = this.cameras.main;
    camera.setBounds(x, y, width, height);
    camera.setZoom(1);
    const maxScrollX = Math.max(x, x + width - viewWidth);
    const maxScrollY = Math.max(y, y + height - viewHeight);
    // Place the first authored visual focus in view; edge cues show the room's extent.
    const firstObject = this.room.presentation.objects[0];
    const defaultScrollX = firstObject
      ? firstObject.area.x + firstObject.area.width / 2 - viewWidth * 0.56
      : x;
    const defaultScrollY = y + (height - viewHeight) / 2;
    camera.setScroll(
      Phaser.Math.Clamp(data.scrollX ?? defaultScrollX, x, maxScrollX),
      Phaser.Math.Clamp(data.scrollY ?? defaultScrollY, y, maxScrollY),
    );

    this.createUiLayer(viewWidth, viewHeight);
    this.updatePanCues();
    this.onKeyboard('keydown-ESC', () => {
      if (this.modal) {
        this.modal.destroy();
        this.modal = undefined;
      } else this.closeFocus();
    });
    this.onKeyboard('keydown-BACKSPACE', () => this.closeFocus());
    this.room.hotspots.forEach((hotspot, index) => {
      this.onKeyboard(`keydown-F${index + 1}`, () => this.openFocus(hotspot));
    });
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUpOutside, this);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.input.off('pointerdown', this.onPointerDown, this);
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('pointerupoutside', this.onPointerUpOutside, this);
      for (const { event, handler } of this.keyboardHandlers) {
        this.input.keyboard?.off(event, handler);
      }
      this.keyboardHandlers = [];
    });
    camera.fadeIn(280, 15, 11, 7);

    const hotspotToRestore = this.room.hotspots.find(
      ({ id }) => id === data.focusedHotspotId,
    );
    if (hotspotToRestore) {
      this.cameraBeforeFocus = data.cameraBeforeFocus;
      this.time.delayedCall(0, () => this.openFocus(hotspotToRestore, true));
    }
  }

  private drawArtifact(
    graphics: Phaser.GameObjects.Graphics,
    visual: RoomObjectVisual,
    width: number,
    height: number,
  ) {
    if (visual === 'vessel') {
      graphics.fillStyle(0x0b0907, 0.38);
      graphics.fillEllipse(width * 0.52, height * 0.92, width * 0.9, 52);
      graphics.fillStyle(0x59432d, 1);
      graphics.fillPoints(
        [
          { x: width * 0.27, y: height * 0.23 },
          { x: width * 0.73, y: height * 0.23 },
          { x: width * 0.82, y: height * 0.78 },
          { x: width * 0.67, y: height * 0.9 },
          { x: width * 0.33, y: height * 0.9 },
          { x: width * 0.18, y: height * 0.78 },
        ],
        true,
      );
      graphics.fillStyle(0x9a7548, 0.85);
      graphics.fillRoundedRect(
        width * 0.39,
        height * 0.08,
        width * 0.22,
        height * 0.2,
        5,
      );
      graphics.lineStyle(5, 0xb29260, 0.88);
      graphics.strokeEllipse(width * 0.5, height * 0.25, width * 0.43, 30);
      graphics.lineStyle(3, 0x2b2016, 0.6);
      graphics.lineBetween(
        width * 0.3,
        height * 0.57,
        width * 0.7,
        height * 0.57,
      );
    } else {
      graphics.fillStyle(0x443321, 0.94);
      graphics.fillRoundedRect(
        width * 0.08,
        height * 0.05,
        width * 0.84,
        height * 0.9,
        12,
      );
      graphics.lineStyle(7, 0xb3915e, 0.86);
      graphics.strokeRoundedRect(
        width * 0.14,
        height * 0.11,
        width * 0.72,
        height * 0.78,
        8,
      );
      graphics.lineStyle(5, 0xd0b077, 0.88);
      const marks = [
        [0.37, 0.28, 0.37, 0.47],
        [0.59, 0.25, 0.69, 0.34],
        [0.58, 0.43, 0.7, 0.52],
        [0.35, 0.61, 0.46, 0.71],
        [0.59, 0.63, 0.59, 0.78],
      ];
      for (const [x1, y1, x2, y2] of marks) {
        graphics.lineBetween(width * x1, height * y1, width * x2, height * y2);
      }
      graphics.strokeCircle(width * 0.48, height * 0.35, 38);
      graphics.strokeTriangle(
        width * 0.42,
        height * 0.55,
        width * 0.55,
        height * 0.55,
        width * 0.48,
        height * 0.43,
      );
    }
  }

  private createHotspots() {
    this.hotspotOutlines = new Map();
    for (const hotspot of this.room.hotspots) {
      const outline = this.add.graphics().setDepth(4);
      this.drawOutline(outline, hotspot, false);
      this.hotspotOutlines.set(hotspot.id, outline);
    }
  }

  private drawOutline(
    graphics: Phaser.GameObjects.Graphics,
    hotspot: HotspotDefinition,
    active: boolean,
  ) {
    graphics.clear();
    if (!active) return;
    const { x, y, width, height } = hotspot.area;
    graphics.fillStyle(0xf2c777, 0.12);
    graphics.fillEllipse(
      x + width / 2,
      y + height / 2,
      width * 1.2,
      height * 1.08,
    );
    graphics.lineStyle(3, 0xffdda0, 0.8);
    graphics.strokeEllipse(
      x + width / 2,
      y + height / 2,
      width * 1.04,
      height * 0.96,
    );
  }

  private createUiLayer(w: number, h: number) {
    const worldObjects = [...this.children.list];
    const uiCamera = this.cameras.add(0, 0, w, h);
    uiCamera.ignore(worldObjects);

    const root = this.add.container(0, 0).setDepth(100);
    this.uiRoot = root;
    this.cameras.main.ignore(root);

    const headerH = Math.max(58, Math.min(76, h * 0.09));
    this.uiHeaderHeight = headerH;
    const header = this.add.rectangle(
      w / 2,
      headerH / 2,
      w,
      headerH,
      0x130f0b,
      0.82,
    );
    const divider = this.add.graphics();
    divider.lineStyle(1, 0xc39a5c, 0.52);
    divider.lineBetween(0, headerH, w, headerH);
    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.024, h * 0.045), 13, 23);
    const title = this.add
      .text(22, headerH / 2, this.room.title.toLocaleUpperCase('sv-SE'), {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f0dfbf',
        letterSpacing: 2,
      })
      .setOrigin(0, 0.5);
    const mapButton = this.add
      .text(w - 22, headerH / 2, '⌖  KARTA', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.022, h * 0.034), 13, 17)}px`,
        color: '#f3dfbb',
        letterSpacing: 1,
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    mapButton.on('pointerdown', () => this.openMap());

    root.add([header, divider, title, mapButton]);

    const footerH = Math.max(66, Math.min(86, h * 0.12));
    this.uiFooterHeight = footerH;
    const footer = this.add.rectangle(
      w / 2,
      h - footerH / 2,
      w,
      footerH,
      0x130f0b,
      0.86,
    );
    const footerRule = this.add.graphics();
    footerRule.lineStyle(1, 0xc39a5c, 0.42);
    footerRule.lineBetween(0, h - footerH, w, h - footerH);
    this.narrative = this.add
      .text(w / 2, h - footerH * 0.63, this.room.intro, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.022, h * 0.029), 12, 16)}px`,
        color: '#e5d4b4',
        align: 'center',
        wordWrap: { width: w - 36 },
      })
      .setOrigin(0.5);
    const instruction = this.add
      .text(
        w / 2,
        h - footerH * 0.18,
        this.room.worldBounds.width > w + 24
          ? 'DRA FÖR ATT UTFORSKA  ·  TRYCK PÅ FÖREMÅL'
          : 'TRYCK PÅ FÖREMÅL FÖR ATT UNDERSÖKA',
        {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.018, h * 0.025), 10, 13)}px`,
          color: '#c9a66d',
          letterSpacing: 0.6,
        },
      )
      .setOrigin(0.5);
    root.add([footer, footerRule, this.narrative, instruction]);

    // Screen-bound arrows show which directions still contain unexplored room.
    const cueY = headerH + (h - headerH - footerH) / 2;
    this.panLeftCue = this.add
      .text(12, cueY, '‹', {
        fontFamily: 'Georgia, serif',
        fontSize: `${Phaser.Math.Clamp(h * 0.065, 34, 52)}px`,
        color: '#f0cd91',
        backgroundColor: '#130f0b99',
        padding: { left: 5, right: 5, top: 0, bottom: 4 },
      })
      .setOrigin(0, 0.5);
    this.panRightCue = this.add
      .text(w - 12, cueY, '›', {
        fontFamily: 'Georgia, serif',
        fontSize: `${Phaser.Math.Clamp(h * 0.065, 34, 52)}px`,
        color: '#f0cd91',
        backgroundColor: '#130f0b99',
        padding: { left: 5, right: 5, top: 0, bottom: 4 },
      })
      .setOrigin(1, 0.5);
    const cueX = w / 2;
    this.panUpCue = this.add
      .text(cueX, headerH + 12, '⌃', {
        fontFamily: 'Georgia, serif',
        fontSize: '30px',
        color: '#f0cd91',
        backgroundColor: '#130f0b99',
        padding: { left: 10, right: 10, top: 2, bottom: 2 },
      })
      .setOrigin(0.5, 0);
    this.panDownCue = this.add
      .text(cueX, h - footerH - 12, '⌄', {
        fontFamily: 'Georgia, serif',
        fontSize: '30px',
        color: '#f0cd91',
        backgroundColor: '#130f0b99',
        padding: { left: 10, right: 10, top: 2, bottom: 2 },
      })
      .setOrigin(0.5, 1);
    root.add([
      this.panLeftCue,
      this.panRightCue,
      this.panUpCue,
      this.panDownCue,
    ]);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (this.modal || this.isFocused || !pointer.isDown) {
      return;
    }
    this.panInertia = { x: 0, y: 0 };
    this.pointerGesture = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startScrollX: this.cameras.main.scrollX,
      startScrollY: this.cameras.main.scrollY,
      moved: false,
      tapAllowed:
        pointer.y > this.uiHeaderHeight &&
        pointer.y < this.scale.height - this.uiFooterHeight,
      lastMoveAt: performance.now(),
      velocityX: 0,
      velocityY: 0,
    };
    if (this.pointerGesture.tapAllowed) this.updateHover(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (this.modal) return;
    if (!this.pointerGesture || this.pointerGesture.id !== pointer.id) {
      if (!this.isFocused && !pointer.isDown) this.updateHover(pointer);
      return;
    }
    const gesture = this.pointerGesture;
    const deltaX = pointer.x - gesture.startX;
    const deltaY = pointer.y - this.pointerGesture.startY;
    const now = performance.now();
    const elapsed = Math.max(1, now - gesture.lastMoveAt);
    if (!this.pointerGesture.moved && isPanGesture(deltaX, deltaY)) {
      this.pointerGesture.moved = true;
    }
    if (this.pointerGesture.moved) {
      this.input.setDefaultCursor('grabbing');
      const previousScroll = {
        x: this.cameras.main.scrollX,
        y: this.cameras.main.scrollY,
      };
      this.setCameraScroll(
        gesture.startScrollX - deltaX / this.cameras.main.zoom,
        gesture.startScrollY - deltaY / this.cameras.main.zoom,
      );
      gesture.velocityX = Phaser.Math.Clamp(
        (this.cameras.main.scrollX - previousScroll.x) / elapsed,
        -1.2,
        1.2,
      );
      gesture.velocityY = Phaser.Math.Clamp(
        (this.cameras.main.scrollY - previousScroll.y) / elapsed,
        -1.2,
        1.2,
      );
    }
    gesture.lastMoveAt = now;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    if (this.modal) {
      this.pointerGesture = undefined;
      return;
    }
    const gesture = this.pointerGesture;
    if (!gesture || gesture.id !== pointer.id) return;
    this.pointerGesture = undefined;
    this.input.setDefaultCursor('default');

    if (gesture.moved || !gesture.tapAllowed || this.isFocused) {
      if (gesture.moved) {
        this.panInertia = { x: gesture.velocityX, y: gesture.velocityY };
      }
      return;
    }
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hotspot = this.room.hotspots.find(({ area }) =>
      Phaser.Geom.Rectangle.Contains(
        new Phaser.Geom.Rectangle(area.x, area.y, area.width, area.height),
        worldPoint.x,
        worldPoint.y,
      ),
    );
    if (hotspot) this.pulseAndFocus(hotspot);
  }

  private onPointerUpOutside(pointer: Phaser.Input.Pointer) {
    if (this.pointerGesture?.id !== pointer.id) return;
    if (this.pointerGesture.moved) {
      this.panInertia = {
        x: this.pointerGesture.velocityX,
        y: this.pointerGesture.velocityY,
      };
    }
    this.pointerGesture = undefined;
    this.input.setDefaultCursor('default');
  }

  private updateHover(pointer: Phaser.Input.Pointer) {
    const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const hotspot = this.room.hotspots.find(
      ({ area }) =>
        worldPoint.x >= area.x &&
        worldPoint.x <= area.x + area.width &&
        worldPoint.y >= area.y &&
        worldPoint.y <= area.y + area.height,
    );
    if (hotspot?.id === this.hoveredHotspotId) return;
    this.hoveredHotspotId = hotspot?.id;
    for (const candidate of this.room.hotspots) {
      const outline = this.hotspotOutlines.get(candidate.id);
      if (outline)
        this.drawOutline(outline, candidate, candidate.id === hotspot?.id);
    }
  }

  private pulseAndFocus(hotspot: HotspotDefinition) {
    const outline = this.hotspotOutlines.get(hotspot.id);
    if (outline) this.drawOutline(outline, hotspot, true);
    if (!outline) {
      this.activateHotspot(hotspot);
      return;
    }
    this.tweens.add({
      targets: outline,
      alpha: { from: 0, to: 1 },
      duration: 100,
      yoyo: true,
      onComplete: () => this.activateHotspot(hotspot),
    });
  }

  private activateHotspot(hotspot: HotspotDefinition) {
    if (hotspot.puzzleId) {
      this.openPuzzle(hotspot.puzzleId);
      return;
    }
    if (hotspot.exitId) {
      this.useExit(hotspot.exitId);
      return;
    }
    this.narrative?.setText(`${hotspot.label}: ${hotspot.description}`);
    this.openFocus(hotspot);
  }

  private openPuzzle(id: PuzzleId) {
    if (session.solvedPuzzleIds.includes(id)) {
      this.narrative?.setText('Mekanismen är redan löst. Porten står öppen.');
      return;
    }
    this.modal?.destroy();
    this.modal = createPuzzlePanel(
      this,
      this.scale.width,
      this.scale.height,
      id,
      () => {
        this.modal = undefined;
        solvePuzzle(id);
        this.animateUnlockedDoor(id);
        this.narrative?.setText(
          'Ett dovt muller går genom stenen. Porten börjar glida upp.',
        );
      },
      () => {
        this.modal?.destroy();
        this.modal = undefined;
      },
    );
    this.uiRoot?.add(this.modal);
  }

  private animateUnlockedDoor(id: PuzzleId) {
    const exit = this.room.exits.find(
      (candidate) => candidate.requiredPuzzleId === id,
    );
    if (!exit) return;
    const door = this.doorViews.get(exit.id);
    if (!door || door.state !== 'closed') return;
    this.cameras.main.pan(exit.x, 720, 520, 'Sine.easeInOut');
    this.time.delayedCall(240, () => animateDoorOpen(this, door));
  }

  private useExit(exitId: string) {
    const exit = this.room.exits.find((candidate) => candidate.id === exitId);
    if (!exit) return;
    if (
      exit.requiredPuzzleId &&
      !session.solvedPuzzleIds.includes(exit.requiredPuzzleId)
    ) {
      this.narrative?.setText(
        'Porten är stängd. Undersök mekanismen i kammaren.',
      );
      return;
    }
    if (exit.destinationRoomId === 'ending') {
      this.openEnding();
      return;
    }
    this.narrative?.setText(
      'Stenporten glider åt sidan. En ny kammare väntar.',
    );
    session.currentRoomId = exit.destinationRoomId;
    this.cameras.main.fadeOut(420, 8, 6, 4);
    this.time.delayedCall(420, () =>
      this.scene.restart({ roomId: exit.destinationRoomId }),
    );
  }

  private openEnding() {
    const card = this.add.container(0, 0).setDepth(21);
    card.add(
      this.add
        .rectangle(0, 0, this.scale.width, this.scale.height, 0x090806, 0.9)
        .setOrigin(0),
    );
    card.add(
      this.add
        .text(this.scale.width / 2, this.scale.height * 0.4, 'SOLENS KAMMARE', {
          fontFamily: 'Cinzel, Georgia, serif',
          fontSize: '32px',
          color: '#f1dfbc',
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(
          this.scale.width / 2,
          this.scale.height * 0.52,
          'Ljuset bryter sigillen. Bakom porten väntar fler rum än kartan kan visa.',
          {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '17px',
            color: '#e2d1b1',
            align: 'center',
            wordWrap: { width: this.scale.width * 0.78 },
          },
        )
        .setOrigin(0.5),
    );
    const back = this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height * 0.72,
        280,
        58,
        0x9c7745,
      )
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(back.x, back.y, 'TILL KAMRARNA', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: '16px',
        color: '#20170f',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const close = () => card.destroy();
    back.on('pointerdown', close);
    label.on('pointerdown', close);
    card.add([back, label]);
    this.uiRoot?.add(card);
  }

  private openMap() {
    if (this.isFocused || this.modal) return;
    this.modal = createPyramidMap(
      this,
      rooms,
      session.visitedRoomIds,
      this.room.id,
      session.solvedPuzzleIds,
      this.scale.width,
      this.scale.height,
      () => {
        this.modal?.destroy();
        this.modal = undefined;
      },
    );
    this.uiRoot?.add(this.modal);
  }

  private openExitIds() {
    return this.room.exits
      .filter(
        (exit) =>
          exit.initiallyUnlocked ||
          (exit.requiredPuzzleId &&
            session.solvedPuzzleIds.includes(exit.requiredPuzzleId)),
      )
      .map((exit) => exit.id);
  }

  private openFocus(hotspot: HotspotDefinition, restoreState = false) {
    if (this.isFocused) return;
    this.isFocused = true;
    this.focusedHotspot = hotspot;
    if (!restoreState || !this.cameraBeforeFocus) {
      const camera = this.cameras.main;
      this.cameraBeforeFocus = {
        scrollX: camera.scrollX,
        scrollY: camera.scrollY,
        zoom: camera.zoom,
        centerX: camera.midPoint.x,
        centerY: camera.midPoint.y,
      };
    }

    this.cameras.main.pan(
      hotspot.focus.x,
      hotspot.focus.y,
      FOCUS_DURATION,
      'Sine.easeInOut',
    );
    this.cameras.main.zoomTo(
      hotspot.focus.zoom,
      FOCUS_DURATION,
      'Sine.easeInOut',
    );
    this.time.delayedCall(FOCUS_DURATION, () => {
      this.showFocusPanel(hotspot, this.scale.width, this.scale.height);
    });
  }

  private showFocusPanel(hotspot: HotspotDefinition, w: number, h: number) {
    if (!this.isFocused || !this.uiRoot) return;
    const panelW = Math.min(w - 28, 760);
    const panelH = Math.min(h - 28, 500);
    const panelX = (w - panelW) / 2;
    const panelY = (h - panelH) / 2;
    const titleSize = Phaser.Math.Clamp(Math.min(w * 0.045, h * 0.075), 21, 34);
    const bodySize = Phaser.Math.Clamp(Math.min(w * 0.026, h * 0.045), 14, 20);
    const artW = Math.min(panelW * 0.25, panelH * 0.25, 138);
    const artH = Math.min(panelH * 0.25, artW * 1.08);

    const shade = this.add
      .rectangle(0, 0, w, h, 0x100c08, 0.8)
      .setOrigin(0)
      .setInteractive();
    const card = this.add
      .rectangle(w / 2, h / 2, panelW, panelH, 0x2b2117)
      .setStrokeStyle(2, 0xb18a50);
    const rule = this.add.graphics();
    rule.lineStyle(1, 0xc69b5d, 0.46);
    rule.lineBetween(
      panelX + panelW * 0.12,
      panelY + panelH * 0.18,
      panelX + panelW * 0.88,
      panelY + panelH * 0.18,
    );
    rule.lineBetween(
      panelX + panelW * 0.12,
      panelY + panelH * 0.69,
      panelX + panelW * 0.88,
      panelY + panelH * 0.69,
    );
    const title = this.add
      .text(w / 2, panelY + panelH * 0.1, hotspot.label, {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f1dfbc',
        align: 'center',
        wordWrap: { width: panelW - 40 },
      })
      .setOrigin(0.5);
    const art = this.add.graphics();
    const visual =
      this.room.presentation.objects.find(({ id }) => id === hotspot.id)
        ?.visual ?? 'relief';
    this.drawArtifact(art, visual, artW, artH);
    art.setPosition(w / 2 - artW / 2, panelY + panelH * 0.22);
    const description = this.add
      .text(w / 2, panelY + panelH * 0.56, hotspot.description, {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${bodySize}px`,
        color: '#e1d2b9',
        align: 'center',
        wordWrap: { width: panelW * 0.78 },
        lineSpacing: 5,
      })
      .setOrigin(0.5);

    const buttonW = Math.min(panelW - 36, 300);
    const buttonH = Math.min(68, Math.max(54, panelH * 0.15));
    const buttonY = panelY + panelH * 0.85;
    const back = this.add
      .rectangle(w / 2, buttonY, buttonW, buttonH, 0xc49a5b)
      .setStrokeStyle(2, 0xe7ca92, 0.9)
      .setInteractive({ useHandCursor: true });
    const backLabel = this.add
      .text(w / 2, buttonY, '←  TILL KAMMAREN', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.022, h * 0.034), 14, 17)}px`,
        color: '#21180f',
        fontStyle: 'bold',
        letterSpacing: 0.4,
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    const onBackOver = () => back.setFillStyle(0xe0bb77);
    const onBackOut = () => back.setFillStyle(0xc49a5b);
    back.on('pointerover', onBackOver);
    backLabel.on('pointerover', onBackOver);
    back.on('pointerout', onBackOut);
    backLabel.on('pointerout', onBackOut);
    back.on('pointerdown', () => this.closeFocus());
    backLabel.on('pointerdown', () => this.closeFocus());

    const panel = this.add.container(0, 0, [
      shade,
      card,
      rule,
      title,
      art,
      description,
      back,
      backLabel,
    ]);
    this.focusPanel = panel;
    this.uiRoot.add(panel);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      alpha: 1,
      duration: 170,
      ease: 'Sine.easeOut',
    });
  }

  private closeFocus() {
    if (!this.isFocused) return;
    this.isFocused = false;
    this.focusedHotspot = undefined;
    this.focusPanel?.destroy();
    this.focusPanel = undefined;

    const previous = this.cameraBeforeFocus;
    this.cameraBeforeFocus = undefined;
    if (previous) {
      this.cameras.main.pan(
        previous.centerX,
        previous.centerY,
        RETURN_DURATION,
        'Sine.easeInOut',
      );
      this.cameras.main.zoomTo(
        previous.zoom,
        RETURN_DURATION,
        'Sine.easeInOut',
      );
    }
  }

  private setCameraScroll(scrollX: number, scrollY: number) {
    const clamped = clampCameraScroll(
      scrollX,
      scrollY,
      this.room.worldBounds,
      this.cameras.main.width,
      this.cameras.main.height,
      this.cameras.main.zoom,
    );
    this.cameras.main.setScroll(clamped.x, clamped.y);
    this.updatePanCues();
  }

  private updatePanCues() {
    if (
      !this.panLeftCue ||
      !this.panRightCue ||
      !this.panUpCue ||
      !this.panDownCue
    ) {
      return;
    }
    const availability = getPanAvailability(
      this.cameras.main.scrollX,
      this.cameras.main.scrollY,
      this.room.worldBounds,
      this.cameras.main.width,
      this.cameras.main.height,
      this.cameras.main.zoom,
    );
    this.panLeftCue.setVisible(availability.left);
    this.panRightCue.setVisible(availability.right);
    this.panUpCue.setVisible(availability.up);
    this.panDownCue.setVisible(availability.down);
  }

  private onKeyboard(event: string, handler: () => void) {
    this.input.keyboard?.on(event, handler);
    this.keyboardHandlers.push({ event, handler });
  }

  private handleResize() {
    const data: SceneData = {
      scrollX: this.isFocused
        ? this.cameraBeforeFocus?.scrollX
        : this.cameras.main.scrollX,
      scrollY: this.isFocused
        ? this.cameraBeforeFocus?.scrollY
        : this.cameras.main.scrollY,
      focusedHotspotId: this.focusedHotspot?.id,
      cameraBeforeFocus: this.cameraBeforeFocus,
    };
    this.scene.restart(data);
  }
}
