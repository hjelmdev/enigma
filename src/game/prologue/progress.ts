import {
  DEFAULT_SETTINGS,
  createNewSave,
  createSaveStore,
  stageIndex,
} from '../state/prologueSave';
import type {
  PrologueSave,
  PrologueSettings,
  PrologueStage,
  SaveStore,
} from '../state/prologueSave';

/** Runtime holder for the prologue save; scenes mutate it through commit(). */
class Progress {
  store: SaveStore = createSaveStore();
  save: PrologueSave | null = null;
  settings: PrologueSettings = { ...DEFAULT_SETTINGS };
  private loaded?: Promise<void>;

  load() {
    this.loaded ??= (async () => {
      const [save, settings] = await Promise.all([
        this.store.loadSave(),
        this.store.loadSettings(),
      ]);
      this.save = save;
      this.settings = settings;
      applySettings(settings);
    })();
    return this.loaded;
  }

  get hasSave() {
    return this.save !== null;
  }

  current(): PrologueSave {
    this.save ??= createNewSave();
    return this.save;
  }

  startNew() {
    this.save = createNewSave();
    void this.store.writeSave(this.save);
    return this.save;
  }

  commit(mutate: (save: PrologueSave) => void) {
    const save = this.current();
    mutate(save);
    save.updatedAt = Date.now();
    void this.store.writeSave(save);
    return save;
  }

  advanceTo(stage: PrologueStage) {
    this.commit((save) => {
      if (stageIndex(stage) > stageIndex(save.stage)) save.stage = stage;
      if (
        stageIndex(stage) >= stageIndex('artifact') &&
        !save.inventory.includes('miniature')
      )
        save.inventory.push('miniature');
    });
  }

  discover(hotspotId: string) {
    if (this.current().discoveredHotspots.includes(hotspotId)) return;
    this.commit((save) => save.discoveredHotspots.push(hotspotId));
  }

  visitRoom(roomId: string) {
    const w = this.current().world;
    if (w.currentRoom === roomId && w.visitedRooms.includes(roomId)) return;
    this.commit((save) => {
      save.world.currentRoom = roomId;
      if (!save.world.visitedRooms.includes(roomId))
        save.world.visitedRooms.push(roomId);
    });
  }

  seeExit(exitId: string) {
    if (this.current().world.seenExits.includes(exitId)) return;
    this.commit((save) => save.world.seenExits.push(exitId));
  }

  openExit(exitId: string) {
    if (this.current().world.openedExits.includes(exitId)) return;
    this.commit((save) => {
      const w = save.world;
      if (!w.seenExits.includes(exitId)) w.seenExits.push(exitId);
      w.openedExits.push(exitId);
    });
  }

  traverseExit(exitId: string) {
    if (this.current().world.traversedExits.includes(exitId)) return;
    this.commit((save) => {
      const w = save.world;
      if (!w.seenExits.includes(exitId)) w.seenExits.push(exitId);
      if (!w.openedExits.includes(exitId)) w.openedExits.push(exitId);
      w.traversedExits.push(exitId);
    });
  }

  updateSettings(patch: Partial<PrologueSettings>) {
    this.settings = { ...this.settings, ...patch };
    applySettings(this.settings);
    void this.store.writeSettings(this.settings);
  }

  async reset() {
    await this.store.clearSave();
    this.save = null;
  }
}

function applySettings(settings: PrologueSettings) {
  document.documentElement.classList.toggle('large-text', settings.largeText);
  document.documentElement.classList.toggle(
    'reduce-motion',
    settings.reduceMotion,
  );
}

export const progress = new Progress();

export function prefersReducedMotion() {
  return (
    progress.settings.reduceMotion ||
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
}
