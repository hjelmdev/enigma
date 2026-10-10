export type Alignment = [number, number, number];
export interface HorizonState {
  version: 1;
  markers: Alignment;
  solved: boolean;
}

// Heights above the horizon, read from the three relief constellations.
export const TARGET: Alignment = [2, 4, 1];
export const INITIAL: Alignment = [0, 1, 3];
export const MARKERS = ['Vassen', 'Falken', 'Båten'] as const;
export const HINTS = [
  'Reliefens stjärnor och reglagen bär samma tecken. Var börjar himlen?',
  'Den långa linjen är horisonten. Räkna uppåt från den, inte från stenens kant.',
  'Vassens stjärna står två steg över horisonten. Läs de andra på samma sätt.',
];

export function initialize(): HorizonState {
  return { version: 1, markers: [...INITIAL], solved: false };
}

export function isAligned(markers: Alignment): boolean {
  return markers.every((height, index) => height === TARGET[index]);
}

export function moveMarker(
  state: HorizonState,
  index: number,
  delta: number,
): HorizonState {
  if (
    state.solved ||
    !Number.isInteger(index) ||
    index < 0 ||
    index > 2 ||
    ![-1, 1].includes(delta)
  )
    return state;
  const markers: Alignment = [...state.markers];
  markers[index] = Math.max(0, Math.min(4, markers[index] + delta));
  return { ...state, markers };
}

export function activate(state: HorizonState): HorizonState {
  return isAligned(state.markers) ? { ...state, solved: true } : state;
}

export function restore(value: unknown): HorizonState {
  if (typeof value !== 'object' || value === null) return initialize();
  const candidate = value as Partial<HorizonState>;
  if (
    candidate.version !== 1 ||
    typeof candidate.solved !== 'boolean' ||
    !Array.isArray(candidate.markers) ||
    candidate.markers.length !== 3 ||
    !candidate.markers.every((n) => Number.isInteger(n) && n >= 0 && n <= 4)
  )
    return initialize();
  const markers = [...candidate.markers] as Alignment;
  // A corrupt save cannot open a gate with a mismatched mechanism.
  return {
    version: 1,
    markers,
    solved: candidate.solved && isAligned(markers),
  };
}

export function serialize(state: HorizonState): string {
  return JSON.stringify(restore(state));
}

export function deserialize(raw: string | null): HorizonState {
  try {
    return restore(raw ? JSON.parse(raw) : null);
  } catch {
    return initialize();
  }
}
