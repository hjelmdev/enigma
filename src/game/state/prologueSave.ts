export const PROLOGUE_SAVE_VERSION = 2;

export const PROLOGUE_STAGES = [
  'attic',
  'artifact',
  'note',
  'travel',
  'exterior',
  'chapter1-gate',
  'corridor',
  'hall',
] as const;

export type PrologueStage = (typeof PROLOGUE_STAGES)[number];

export type WeightKind = 'scarab' | 'falcon' | 'lotus';
const WEIGHT_KINDS: readonly WeightKind[] = ['scarab', 'falcon', 'lotus'];
const MAX_WEIGHT_COUNT = 20;

export interface HallSave {
  arrived: boolean; // arrival sequence in the hall has played
  mapAwake: number; // 0 dormant, 1 awakened, 2 reacted to first solve, 3 both
  relief: { cells: number[]; movesLeft: number; solved: boolean } | null;
  balance: {
    seed: number;
    attempt: number;
    placed: Record<WeightKind, number>;
    solved: boolean;
  } | null;
  doorsAnimated: string[]; // exit ids whose opening animation already played
  camX: number | null; // last hall camera center (art px)
}

export interface WorldSave {
  currentRoom: string;
  visitedRooms: string[];
  seenExits: string[];
  openedExits: string[];
  traversedExits: string[];
}

export interface PrologueSave {
  version: 2;
  stage: PrologueStage;
  introSeen: boolean; // intro watched fully once (allows skipping later)
  inventory: string[]; // item ids, e.g. 'miniature'; unique, strings only
  sunEyeSolved: boolean;
  entranceOpened: boolean;
  revealPlayed: boolean;
  hintLevel: number; // integer 0..3
  discoveredHotspots: string[]; // unique strings
  updatedAt: number; // ms epoch
  hall: HallSave;
  world: WorldSave;
}

export interface PrologueSettings {
  reduceMotion: boolean;
  largeText: boolean;
}

export const DEFAULT_SETTINGS: PrologueSettings = {
  reduceMotion: false,
  largeText: false,
};

const MINIATURE_ID = 'miniature';
const MAX_HINT_LEVEL = 3;
const DB_NAME = 'enigma';
const DB_STORE = 'kv';
const SAVE_KEY = 'prologue-save';
const SETTINGS_KEY = 'settings';
const LOCAL_STORAGE_KEYS: Record<StorageKey, string> = {
  'prologue-save': 'enigma:prologue-save',
  settings: 'enigma:settings',
};

type StorageKey = 'prologue-save' | 'settings';

