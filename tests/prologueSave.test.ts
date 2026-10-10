import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  PROLOGUE_SAVE_VERSION,
  createMemoryStore,
  createNewSave,
  createSaveStore,
  deserializeSave,
  sanitizeSave,
  sanitizeSettings,
  serializeSave,
  stageIndex,
} from '../src/game/state/prologueSave';

const DEFAULT_HALL = createNewSave(0).hall;
const DEFAULT_STARS = createNewSave(0).stars;
const DEFAULT_WORLD = createNewSave(0).world;

describe('prologue save defaults', () => {
  it('creates a fresh attic save with empty progress', () => {
    const save = createNewSave(1234);
    expect(save).toEqual({
      version: 4,
      stage: 'attic',
      difficulty: 'normal',
      introSeen: false,
      inventory: [],
      sunEyeSolved: false,
      entranceOpened: false,
      revealPlayed: false,
      hintLevel: 0,
      discoveredHotspots: [],
      updatedAt: 1234,
      hall: { ...DEFAULT_HALL, reliefSeed: save.hall.reliefSeed },
      stars: DEFAULT_STARS,
      world: DEFAULT_WORLD,
    });
    expect(PROLOGUE_SAVE_VERSION).toBe(4);
  });

  it('orders stages so later stages have higher indexes', () => {
    expect(stageIndex('attic')).toBe(0);
    expect(stageIndex('artifact')).toBe(1);
    expect(stageIndex('chapter1-gate')).toBe(5);
    expect(stageIndex('hall')).toBe(7);
  });

  it('assigns a fresh relief seed to each genuinely new save', () => {
    expect(createNewSave().hall.reliefSeed).not.toBe(
      createNewSave().hall.reliefSeed,
    );
  });
});

describe('prologue save serialization', () => {
  it('round-trips a save through serialize and deserialize', () => {
    const save = {
      ...createNewSave(42),
      stage: 'note' as const,
      introSeen: true,
      inventory: ['miniature', 'key'],
      sunEyeSolved: true,
      hintLevel: 2,
      discoveredHotspots: ['window', 'desk'],
    };
    expect(deserializeSave(serializeSave(save))).toEqual(save);
  });

  it('persists each selected difficulty and defaults fresh saves to Normal', () => {
    expect(createNewSave(1).difficulty).toBe('normal');
    for (const difficulty of ['easy', 'normal', 'hard'] as const) {
      const save = createNewSave(42, difficulty);
      expect(deserializeSave(serializeSave(save))?.difficulty).toBe(difficulty);
    }
  });

  it('persists per-puzzle difficulty snapshots without changing the save version', () => {
    const save = createNewSave(42, 'hard');
    save.hall.relief = {
      difficulty: 'easy',
      seed: 12,
      initialCells: [0, 1, 2, 3, 4, 5, 6, 7, -1],
      cells: [0, 1, 2, 3, 4, 5, 6, 7, -1],
      movesLeft: 14,
      solved: false,
    };
    save.hall.balance = {
      difficulty: 'normal',
      seed: 13,
      attempt: 2,
      placed: { scarab: 1, falcon: 0, lotus: 0 },
      solved: false,
    };
    expect(deserializeSave(serializeSave(save))).toEqual(save);
    expect(PROLOGUE_SAVE_VERSION).toBe(4);
  });

  it('rejects wrong or missing versions', () => {
    const base = createNewSave(1);
    expect(sanitizeSave({ ...base, version: 5 })).toBeNull();
    expect(sanitizeSave({ ...base, version: '1' })).toBeNull();
    const withoutVersion: Partial<typeof base> = { ...base };
    delete withoutVersion.version;
    expect(sanitizeSave(withoutVersion)).toBeNull();
  });

  it('rejects unknown stages', () => {
    expect(sanitizeSave({ ...createNewSave(1), stage: 'basement' })).toBeNull();
    expect(sanitizeSave({ ...createNewSave(1), stage: undefined })).toBeNull();
  });

  it('rejects non-objects', () => {
    expect(sanitizeSave(null)).toBeNull();
    expect(sanitizeSave('save')).toBeNull();
    expect(sanitizeSave([1, 2])).toBeNull();
  });

  it('returns null for garbage JSON, null, or undefined without throwing', () => {
    expect(deserializeSave('{not json')).toBeNull();
    expect(deserializeSave('')).toBeNull();
    expect(deserializeSave(null)).toBeNull();
    expect(deserializeSave(undefined)).toBeNull();
    expect(deserializeSave('"just a string"')).toBeNull();
  });
});

