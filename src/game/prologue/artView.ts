import type Phaser from 'phaser';
import { coverZoom } from './assets';

/**
 * Camera framing for authored pixel-art scenes. The art keeps its scale:
 * zoom covers the viewport (never squashes or letterboxes), and the visible
 * window pans inside the art bounds. Portrait shows a narrower window of the
 * same scene instead of shrinking it.
 */
export class ArtView {
  zoom = 1;
  centerX: number;
  centerY: number;

  constructor(
    private scene: Phaser.Scene,
    readonly artW: number,
    readonly artH: number,
    focus: { x: number; y: number },
    private zoomBoost = 1,
  ) {
    this.centerX = focus.x;
    this.centerY = focus.y;
  }

  get camera() {
    return this.scene.cameras.main;
  }

  get viewW() {
    return this.scene.scale.width;
  }

  get viewH() {
    return this.scene.scale.height;
  }

  get halfW() {
    return this.viewW / this.zoom / 2;
  }

  get halfH() {
    return this.viewH / this.zoom / 2;
  }

  setZoomBoost(boost: number) {
    this.zoomBoost = boost;
    this.layout();
  }

  layout() {
    this.zoom =
      coverZoom(this.viewW, this.viewH, this.artW, this.artH) * this.zoomBoost;
    this.camera.setZoom(this.zoom);
    this.setCenter(this.centerX, this.centerY);
  }

  clampCenter(x: number, y: number) {
    return {
      x: Math.max(this.halfW, Math.min(this.artW - this.halfW, x)),
      y: Math.max(this.halfH, Math.min(this.artH - this.halfH, y)),
    };
  }

  setCenter(x: number, y: number) {
    const c = this.clampCenter(x, y);
    this.centerX = c.x;
    this.centerY = c.y;
    this.camera.centerOn(c.x, c.y);
  }

  panByScreen(dx: number, dy: number) {
    this.setCenter(
      this.centerX - dx / this.zoom,
      this.centerY - dy / this.zoom,
    );
  }

  canPan() {
    return {
      left: this.centerX > this.halfW + 0.5,
      right: this.centerX < this.artW - this.halfW - 0.5,
    };
  }

  worldToScreen(x: number, y: number) {
    return {
      x: (x - (this.centerX - this.halfW)) * this.zoom,
      y: (y - (this.centerY - this.halfH)) * this.zoom,
    };
  }

  screenToWorld(x: number, y: number) {
    return {
      x: this.centerX - this.halfW + x / this.zoom,
      y: this.centerY - this.halfH + y / this.zoom,
    };
  }

  isVisible(x: number, y: number, margin = 0) {
    return (
      Math.abs(x - this.centerX) <= this.halfW - margin &&
      Math.abs(y - this.centerY) <= this.halfH - margin
    );
  }

  /** Offset for a background layer that should move at `factor` speed. */
  parallaxOffset(factor: number) {
    return Math.round((this.centerX - this.artW / 2) * (1 - factor));
  }
}
