import { initialize, restore, type HorizonState } from './model';

// Isolated experiment store; no adventure or other experiment keys are touched.
export class HorizonSave {
  private db?: IDBDatabase;
  private latest = initialize();
  async load(): Promise<HorizonState> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('enigma-hidden-horizon', 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore('progress');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      this.latest = await new Promise<HorizonState>((resolve, reject) => {
        const request = this.db!.transaction('progress')
          .objectStore('progress')
          .get('chamber');
        request.onsuccess = () => resolve(restore(request.result));
        request.onerror = () => reject(request.error);
      });
    } catch {
      /* Private browsing/storage failure retains in-memory progress. */
    }
    return this.latest;
  }
  save(state: HorizonState): Promise<boolean> {
    this.latest = restore(state);
    if (!this.db) return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction('progress', 'readwrite');
        tx.objectStore('progress').put(this.latest, 'chamber');
        tx.oncomplete = () => resolve(true);
        tx.onerror = tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  }
  close() {
    this.db?.close();
  }
}
