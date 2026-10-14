/*
 * Sessions are kept in IndexedDB, in this browser only. Directory handles can
 * be stored there as-is, so a folder can be reopened later after the browser
 * asks for permission again.
 */

import type { ScanOptions } from "./fs";
import type { Decision } from "./session";

export type StoredSession = {
  key: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  options: ScanOptions;
  decisions: Record<string, Decision>;
  currentId: string | null;
  total: number;
  decided: number;
  rejected: number;
  updatedAt: number;
};

const DB_NAME = "tidyshots";
const STORE = "sessions";
const MAX_SESSIONS = 6;

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function listSessions(): Promise<StoredSession[]> {
  try {
    const all = await run<StoredSession[]>("readonly", (store) => store.getAll());
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    // Private windows and locked-down profiles: no history, no harm.
    return [];
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  try {
    await run("readwrite", (store) => store.put(session));
    const all = await listSessions();
    for (const old of all.slice(MAX_SESSIONS)) await deleteSession(old.key);
  } catch {
    // Same as above: the session simply is not remembered.
  }
}

export async function deleteSession(key: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(key));
  } catch {
    // Nothing stored, nothing to forget.
  }
}

/** The stored session for this exact folder, if it was opened before. */
export async function findSession(
  handle: FileSystemDirectoryHandle,
): Promise<StoredSession | null> {
  for (const session of await listSessions()) {
    try {
      if (await session.handle.isSameEntry(handle)) return session;
    } catch {
      // A handle to a folder that no longer exists.
    }
  }
  return null;
}

export function newSessionKey() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
