import Phaser from 'phaser';
import { rooms } from '../world/rooms';
import type { HotspotDefinition, RoomDefinition } from '../world/types';

const TAP_SWIPE_THRESHOLD = 12;
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
  moved: boolean;
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

  constructor() {
    super('chamber');
  }

  create(data: SceneData = {}) {
    const { width: viewWidth, height: viewHeight } = this.scale;
    const { x, y, width, height } = this.room.worldBounds;
    this.isFocused = false;
    this.focusedHotspot = undefined;
    this.cameraBeforeFocus = data.cameraBeforeFocus;
    this.focusPanel?.destroy();
    this.hotspotOutlines.clear();
    this.pointerGesture = undefined;

    this.drawRoom();
    this.createHotspots();

    const camera = this.cameras.main;
    camera.setBounds(x, y, width, height);
    camera.setZoom(1);
    const maxScrollX = Math.max(x, x + width - viewWidth);
    const maxScrollY = Math.max(y, y + height - viewHeight);
    const defaultScrollX = x + (width - viewWidth) / 2;
    const defaultScrollY = y + (height - viewHeight) / 2;
    camera.setScroll(
      Phaser.Math.Clamp(data.scrollX ?? defaultScrollX, x, maxScrollX),
      Phaser.Math.Clamp(data.scrollY ?? defaultScrollY, y, maxScrollY),
    );

    this.createUiLayer(viewWidth, viewHeight);
    this.onKeyboard('keydown-ESC', () => this.closeFocus());
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

  private drawRoom() {
    const { x, y, width, height } = this.room.worldBounds;
    const g = this.add.graphics();
    g.fillGradientStyle(
      this.room.background.top,
      this.room.background.top,
      this.room.background.bottom,
      this.room.background.bottom,
      1,
    );
    g.fillRect(x, y, width, height);

    // The chamber is authored once in world space. The camera reveals a
    // different horizontal slice at the same scale on narrower screens.
    const wallTop = 240;
    const wallBottom = 1050;
    const floorTop = 1050;
    g.fillStyle(0x15110d, 0.45);
    g.fillRect(x, y, width, wallTop);
    g.fillStyle(this.room.background.wall, 1);
    g.fillRect(x + 120, wallTop, width - 240, wallBottom - wallTop);
    g.fillStyle(0x241b13, 1);
    g.fillPoints(
      [
        { x: x + 120, y: floorTop },
        { x: x + width - 120, y: floorTop },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ],
      true,
    );

    // Repeated masonry marks the same broad room without making it a maze.
    g.lineStyle(2, 0x4c3a28, 0.36);
    for (let row = 0; row < 4; row++) {
      const rowY = wallTop + row * 190;
      g.lineBetween(x + 120, rowY, x + width - 120, rowY);
      const offset = row % 2 === 0 ? 0 : 150;
      for (let column = 0; column < 18; column++) {
        const columnX = x + 120 + offset + column * 300;
        if (columnX < x + width - 120) {
          g.lineBetween(columnX, rowY, columnX, rowY + 190);
        }
      }
    }

    // Central shadowed doorway and torch-lit columns are fixed room landmarks.
    const doorX = 1320;
    const doorY = 330;
    const doorW = 360;
    const doorH = 690;
    g.fillStyle(0x21180f, 0.98);
    g.fillRoundedRect(doorX, doorY, doorW, doorH, 150);
    g.fillStyle(0x100d0a, 0.78);
    g.fillRect(doorX + 52, doorY + 300, doorW - 104, doorH - 300);
    for (const columnX of [330, 2570]) {
      g.fillStyle(0x9c7848, 0.88);
      g.fillRoundedRect(columnX, 300, 74, 740, 10);
      g.fillStyle(0xc3a16b, 0.9);
      g.fillRoundedRect(columnX - 18, 290, 110, 32, 6);
      g.fillRoundedRect(columnX - 12, 1010, 98, 38, 6);
      g.fillStyle(0xf4b356, 0.12);
      g.fillCircle(columnX + 37, 540, 185);
    }

    // Long floor seams reinforce the depth of the wide chamber.
    g.lineStyle(2, 0x8a6c48, 0.22);
    for (let i = 1; i <= 8; i++) {
      const lineY = floorTop + i * 68;
      const inset = i * 58;
      g.lineBetween(x + inset, lineY, x + width - inset, lineY);
    }
    for (let i = 0; i <= 12; i++) {
      const floorX = x + i * (width / 12);
      g.lineBetween(width / 2, floorTop, floorX, y + height);
    }

    for (const hotspot of this.room.hotspots) {
      const artifact = this.add.graphics();
      this.drawArtifact(
        artifact,
        hotspot.visual,
        hotspot.area.width,
        hotspot.area.height,
      );
      artifact.setPosition(hotspot.area.x, hotspot.area.y).setDepth(2);
    }
  }

  private drawArtifact(
    graphics: Phaser.GameObjects.Graphics,
    visual: HotspotDefinition['visual'],
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
      const { x, y, width, height } = hotspot.area;
      const outline = this.add.graphics().setDepth(4);
      this.drawOutline(outline, hotspot, false);
      this.hotspotOutlines.set(hotspot.id, outline);

      this.add
        .text(x + width / 2, y + height + 14, hotspot.label, {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '20px',
          color: '#fff0d2',
          fontStyle: '600',
          backgroundColor: '#21180fef',
          padding: { x: 12, y: 8 },
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
      this.add
        .text(x + width / 2, y + height + 57, 'UNDERSÖK', {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '12px',
          color: '#d9b06b',
          letterSpacing: 1,
        })
        .setOrigin(0.5, 0)
        .setDepth(5);
    }
  }

  private drawOutline(
    graphics: Phaser.GameObjects.Graphics,
    hotspot: HotspotDefinition,
    active: boolean,
  ) {
    const { x, y, width, height } = hotspot.area;
    graphics.clear();
    graphics.fillStyle(0xd2a75e, active ? 0.18 : 0.055);
    graphics.lineStyle(
      active ? 4 : 3,
      active ? 0xffd88c : 0xe2c17d,
      active ? 1 : 0.74,
    );
    graphics.fillRoundedRect(x, y, width, height, 24);
    graphics.strokeRoundedRect(x, y, width, height, 24);
    graphics.fillStyle(active ? 0xffd88c : 0xd9b06b, 0.96);
    graphics.fillCircle(x + width / 2, y + 15, 7);
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
    const promptSize = Phaser.Math.Clamp(
      Math.min(w * 0.016, h * 0.026),
      10,
      15,
    );
    const title = this.add
      .text(22, headerH / 2, this.room.title.toLocaleUpperCase('sv-SE'), {
        fontFamily: 'Cinzel, Georgia, serif',
        fontSize: `${titleSize}px`,
        color: '#f0dfbf',
        letterSpacing: 2,
      })
      .setOrigin(0, 0.5);
    const prompt = this.add
      .text(w - 22, headerH / 2, 'TRYCK PÅ ETT MARKERAT FÖREMÅL', {
        fontFamily: 'DM Sans, sans-serif',
        fontSize: `${promptSize}px`,
        color: '#f3dfbb',
        letterSpacing: 0.5,
      })
      .setOrigin(1, 0.5);

    root.add([header, divider, title, prompt]);

    if (this.room.worldBounds.width > w + 24) {
      const footerH = Math.max(42, Math.min(58, h * 0.07));
      this.uiFooterHeight = footerH;
      const footer = this.add.rectangle(
        w / 2,
        h - footerH / 2,
        w,
        footerH,
        0x130f0b,
        0.78,
      );
      const footerRule = this.add.graphics();
      footerRule.lineStyle(1, 0xc39a5c, 0.36);
      footerRule.lineBetween(0, h - footerH, w, h - footerH);
      const instruction = this.add
        .text(w / 2, h - footerH / 2, 'DRA ÅT SIDAN FÖR ATT UTFORSKA RUMMET', {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: `${Phaser.Math.Clamp(Math.min(w * 0.022, h * 0.033), 12, 16)}px`,
          color: '#d7bd91',
          letterSpacing: 1,
        })
        .setOrigin(0.5);
      root.add([footer, footerRule, instruction]);
    } else {
      this.uiFooterHeight = 0;
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    if (
      this.isFocused ||
      !pointer.isDown ||
      pointer.y <= this.uiHeaderHeight ||
      pointer.y >= this.scale.height - this.uiFooterHeight
    ) {
      return;
    }
    this.pointerGesture = {
      id: pointer.id,
      startX: pointer.x,
      startY: pointer.y,
      startScrollX: this.cameras.main.scrollX,
      moved: false,
    };
    this.updateHover(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.pointerGesture || this.pointerGesture.id !== pointer.id) {
      if (!this.isFocused && !pointer.isDown) this.updateHover(pointer);
      return;
    }
    const deltaX = pointer.x - this.pointerGesture.startX;
    const deltaY = pointer.y - this.pointerGesture.startY;
    if (Math.hypot(deltaX, deltaY) >= TAP_SWIPE_THRESHOLD) {
      this.pointerGesture.moved = true;
    }
    if (this.pointerGesture.moved && Math.abs(deltaX) > Math.abs(deltaY)) {
      this.input.setDefaultCursor('grabbing');
      this.setCameraScrollX(
        this.pointerGesture.startScrollX - deltaX / this.cameras.main.zoom,
      );
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const gesture = this.pointerGesture;
    if (!gesture || gesture.id !== pointer.id) return;
    this.pointerGesture = undefined;
    this.input.setDefaultCursor('default');

    if (gesture.moved || this.isFocused) return;
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
      this.openFocus(hotspot);
      return;
    }
    this.tweens.add({
      targets: outline,
      scaleX: 1.035,
      scaleY: 1.035,
      duration: 90,
      yoyo: true,
      onComplete: () => this.openFocus(hotspot),
    });
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
    this.drawArtifact(art, hotspot.visual, artW, artH);
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

  private setCameraScrollX(scrollX: number) {
    const { x, width } = this.room.worldBounds;
    const viewWidth = this.cameras.main.width / this.cameras.main.zoom;
    const maxScrollX = Math.max(x, x + width - viewWidth);
    this.cameras.main.setScroll(Phaser.Math.Clamp(scrollX, x, maxScrollX));
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
