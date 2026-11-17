/**
 * Keeps each project's source video in this browser (IndexedDB), so it never has to be uploaded.
 * Storage can be unavailable (private mode, full disk): every call fails soft and the UI asks
 * the user to pick the file again.
 */
const DB = 'storyit-clips';
const STORE = 'sources';
const memory = new Map<string, File>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const sourceStore = {
  async put(projectId: string, file: File) {
    memory.set(projectId, file);
    try { await tx('readwrite', (s) => s.put(file, projectId)); } catch { /* memory only */ }
  },
  async get(projectId: string): Promise<File | null> {
    const hit = memory.get(projectId);
    if (hit) return hit;
    try {
      const file = await tx<File | undefined>('readonly', (s) => s.get(projectId));
      if (file) memory.set(projectId, file);
      return file ?? null;
    } catch { return null; }
  },
  async remove(projectId: string) {
    memory.delete(projectId);
    try { await tx('readwrite', (s) => s.delete(projectId)); } catch { /* ignore */ }
  },
};
