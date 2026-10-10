import { RGB, type Material } from './palette';
export type Point = [number, number];

export function hash(x: number, y: number, seed = 71): number {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + seed, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export class Raster {
  readonly pixels: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.pixels = new Uint8ClampedArray(width * height * 4);
  }
  pixel(x: number, y: number, material: Material, shade: number, alpha = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const rgb = RGB[material][Math.max(0, Math.min(7, Math.round(shade)))];
    const i = (y * this.width + x) * 4;
    this.pixels[i] = rgb[0];
    this.pixels[i + 1] = rgb[1];
    this.pixels[i + 2] = rgb[2];
    this.pixels[i + 3] = alpha;
  }
  rect(x: number, y: number, w: number, h: number, m: Material, shade: number) {
    for (let yy = Math.round(y); yy < y + h; yy++)
      for (let xx = Math.round(x); xx < x + w; xx++)
        this.pixel(xx, yy, m, shade);
  }
  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    m: Material,
    s: number,
    width = 1,
  ) {
    const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
    for (let i = 0; i <= steps; i++)
      this.rect(
        x0 + ((x1 - x0) * i) / Math.max(steps, 1),
        y0 + ((y1 - y0) * i) / Math.max(steps, 1),
        width,
        width,
        m,
        s,
      );
  }
  poly(points: Point[], material: Material, shade: number) {
    const top = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1]))));
    const bottom = Math.min(
      this.height - 1,
      Math.ceil(Math.max(...points.map((p) => p[1]))),
    );
    for (let y = top; y <= bottom; y++) {
      const intersections: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
          intersections.push(
            a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]),
          );
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2)
        this.rect(
          Math.ceil(intersections[i]),
          y,
          intersections[i + 1] - Math.ceil(intersections[i]),
          1,
          material,
          shade,
        );
    }
  }
  shadow(points: Point[], strength = 0.5) {
    const mask = new Raster(this.width, this.height);
    mask.poly(points, 'basalt', 0);
    for (let i = 0; i < this.pixels.length; i += 4)
      if (mask.pixels[i + 3]) {
        this.pixels[i] = this.pixels[i] * (1 - strength) + 13 * strength;
        this.pixels[i + 1] =
          this.pixels[i + 1] * (1 - strength) + 24 * strength;
        this.pixels[i + 2] =
          this.pixels[i + 2] * (1 - strength) + 42 * strength;
      }
  }
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    m: Material,
    s: number,
  ) {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1)
          this.pixel(x, y, m, s);
  }
  star(x: number, y: number, size = 5, m: Material = 'bronze', shade = 6) {
    this.poly(
      [
        [x, y - size],
        [x + 2, y - 2],
        [x + size, y],
        [x + 2, y + 2],
        [x, y + size],
        [x - 2, y + 2],
        [x - size, y],
        [x - 2, y - 2],
      ],
      m,
      shade,
    );
    this.pixel(x, y, m, 7);
  }
  canvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = this.width;
    canvas.height = this.height;
    canvas
      .getContext('2d')!
      .putImageData(
        new ImageData(
          new Uint8ClampedArray(this.pixels),
          this.width,
          this.height,
        ),
        0,
        0,
      );
    return canvas;
  }
}
