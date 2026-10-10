/**
 * The living miniature: the inherited pyramid IS the map. Outer view shows
 * the familiar miniature; the inner view is a cutaway of the same pyramid in
 * which only rooms the player has actually visited appear, connected as a
 * graph projected onto the cross-section (not a literal floor plan). Exits
 * the player has seen show as short stubs; nothing unseen is ever drawn.
 */
import { paintMiniatureCanvas } from '../prologue/miniatureTexture';
import { INSPECT_LIGHT } from '../prologue/panels';
import type { Overlay } from '../prologue/overlay';
import { prefersReducedMotion, progress } from '../prologue/progress';
import { ROOMS, createChapter1Graph, visibleMap } from '../world/pyramidMap';
import type { MapLink, MapRoom, MapView } from '../world/pyramidMap';
import { HALL_TEXT } from './content';

export const MAP_ICON =
  '<svg viewBox="0 0 24 24"><path d="M12 3 21 19H3z"/><path d="M8 14h3v-3h3M12 17h4"/></svg>';

const CW = 176;
const CH = 132;
const APEX = { x: 88, y: 10 };
const BASE_Y = 100;
const HALF = 80;

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const COL = {
  sky: [hex('#0d1022'), hex('#18183a'), hex('#2a2348')],
  sand: hex('#6b5040'),
  sandLit: hex('#8a6a4c'),
  rock: hex('#1a1424'),
  stone: [hex('#2a2234'), hex('#352a3c'), hex('#433444'), hex('#5a4450')],
  rim: hex('#e7b866'),
  seam: hex('#ffd27a'),
  room: hex('#ffc86a'),
  roomCore: hex('#fff0c0'),
  roomDim: hex('#7a5232'),
  link: hex('#f2b452'),
  linkDim: hex('#6a4a30'),
  open: hex('#8fe3d6'),
  closed: hex('#b8452f'),
  current: hex('#ffffff'),
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dither = (x: number, y: number) =>
  (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16;

interface Placed {
  room: MapRoom;
  x: number;
  y: number;
  order: number;
}

/**
 * Projects the visible graph onto the cutaway: BFS from the outside; each
 * step inward goes deeper into the body. Siblings fan out vertically. Room
 * positions are derived from graph structure, never stored per room.
 */
export function layoutMap(view: MapView): {
  placed: Map<string, Placed>;
  order: string[];
} {
  const placed = new Map<string, Placed>();
  const order: string[] = [];
  const has = new Set(view.rooms.map((r) => r.id));
  const start = has.has('exterior') ? 'exterior' : view.rooms[0]?.id;
  if (!start) return { placed, order };
  const queue: Array<{ id: string; depth: number; slot: number }> = [
    { id: start, depth: 0, slot: 0 },
  ];
  const seen = new Set([start]);
  const fallbackDepth = {
    outside: 0,
    passage: 1,
    hall: 2,
    chamber: 3,
  } as const;
  for (;;) {
    if (!queue.length) {
      // A visited room not reachable through visible links (e.g. a skipped
      // scene in review mode) still gets a place, by its kind.
      const loose = view.rooms.find((r) => !seen.has(r.id));
      if (!loose) break;
      seen.add(loose.id);
      queue.push({ id: loose.id, depth: fallbackDepth[loose.kind], slot: 0 });
    }
    const { id, depth, slot } = queue.shift()!;
    const room = view.rooms.find((r) => r.id === id)!;
    // Outside sits on the left slope; then inward and down toward the core.
    // The entrance sits high on the north face; each room further in lies
    // deeper and closer to the core.
    const x = depth === 0 ? 36 : 40 + depth * 24;
    const y = (depth === 0 ? 68 : 70 + depth * 6) + slot * 16;
    placed.set(id, { room, x, y, order: order.length });
    order.push(id);
    const next = view.links
      .filter((l) => (l.from === id || l.to === id) && l.to !== null)
      .map((l) => (l.from === id ? l.to! : l.from))
      .filter((n) => has.has(n) && !seen.has(n));
    next.forEach((n, i) => {
      seen.add(n);
      queue.push({ id: n, depth: depth + 1, slot: i - (next.length - 1) / 2 });
    });
  }
  return { placed, order };
}

class Pix {
  readonly data: ImageData;
  constructor(readonly ctx: CanvasRenderingContext2D) {
    this.data = ctx.createImageData(CW, CH);
  }
  set(x: number, y: number, c: Rgb, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= CW || y >= CH) return;
    const i = (y * CW + x) * 4;
    const d = this.data.data;
    d[i] = Math.round(d[i] * (1 - a) + c[0] * a);
    d[i + 1] = Math.round(d[i + 1] * (1 - a) + c[1] * a);
    d[i + 2] = Math.round(d[i + 2] * (1 - a) + c[2] * a);
    d[i + 3] = 255;
  }
  add(x: number, y: number, c: Rgb, a: number) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= CW || y >= CH) return;
    const i = (y * CW + x) * 4;
    const d = this.data.data;
    d[i] = Math.min(255, d[i] + c[0] * a);
    d[i + 1] = Math.min(255, d[i + 1] + c[1] * a);
    d[i + 2] = Math.min(255, d[i + 2] + c[2] * a);
  }
  glow(cx: number, cy: number, r: number, c: Rgb, s: number) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy) / r;
        if (d >= 1) continue;
        const a = (1 - d) ** 2 * s;
        if (a > dither(x, y) * 0.35) this.add(x, y, c, Math.ceil(a * 6) / 6);
      }
  }
  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Rgb,
    a = 1,
    dash = 0,
  ) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) {
      if (dash && Math.floor(i / dash) % 2) continue;
      this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c, a);
    }
  }
  flush() {
    this.ctx.putImageData(this.data, 0, 0);
  }
}