describe('prologue save field fallbacks', () => {
  it('falls back to defaults for missing or invalid fields', () => {
    const save = sanitizeSave({
      version: 1,
      stage: 'travel',
      introSeen: 'yes',
      sunEyeSolved: 1,
      inventory: 'miniature',
      discoveredHotspots: null,
      updatedAt: 'later',
    });
    expect(save).toEqual({
      version: 4,
      stage: 'travel',
      difficulty: 'easy',
      introSeen: false,
      inventory: ['miniature'],
      sunEyeSolved: false,
      entranceOpened: false,
      revealPlayed: false,
      hintLevel: 0,
      discoveredHotspots: [],
      updatedAt: 0,
      hall: { ...DEFAULT_HALL, reliefSeed: 0 },
      stars: DEFAULT_STARS,
      world: DEFAULT_WORLD,
    });
  });

  it('filters arrays to unique strings', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      stage: 'note',
      inventory: ['miniature', 'miniature', 42, null, 'lamp'],
      discoveredHotspots: ['window', 'window', {}, 'desk'],
    });
    expect(save?.inventory).toEqual(['miniature', 'lamp']);
    expect(save?.discoveredHotspots).toEqual(['window', 'desk']);
  });

  it('replaces non-finite updatedAt with 0', () => {
    expect(
      sanitizeSave({ ...createNewSave(1), updatedAt: NaN })?.updatedAt,
    ).toBe(0);
    expect(
      sanitizeSave({ ...createNewSave(1), updatedAt: Infinity })?.updatedAt,
    ).toBe(0);
  });
});

describe('prologue save hint clamping', () => {
  it('clamps hintLevel to integers 0..3', () => {
    const withHint = (hintLevel: unknown) =>
      sanitizeSave({ ...createNewSave(1), hintLevel })?.hintLevel;
    expect(withHint(-4)).toBe(0);
    expect(withHint(9)).toBe(3);
    expect(withHint(2.7)).toBe(2);
    expect(withHint('2')).toBe(0);
    expect(withHint(NaN)).toBe(0);
  });
});

describe('prologue save invariant repair', () => {
  it('marks the sun eye solved when the entrance is opened', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      stage: 'artifact',
      entranceOpened: true,
      sunEyeSolved: false,
      inventory: ['miniature'],
    });
    expect(save?.sunEyeSolved).toBe(true);
    expect(save?.entranceOpened).toBe(true);
  });

  it('opens the entrance and solves the sun eye when reveal was played', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      stage: 'exterior',
      revealPlayed: true,
      inventory: ['miniature'],
    });
    expect(save?.entranceOpened).toBe(true);
    expect(save?.sunEyeSolved).toBe(true);
  });

  it('re-adds the miniature when the sun eye is solved', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      stage: 'attic',
      sunEyeSolved: true,
      inventory: ['lamp'],
    });
    expect(save?.inventory).toEqual(['lamp', 'miniature']);
  });

  it('re-adds the miniature from stage artifact onwards', () => {
    const save = sanitizeSave({ ...createNewSave(1), stage: 'note' });
    expect(save?.inventory).toEqual(['miniature']);
  });

  it('keeps the miniature in the attic when nothing is solved', () => {
    const save = sanitizeSave({ ...createNewSave(1), stage: 'attic' });
    expect(save?.inventory).toEqual([]);
  });

  it('never removes the miniature', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      stage: 'attic',
      inventory: ['miniature', 'lamp'],
    });
    expect(save?.inventory).toEqual(['miniature', 'lamp']);
  });
});

describe('prologue settings sanitizing', () => {
  it('defaults both flags to false', () => {
    expect(DEFAULT_SETTINGS).toEqual({ reduceMotion: false, largeText: false });
  });

  it('returns defaults for non-object input', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('large')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid booleans and defaults invalid fields individually', () => {
    expect(sanitizeSettings({ reduceMotion: true, largeText: 'yes' })).toEqual({
      reduceMotion: true,
      largeText: false,
    });
    expect(sanitizeSettings({ reduceMotion: 0, largeText: true })).toEqual({
      reduceMotion: false,
      largeText: true,
    });
  });
});

describe('prologue memory store', () => {
  it('round-trips a save and clears it', async () => {
    const store = createMemoryStore();
    expect(await store.loadSave()).toBeNull();

    const save = {
      ...createNewSave(7),
      stage: 'artifact' as const,
      inventory: ['miniature'],
    };
    await store.writeSave(save);
    expect(await store.loadSave()).toEqual(save);

    await store.clearSave();
    expect(await store.loadSave()).toBeNull();
  });

  it('round-trips settings and defaults when empty', async () => {
    const store = createMemoryStore();
    expect(await store.loadSettings()).toEqual(DEFAULT_SETTINGS);

    await store.writeSettings({ reduceMotion: true, largeText: true });
    expect(await store.loadSettings()).toEqual({
      reduceMotion: true,
      largeText: true,
    });
  });
});

describe('prologue createSaveStore in node', () => {
  it('works as a round-trip store without indexedDB', async () => {
    const store = createSaveStore();
    await store.clearSave();
    expect(await store.loadSave()).toBeNull();

    const save = { ...createNewSave(9), introSeen: true };
    await store.writeSave(save);
    expect(await store.loadSave()).toEqual(save);

    await store.writeSettings({ reduceMotion: false, largeText: true });
    expect(await store.loadSettings()).toEqual({
      reduceMotion: false,
      largeText: true,
    });

    await store.clearSave();
    expect(await store.loadSave()).toBeNull();
  });
});