export function createNewSave(now: number = Date.now()): PrologueSave {
  return {
    version: PROLOGUE_SAVE_VERSION,
    stage: 'attic',
    introSeen: false,
    inventory: [],
    sunEyeSolved: false,
    entranceOpened: false,
    revealPlayed: false,
    hintLevel: 0,
    discoveredHotspots: [],
    updatedAt: now,
    hall: {
      arrived: false,
      mapAwake: 0,
      relief: null,
      balance: null,
      doorsAnimated: [],
      camX: null,
    },
    world: {
      currentRoom: 'exterior',
      visitedRooms: ['exterior'],
      seenExits: [],
      openedExits: [],
      traversedExits: [],
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStage(value: unknown): value is PrologueStage {
  return (
    typeof value === 'string' &&
    (PROLOGUE_STAGES as readonly string[]).includes(value)
  );
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function uniqueStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry === 'string') seen.add(entry);
  }
  return [...seen];
}

function clampHintLevel(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(MAX_HINT_LEVEL, Math.max(0, Math.trunc(value)));
}

function nonNegInt(value: unknown, fallback: number, max = Infinity): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function sanitizeHall(raw: unknown): HallSave {
  const hall = createNewSave(0).hall;
  if (!isRecord(raw)) return hall;
  hall.arrived = boolOr(raw.arrived, false);
  hall.mapAwake = nonNegInt(raw.mapAwake, 0, 3);
  hall.doorsAnimated = uniqueStrings(raw.doorsAnimated);
  hall.camX =
    typeof raw.camX === 'number' && Number.isFinite(raw.camX) ? raw.camX : null;

  if (isRecord(raw.relief) && Array.isArray(raw.relief.cells)) {
    hall.relief = {
      cells: raw.relief.cells
        .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
        .map((c) => Math.trunc(c)),
      movesLeft: nonNegInt(raw.relief.movesLeft, 0),
      solved: boolOr(raw.relief.solved, false),
    };
  }

  if (isRecord(raw.balance)) {
    const placedRaw = isRecord(raw.balance.placed) ? raw.balance.placed : {};
    const placed: Record<WeightKind, number> = {
      scarab: 0,
      falcon: 0,
      lotus: 0,
    };
    for (const kind of WEIGHT_KINDS)
      placed[kind] = nonNegInt(placedRaw[kind], 0, MAX_WEIGHT_COUNT);
    hall.balance = {
      seed: Math.trunc(
        typeof raw.balance.seed === 'number' &&
          Number.isFinite(raw.balance.seed)
          ? raw.balance.seed
          : 0,
      ),
      attempt: nonNegInt(raw.balance.attempt, 0),
      placed,
      solved: boolOr(raw.balance.solved, false),
    };
  }
  return hall;
}

function sanitizeWorld(raw: unknown, entranceOpened: boolean): WorldSave {
  const rec = isRecord(raw) ? raw : {};
  const seen = new Set(uniqueStrings(rec.seenExits));
  const opened = new Set(uniqueStrings(rec.openedExits));
  const traversed = new Set(uniqueStrings(rec.traversedExits));
  if (entranceOpened) opened.add('exterior-entrance');
  for (const id of traversed) opened.add(id);
  for (const id of opened) seen.add(id);
  const visited = new Set(uniqueStrings(rec.visitedRooms));
  const currentRoom =
    typeof rec.currentRoom === 'string' && rec.currentRoom !== ''
      ? rec.currentRoom
      : 'exterior';
  visited.add(currentRoom);
  return {
    currentRoom,
    visitedRooms: [...visited],
    seenExits: [...seen],
    openedExits: [...opened],
    traversedExits: [...traversed],
  };
}

export function sanitizeSave(raw: unknown): PrologueSave | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== 1 && raw.version !== 2) return null;
  if (!isStage(raw.stage)) return null;

  const defaults = createNewSave(0);
  const save: PrologueSave = {
    version: PROLOGUE_SAVE_VERSION,
    stage: raw.stage,
    introSeen: boolOr(raw.introSeen, defaults.introSeen),
    inventory: uniqueStrings(raw.inventory),
    sunEyeSolved: boolOr(raw.sunEyeSolved, defaults.sunEyeSolved),
    entranceOpened: boolOr(raw.entranceOpened, defaults.entranceOpened),
    revealPlayed: boolOr(raw.revealPlayed, defaults.revealPlayed),
    hintLevel: clampHintLevel(raw.hintLevel),
    discoveredHotspots: uniqueStrings(raw.discoveredHotspots),
    updatedAt:
      typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)
        ? raw.updatedAt
        : 0,
    hall: sanitizeHall(raw.hall),
    world: defaults.world,
  };

  // Consistency invariants.
  if (save.revealPlayed) save.entranceOpened = true;
  if (save.entranceOpened) save.sunEyeSolved = true;
  if (stageIndex(save.stage) >= stageIndex('artifact') || save.sunEyeSolved) {
    if (!save.inventory.includes(MINIATURE_ID))
      save.inventory.push(MINIATURE_ID);
  }

  save.world = sanitizeWorld(raw.world, save.entranceOpened);
  return save;
}

export function sanitizeSettings(raw: unknown): PrologueSettings {
  if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
  return {
    reduceMotion: boolOr(raw.reduceMotion, DEFAULT_SETTINGS.reduceMotion),
    largeText: boolOr(raw.largeText, DEFAULT_SETTINGS.largeText),
  };
}

export function serializeSave(save: PrologueSave): string {
  return JSON.stringify(save);
}

export function deserializeSave(
  text: string | null | undefined,
): PrologueSave | null {
  if (typeof text !== 'string') return null;
  try {
    return sanitizeSave(JSON.parse(text));
  } catch {
    return null;
  }
}

