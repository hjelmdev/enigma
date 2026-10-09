export type VisualStyleId = 'classic' | 'hd' | 'illustrated';
export type DoorState = 'closed' | 'opening' | 'open';

export interface RoomArtPack {
  background: string;
  corridor: string;
  frame: string;
  leftLeaf: string;
  rightLeaf: string;
  mechanism: string;
  ring: string;
  clue: string;
  vessel: string;
}

export interface RoomGeometry {
  width: number;
  height: number;
  door: { x: number; y: number; leafOffset: number };
  rings: readonly { x: number; y: number }[];
  clue: { x: number; y: number };
  vessel: { x: number; y: number };
}

export const SEALED_SUN_ROOM: RoomGeometry = {
  width: 960,
  height: 480,
  door: { x: 480, y: 315, leafOffset: 220 },
  rings: [
    { x: 315, y: 330 },
    { x: 345, y: 330 },
    { x: 375, y: 330 },
  ],
  clue: { x: 235, y: 288 },
  vessel: { x: 738, y: 320 },
};

const art = (style: 'classic' | 'hd'): RoomArtPack => {
  const base = `assets/visual-lab/${style}`;
  return {
    background: `${base}/background.png`,
    corridor: `${base}/corridor.png`,
    frame: `${base}/door-frame.png`,
    leftLeaf: `${base}/door-left.png`,
    rightLeaf: `${base}/door-right.png`,
    mechanism: `${base}/mechanism.png`,
    ring: `${base}/sun-ring.png`,
    clue: `${base}/clue-relief.png`,
    vessel: `${base}/vessel.png`,
  };
};

export const VISUAL_STYLES: ReadonlyArray<{
  id: VisualStyleId;
  title: string;
  subtitle: string;
  art?: RoomArtPack;
}> = [
  {
    id: 'classic',
    title: 'Klassisk Pixel Art',
    subtitle: 'Begränsad palett · tydliga 16-bitars former',
    art: art('classic'),
  },
  {
    id: 'hd',
    title: 'HD Pixel Art',
    subtitle: 'Tätare stenstruktur · varm fackelbelysning',
    art: art('hd'),
  },
  {
    id: 'illustrated',
    title: 'Illustrerad',
    subtitle: 'Integrationsläge · godkända illustrationer saknas',
  },
];

export type RingAngles = [number, number, number];
export const SUN_SEAL_SOLUTION: RingAngles = [1, 2, 3];

export function rotateRing(angles: RingAngles, index: number): RingAngles {
  if (!Number.isInteger(index) || index < 0 || index >= angles.length) {
    return [...angles];
  }
  const next: RingAngles = [...angles];
  next[index] = (next[index] + 1) % 4;
  return next;
}

export function isSunSealSolved(angles: RingAngles) {
  return angles.every((angle, index) => angle === SUN_SEAL_SOLUTION[index]);
}

export function initialSunSeal(): RingAngles {
  return [0, 0, 0];
}
