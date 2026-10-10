import {
  createState,
  deserialize,
  serialize,
  type SerializedSunSeal,
  type SunSealState,
} from './puzzle/sunSeal.ts';

/**
 * Persistence for the Sealed Sun experiment only. Kept in localStorage under
 * its own versioned key so it never touches the main adventure's session.
 * Anything malformed or from another version starts fresh.
 */
const KEY = 'enigma.experiment.sealed-sun';
const VERSION = 1;

export interface SealedSunProgress {
  seal: SunSealState;
  doorOpen: boolean;
  steleSeen: boolean;
  hintsShown: number;
}

interface SaveV1 {
  version: 1;
  seal: SerializedSunSeal;
  doorOpen: boolean;
  steleSeen: boolean;
  hintsShown: number;
}

export function freshProgress(): SealedSunProgress {
  return {
    seal: createState(),
    doorOpen: false,
    steleSeen: false,
    hintsShown: 0,
  };
}

export function parseProgress(raw: string | null): SealedSunProgress {
  if (!raw) return freshProgress();
  try {
    const data = JSON.parse(raw) as Partial<SaveV1>;
    if (data.version !== VERSION) return freshProgress();
    const seal = deserialize(data.seal);
    return {
      seal,
      // An open door without a solved seal is a stale or edited save.
      doorOpen: data.doorOpen === true && seal.solved,
      steleSeen: data.steleSeen === true,
      hintsShown: Number.isInteger(data.hintsShown)
        ? Math.max(0, Math.min(3, data.hintsShown as number))
        : 0,
    };
  } catch {
    return freshProgress();
  }
}

export function stringifyProgress(p: SealedSunProgress) {
  const save: SaveV1 = {
    version: VERSION,
    seal: serialize(p.seal),
    doorOpen: p.doorOpen,
    steleSeen: p.steleSeen,
    hintsShown: p.hintsShown,
  };
  return JSON.stringify(save);
}

export function loadProgress(): SealedSunProgress {
  try {
    return parseProgress(globalThis.localStorage?.getItem(KEY) ?? null);
  } catch {
    return freshProgress();
  }
}

export function saveProgress(p: SealedSunProgress) {
  try {
    globalThis.localStorage?.setItem(KEY, stringifyProgress(p));
  } catch {
    // Private mode or storage disabled: progress lasts for this page only.
  }
}

export function clearProgress() {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    // ignore
  }
}
