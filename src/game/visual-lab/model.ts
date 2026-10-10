export type VisualStyleId = 'classic' | 'hd' | 'illustrated';
export type DoorState = 'closed' | 'opening' | 'open';

export interface RoomArtPack {
  background: string;
  corridor: string;
  frame: string;
  leftLeaf: string;
  rightLeaf: string;
  mechanism: string;
  puzzleBoard: string;
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
    puzzleBoard: `${base}/puzzle-board.png`,
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
    subtitle: 'Lapis, turkos och varm fackelbelysning',
    art: art('hd'),
  },
  {
    id: 'illustrated',
    title: 'Illustrerad',
    subtitle: 'Integrationsläge · godkända illustrationer saknas',
  },
];

export type RingAngles = [number, number, number];
export interface SunSealState {
  angles: RingAngles;
  solved: boolean;
  unlockCount: number;
}

// The relief depicts sunrise in the east, the sun at its highest point, then sunset in the west.
// Ring positions are N=0, E=1, S=2, W=3; the middle ring represents the zenith (N/top).
export const SUN_SEAL_SOLUTION: RingAngles = [1, 0, 3];
export const SUN_SEAL_HINTS = [
  'Titta på reliefen bredvid sigillet. Den visar solen vid tre olika tider på dagen.',
  'Följ solen från där den stiger, via dagens högsta punkt, till där den sjunker. Läs från vänster till höger.',
  'Börja med vänstra skivan: morgonsolen kommer från öster. Vrid den till Ö och jämför sedan mitten med solens högsta position.',
] as const;

export function initialSunSeal(): RingAngles {
  return [0, 2, 1];
}

export function createSunSealState(): SunSealState {
  return { angles: initialSunSeal(), solved: false, unlockCount: 0 };
}

export function rotateRing(angles: RingAngles, index: number): RingAngles {
  if (!Number.isInteger(index) || index < 0 || index >= angles.length)
    return [...angles];
  const next: RingAngles = [...angles];
  next[index] = (next[index] + 1) % 4;
  return next;
}

export function isSunSealSolved(angles: RingAngles) {
  return angles.every((angle, index) => angle === SUN_SEAL_SOLUTION[index]);
}

export function rotateSunSeal(
  state: SunSealState,
  index: number,
): SunSealState {
  if (state.solved) return state;
  const angles = rotateRing(state.angles, index);
  if (!isSunSealSolved(angles)) return { ...state, angles };
  return { angles, solved: true, unlockCount: state.unlockCount + 1 };
}

export function resetSunSeal(): SunSealState {
  return createSunSealState();
}