function inPyramid(x: number, y: number) {
  if (y < APEX.y || y > BASE_Y) return false;
  const w = ((y - APEX.y) / (BASE_Y - APEX.y)) * HALF;
  return Math.abs(x - APEX.x) <= w;
}

/** Draws the cutaway. `reveal` 0..1 stages the awakening (1 = complete). */
export function paintCutaway(
  canvas: HTMLCanvasElement,
  view: MapView,
  opts: { reveal?: number; pulse?: number; awake?: number } = {},
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reveal = opts.reveal ?? 1;
  const pulse = opts.pulse ?? 0;
  const p = new Pix(ctx);
  // Night sky and ground.
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      if (y < BASE_Y) {
        const t = y / BASE_Y;
        const i = Math.min(2, Math.floor(t * 3 + dither(x, y) * 0.9));
        p.set(x, y, COL.sky[i]);
        if ((x * 37 + y * 91) % 211 === 0 && t < 0.6)
          p.set(x, y, hex('#c8b890'));
      } else {
        const t = (y - BASE_Y) / (CH - BASE_Y);
        p.set(
          x,
          y,
          y < BASE_Y + 3
            ? dither(x, y) > 0.5
              ? COL.sandLit
              : COL.sand
            : COL.rock,
        );
        if (t > 0.1 && (x + y * 3) % 17 === 0) p.set(x, y, hex('#241c2c'));
      }
    }
  // Cross-section: courses of stone, darker toward the core.
  for (let y = APEX.y; y <= BASE_Y; y++)
    for (let x = APEX.x - HALF; x <= APEX.x + HALF; x++) {
      if (!inPyramid(x, y)) continue;
      const w = ((y - APEX.y) / (BASE_Y - APEX.y)) * HALF;
      const edge = w - Math.abs(x - APEX.x);
      const core = Math.min(1, edge / 30);
      let t = 2.6 - core * 2.2 + (dither(x, y) - 0.5) * 0.6;
      if ((y - APEX.y) % 6 === 0) t -= 0.8;
      if (
        (((y - APEX.y) / 6) | 0) % 2 === 0
          ? (x + 2) % 9 === 0
          : (x + 6) % 9 === 0
      )
        t -= 0.6;
      p.set(x, y, COL.stone[Math.max(0, Math.min(3, Math.round(t)))]);
      if (edge < 1.2) p.set(x, y, COL.rim, 0.85);
    }
  // Awakening: golden seams light up from the base upward.
  const seamLevel = Math.min(1, reveal * 2.2);
  if (seamLevel > 0)
    for (let y = APEX.y; y <= BASE_Y; y++) {
      if ((y - APEX.y) % 6 !== 0) continue;
      const v = 1 - (y - APEX.y) / (BASE_Y - APEX.y);
      if (v > seamLevel) continue;
      for (let x = APEX.x - HALF; x <= APEX.x + HALF; x++)
        if (inPyramid(x, y) && dither(x, y) < 0.35)
          p.add(x, y, COL.seam, 0.25 * (1 - v * 0.5));
    }

  const { placed, order } = layoutMap(view);
  const visibleCount = Math.floor(
    (Math.max(0, reveal - 0.35) / 0.65) * (order.length + 0.999),
  );
  const shown = (id: string) => {
    const pl = placed.get(id);
    return pl
      ? pl.order < Math.max(visibleCount, reveal >= 1 ? order.length : 0)
      : false;
  };

  // Links between visible rooms, and stubs for seen exits.
  const stubsPer = new Map<string, number>();
  for (const link of view.links) {
    const a = placed.get(link.from);
    if (!a || !shown(link.from)) continue;
    if (link.to && placed.get(link.to) && shown(link.to)) {
      const b = placed.get(link.to)!;
      const c = link.state === 'traversed' ? COL.link : COL.linkDim;
      p.line(a.x, a.y, b.x, b.y, c, 1);
      p.line(a.x, a.y + 1, b.x, b.y + 1, c, 0.5);
      continue;
    }
    drawStub(p, a, link, stubsPer);
  }
  // Rooms.
  for (const id of order) {
    if (!shown(id)) continue;
    const pl = placed.get(id)!;
    const kind = pl.room.kind;
    if (kind === 'outside') {
      p.glow(pl.x, pl.y, 5, COL.room, 0.5);
      p.set(pl.x, pl.y, COL.roomCore);
      continue;
    }
    const w = kind === 'hall' ? 13 : kind === 'passage' ? 5 : 8;
    const h = kind === 'hall' ? 7 : 3;
    for (let y = -h; y <= h; y++)
      for (let x = -w; x <= w; x++) {
        const border = Math.abs(x) === w || Math.abs(y) === h;
        p.set(
          pl.x + x,
          pl.y + y,
          border ? COL.roomDim : COL.room,
          border ? 1 : 0.9,
        );
      }
    // Columns hint inside the hall.
    if (kind === 'hall')
      for (const cx of [-7, -2, 3, 8])
        for (let y = -h + 2; y <= h - 2; y++)
          p.set(pl.x + cx, pl.y + y, COL.roomDim, 0.8);
    p.glow(pl.x, pl.y, w + 6, COL.room, 0.35 + (opts.awake ?? 0) * 0.05);
    if (pl.room.current) {
      const a = 0.6 + Math.sin(pulse * Math.PI * 2) * 0.4;
      for (let x = -w - 2; x <= w + 2; x++) {
        p.set(pl.x + x, pl.y - h - 2, COL.current, a);
        p.set(pl.x + x, pl.y + h + 2, COL.current, a);
      }
      for (let y = -h - 2; y <= h + 2; y++) {
        p.set(pl.x - w - 2, pl.y + y, COL.current, a);
        p.set(pl.x + w + 2, pl.y + y, COL.current, a);
      }
    }
  }
  // Eye at the apex brightens with each awakening step.
  if (reveal >= 1 && (opts.awake ?? 0) >= 3)
    p.glow(
      APEX.x,
      APEX.y + 8,
      12,
      COL.seam,
      0.6 + Math.sin(pulse * Math.PI * 2) * 0.2,
    );
  p.flush();
}

