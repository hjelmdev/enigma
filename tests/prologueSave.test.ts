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

describe('prologue save defaults', () => {
  it('creates a fresh attic save with empty progress', () => {
    const save = createNewSave(1234);
    expect(save).toEqual({
      version: 1,
      stage: 'attic',
      introSeen: false,
      inventory: [],
      sunEyeSolved: false,
      entranceOpened: false,
      revealPlayed: false,
      hintLevel: 0,
      discoveredHotspots: [],
      updatedAt: 1234,
    });
    expect(PROLOGUE_SAVE_VERSION).toBe(1);
  });

  it('orders stages so later stages have higher indexes', () => {
    expect(stageIndex('attic')).toBe(0);
    expect(stageIndex('artifact')).toBe(1);
    expect(stageIndex('chapter1-gate')).toBe(5);
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

  it('rejects wrong or missing versions', () => {
    const base = createNewSave(1);
    expect(sanitizeSave({ ...base, version: 2 })).toBeNull();
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
      version: 1,
      stage: 'travel',
      introSeen: false,
      inventory: ['miniature'],
      sunEyeSolved: false,
      entranceOpened: false,
      revealPlayed: false,
      hintLevel: 0,
      discoveredHotspots: [],
      updatedAt: 0,
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