describe('prologue save migrations and nested sanitizing', () => {
  const v1 = () => {
    const { hall: _h, world: _w, ...rest } = createNewSave(5);
    void _h;
    void _w;
    return { ...rest, version: 1, stage: 'exterior' };
  };

  it('migrates v1 saves to easy and keeps the original puzzle experience', () => {
    const save = sanitizeSave({ ...v1(), introSeen: true, hintLevel: 2 });
    expect(save?.version).toBe(4);
    expect(save?.difficulty).toBe('easy');
    expect(save?.introSeen).toBe(true);
    expect(save?.hintLevel).toBe(2);
    expect(save?.hall).toEqual({ ...DEFAULT_HALL, reliefSeed: 0 });
    expect(save?.world).toEqual(DEFAULT_WORLD);
  });

  it('migrates v2 without a difficulty while retaining its seeded puzzle data', () => {
    const old = {
      ...createNewSave(12, 'hard'),
      version: 2,
      difficulty: undefined,
      hall: {
        ...createNewSave(12).hall,
        reliefSeed: 321,
        relief: {
          seed: 321,
          initialCells: [0, -1, 4, 3, 2, 1, 6, 7, 5],
          cells: [0, -1, 4, 3, 2, 1, 6, 7, 5],
          movesLeft: 8,
          solved: false,
        },
      },
    };
    const migrated = sanitizeSave(old);
    expect(migrated?.difficulty).toBe('easy');
    expect(migrated?.hall.relief?.seed).toBe(321);
    expect(migrated?.hall.relief?.initialCells).toEqual([
      0, -1, 4, 3, 2, 1, 6, 7, 5,
    ]);
    expect(migrated?.hall.relief?.movesLeft).toBe(8);
  });

  it('migrates an opened v1 entrance into world exits', () => {
    const save = sanitizeSave({ ...v1(), entranceOpened: true });
    expect(save?.world.seenExits).toContain('exterior-entrance');
    expect(save?.world.openedExits).toContain('exterior-entrance');
  });

  it('rejects unknown versions', () => {
    expect(sanitizeSave({ ...v1(), version: 0 })).toBeNull();
    expect(sanitizeSave({ ...v1(), version: 5 })).toBeNull();
  });

  it('round-trips a populated v4 save', () => {
    const save = {
      ...createNewSave(3),
      stage: 'hall' as const,
      inventory: ['miniature'],
      hall: {
        arrived: true,
        mapAwake: 2,
        reliefSeed: 707,
        relief: { cells: [0, 1, 2], movesLeft: 4, solved: false },
        balance: {
          seed: 7,
          attempt: 1,
          placed: { scarab: 2, falcon: 0, lotus: 1 },
          solved: false,
        },
        doorsAnimated: ['hall-relief-door'],
        camX: 120.5,
      },
      world: {
        currentRoom: 'entrance-hall',
        visitedRooms: ['exterior', 'entrance-passage', 'entrance-hall'],
        seenExits: ['exterior-entrance', 'passage-hall', 'hall-relief-door'],
        openedExits: ['exterior-entrance', 'passage-hall'],
        traversedExits: ['exterior-entrance', 'passage-hall'],
      },
    };
    expect(deserializeSave(serializeSave(save))).toEqual(save);
  });

  it('sanitizes nested hall fields defensively', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      hall: {
        arrived: 'yes',
        mapAwake: 9,
        relief: { cells: [1, 'x', NaN, 2.9], movesLeft: -3, solved: 1 },
        balance: {
          seed: 'a',
          attempt: -2,
          placed: { scarab: 99, falcon: -1, lotus: 2.7, junk: 5 },
          solved: true,
        },
        doorsAnimated: ['a', 'a', 4],
        camX: Infinity,
      },
    });
    expect(save?.hall).toEqual({
      arrived: false,
      mapAwake: 3,
      reliefSeed: 0,
      relief: { cells: [1, 2], movesLeft: 0, solved: false },
      balance: {
        seed: 0,
        attempt: 0,
        placed: { scarab: 20, falcon: 0, lotus: 2 },
        solved: true,
      },
      doorsAnimated: ['a'],
      camX: null,
    });
  });

  it('enforces world invariants', () => {
    const save = sanitizeSave({
      ...createNewSave(1),
      world: {
        currentRoom: 'entrance-hall',
        visitedRooms: ['exterior', 7],
        seenExits: [],
        openedExits: ['a'],
        traversedExits: ['b'],
      },
    });
    const w = save?.world;
    expect(w?.visitedRooms).toContain('entrance-hall');
    expect(w?.openedExits).toEqual(expect.arrayContaining(['a', 'b']));
    expect(w?.seenExits).toEqual(expect.arrayContaining(['a', 'b']));
    expect(w?.traversedExits).toEqual(['b']);
  });
});