function drawStub(
  p: Pix,
  a: Placed,
  link: MapLink,
  count: Map<string, number>,
) {
  const i = count.get(a.room.id) ?? 0;
  count.set(a.room.id, i + 1);
  const isHall = a.room.kind === 'hall';
  // Hall exits leave from its sides (left/right alternately), others go down.
  const dir = isHall ? (i % 2 === 0 ? -1 : 1) : 1;
  const x0 = a.x + dir * (isHall ? 19 : 7);
  const y0 = a.y + (isHall ? 2 : 0);
  const len = 12;
  const x1 = x0 + dir * len;
  const y1 = y0 + (dir < 0 ? 4 : -4);
  const open = link.state !== 'closed';
  p.line(
    x0,
    y0,
    x1,
    y1,
    open ? COL.open : COL.linkDim,
    open ? 1 : 0.8,
    open ? 0 : 2,
  );
  // Door mark at the room's edge.
  for (let k = -3; k <= 3; k++) {
    p.set(x0, y0 + k, open ? COL.open : COL.closed, 1);
    p.set(x0 + dir, y0 + k, open ? COL.open : COL.closed, 1);
  }
  if (open) p.glow(x1, y1, 5, COL.open, 0.45);
}

/** Opens the miniature with outer/inner views; `awaken` stages the reveal. */
export function openMapPanel(
  overlay: Overlay,
  opts: {
    view?: 'outer' | 'inner';
    awaken?: boolean;
    onClose?: () => void;
  } = {},
) {
  const save = progress.current();
  const awake = save.hall.mapAwake;
  const wrap = document.createElement('div');
  wrap.className = 'hall-map';
  const tabs = document.createElement('div');
  tabs.className = 'pro-row hall-map-tabs';
  wrap.appendChild(tabs);
  const stage = document.createElement('div');
  stage.className = 'hall-map-stage';
  wrap.appendChild(stage);

  const outer = document.createElement('canvas');
  outer.width = 96;
  outer.height = 96;
  outer.className = 'hall-map-outer';
  outer.setAttribute('role', 'img');
  outer.setAttribute('aria-label', 'Miniatyrpyramiden sedd utifrån.');
  const inner = document.createElement('canvas');
  inner.width = CW;
  inner.height = CH;
  inner.className = 'hall-map-inner';
  const scroller = document.createElement('div');
  scroller.className = 'hall-map-scroll';
  scroller.appendChild(inner);
  stage.append(outer, scroller);

  const caption = document.createElement('p');
  caption.className = 'hall-map-caption';
  caption.setAttribute('aria-live', 'polite');
  wrap.appendChild(caption);
  const legend = document.createElement('ul');
  legend.className = 'hall-map-legend';
  wrap.appendChild(legend);

  const graph = createChapter1Graph();
  const mapView = visibleMap(graph, save.world);
  const names = mapView.rooms.map((r) => ROOMS[r.id]?.name ?? r.name);
  inner.setAttribute('role', 'img');
  inner.setAttribute(
    'aria-label',
    `Inre vy av miniatyren. Besökta platser: ${names.join(', ')}. ${
      mapView.links.filter((l) => l.to === null && l.state === 'closed').length
    } stängda portar, ${mapView.links.filter((l) => l.to === null && l.state !== 'closed').length} öppnade portar.`,
  );
  const items: Array<[string, string]> = [
    ['is-room', HALL_TEXT.map.legendRoom],
    ['is-current', HALL_TEXT.map.current],
    ['is-closed', HALL_TEXT.map.legendClosed],
    ['is-open', HALL_TEXT.map.legendOpen],
  ];
  for (const [cls, text] of items) {
    const li = document.createElement('li');
    li.className = cls;
    li.textContent = text;
    legend.appendChild(li);
  }

  const yaw = { v: 200 };
  const drawOuter = () =>
    paintMiniatureCanvas(outer, {
      yaw: yaw.v,
      pitch: 0,
      light: INSPECT_LIGHT,
      scale: 0.34,
      viewTilt: 18,
    });
  let reveal = opts.awaken ? 0 : 1;
  let raf = 0;
  const start = performance.now();
  const reduce = prefersReducedMotion();
  const tick = (now: number) => {
    const t = (now - start) / 1000;
    if (opts.awaken && reveal < 1) {
      reveal = Math.min(1, t / (reduce ? 1.2 : 4.5));
      if (reveal >= 1) caption.textContent = HALL_TEXT.map.awakeningDone;
    }
    paintCutaway(inner, mapView, {
      reveal,
      pulse: reduce ? 0.25 : (t * 0.6) % 1,
      awake,
    });
    if (!outer.hidden && !reduce) {
      yaw.v = (yaw.v + 0.25) % 360;
      drawOuter();
    }
    raf = requestAnimationFrame(tick);
  };

  let mode: 'outer' | 'inner' =
    opts.view === 'outer' || awake === 0 ? 'outer' : 'inner';
  if (opts.awaken) mode = 'inner';
  const outerBtn = overlay.button(
    HALL_TEXT.map.outer,
    () => setMode('outer'),
    'pro-btn pro-btn-quiet',
    tabs,
  );
  const innerBtn = overlay.button(
    HALL_TEXT.map.inner,
    () => setMode('inner'),
    'pro-btn pro-btn-quiet',
    tabs,
  );
  const zoomBtn = overlay.button(
    HALL_TEXT.map.zoomIn,
    () => {
      const z = wrap.classList.toggle('is-zoomed');
      zoomBtn.textContent = z ? HALL_TEXT.map.zoomOut : HALL_TEXT.map.zoomIn;
      if (z) {
        const { placed } = layoutMap(mapView);
        const cur = [...placed.values()].find((p) => p.room.current);
        if (cur)
          requestAnimationFrame(() => {
            scroller.scrollLeft =
              (cur.x / CW) * scroller.scrollWidth - scroller.clientWidth / 2;
            scroller.scrollTop =
              (cur.y / CH) * scroller.scrollHeight - scroller.clientHeight / 2;
          });
      }
    },
    'pro-btn pro-btn-quiet',
    tabs,
  );
  innerBtn.disabled = awake === 0 && !opts.awaken;
  function setMode(m: 'outer' | 'inner') {
    mode = m;
    const show = (el: HTMLElement, on: boolean) => {
      el.hidden = !on;
      el.style.display = on ? '' : 'none';
    };
    show(outer, m === 'outer');
    show(scroller, m === 'inner');
    show(legend, m === 'inner');
    show(zoomBtn, m === 'inner');
    outerBtn.setAttribute('aria-pressed', String(m === 'outer'));
    innerBtn.setAttribute('aria-pressed', String(m === 'inner'));
    caption.textContent =
      m === 'inner'
        ? opts.awaken && reveal < 1
          ? HALL_TEXT.map.awakening
          : HALL_TEXT.map.awakeningDone
        : 'I den lilla pyramiden av mörk sten anar du nu fina, gyllene fogar.';
    if (m === 'outer' && awake === 0)
      caption.textContent = 'Ytan är slät. Vinklarna nästan omöjligt exakta.';
  }
  setMode(mode);
  drawOuter();
  raf = requestAnimationFrame(tick);
  return overlay.panel(HALL_TEXT.map.title, wrap, {
    className: 'pro-panel-map',
    onClose: () => {
      cancelAnimationFrame(raf);
      opts.onClose?.();
    },
  });
}