function deserializeSettings(
  text: string | null | undefined,
): PrologueSettings {
  if (typeof text !== 'string') return { ...DEFAULT_SETTINGS };
  try {
    return sanitizeSettings(JSON.parse(text));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function stageIndex(stage: PrologueStage): number {
  return PROLOGUE_STAGES.indexOf(stage);
}

export interface SaveStore {
  loadSave(): Promise<PrologueSave | null>;
  writeSave(save: PrologueSave): Promise<void>;
  clearSave(): Promise<void>;
  loadSettings(): Promise<PrologueSettings>;
  writeSettings(settings: PrologueSettings): Promise<void>;
}

// Low-level string key/value backend. Values are serialized strings.
interface KvBackend {
  get(key: StorageKey): Promise<string | null>;
  set(key: StorageKey, value: string): Promise<void>;
  remove(key: StorageKey): Promise<void>;
}

function createMemoryBackend(): KvBackend {
  const values = new Map<StorageKey, string>();
  return {
    async get(key) {
      return values.get(key) ?? null;
    },
    async set(key, value) {
      values.set(key, value);
    },
    async remove(key) {
      values.delete(key);
    },
  };
}

function createStoreFromBackend(backend: Promise<KvBackend>): SaveStore {
  async function run<T>(
    label: string,
    fallback: T,
    operation: (kv: KvBackend) => Promise<T>,
  ): Promise<T> {
    try {
      return await operation(await backend);
    } catch (error) {
      console.warn(`[prologueSave] ${label} failed`, error);
      return fallback;
    }
  }

  return {
    loadSave: () =>
      run('loadSave', null, async (kv) =>
        deserializeSave(await kv.get(SAVE_KEY)),
      ),
    writeSave: (save) =>
      run('writeSave', undefined, (kv) =>
        kv.set(SAVE_KEY, serializeSave(save)),
      ),
    clearSave: () => run('clearSave', undefined, (kv) => kv.remove(SAVE_KEY)),
    loadSettings: () =>
      run('loadSettings', { ...DEFAULT_SETTINGS }, async (kv) =>
        deserializeSettings(await kv.get(SETTINGS_KEY)),
      ),
    writeSettings: (settings) =>
      run('writeSettings', undefined, (kv) =>
        kv.set(SETTINGS_KEY, JSON.stringify(sanitizeSettings(settings))),
      ),
  };
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE))
        db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function createIndexedDbBackend(): Promise<KvBackend> {
  const db = await openIndexedDb();
  const store = (mode: IDBTransactionMode) =>
    db.transaction(DB_STORE, mode).objectStore(DB_STORE);
  return {
    async get(key) {
      const value = await requestToPromise(store('readonly').get(key));
      return typeof value === 'string' ? value : null;
    },
    async set(key, value) {
      await requestToPromise(store('readwrite').put(value, key));
    },
    async remove(key) {
      await requestToPromise(store('readwrite').delete(key));
    },
  };
}

function createLocalStorageBackend(): KvBackend | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probeKey = 'enigma:storage-probe';
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return {
      async get(key) {
        return localStorage.getItem(LOCAL_STORAGE_KEYS[key]);
      },
      async set(key, value) {
        localStorage.setItem(LOCAL_STORAGE_KEYS[key], value);
      },
      async remove(key) {
        localStorage.removeItem(LOCAL_STORAGE_KEYS[key]);
      },
    };
  } catch {
    return null;
  }
}

async function resolveBackend(): Promise<KvBackend> {
  if (typeof indexedDB !== 'undefined') {
    try {
      return await createIndexedDbBackend();
    } catch (error) {
      console.warn(
        '[prologueSave] IndexedDB unavailable, trying localStorage',
        error,
      );
    }
  }
  return createLocalStorageBackend() ?? createMemoryBackend();
}

export function createMemoryStore(): SaveStore {
  return createStoreFromBackend(Promise.resolve(createMemoryBackend()));
}

export function createSaveStore(): SaveStore {
  return createStoreFromBackend(resolveBackend());
}
