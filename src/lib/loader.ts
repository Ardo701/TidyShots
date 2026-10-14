/*
 * Reads and decodes photos ahead of the one on screen, so the next card is
 * ready the moment a decision is taken. Object URLs are revoked once a photo
 * falls out of the window around the current position.
 */

import type { Photo } from "./fs";

export type LoadedPhoto =
  | { status: "ready"; url: string; width: number; height: number; file: File }
  | { status: "error" };

type Entry = {
  promise: Promise<LoadedPhoto>;
  result?: LoadedPhoto;
  url?: string;
  /* Holding the decoded <img> keeps Chromium from dropping its bitmap. */
  image?: HTMLImageElement;
  retired: boolean;
};

/* Leaves time for a card flying off screen to finish with its URL. */
const REVOKE_DELAY = 1500;

export class PhotoLoader {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Synchronous view for useSyncExternalStore: stable until it changes. */
  peek = (id: string | undefined): LoadedPhoto | undefined =>
    id === undefined ? undefined : this.entries.get(id)?.result;

  load(photo: Photo): Promise<LoadedPhoto> {
    const existing = this.entries.get(photo.id);
    if (existing) return existing.promise;

    const entry: Entry = { retired: false } as Entry;
    entry.promise = (async (): Promise<LoadedPhoto> => {
      let result: LoadedPhoto;
      try {
        const file = await photo.handle.getFile();
        const url = URL.createObjectURL(file);
        entry.url = url;
        const image = new Image();
        image.decoding = "async";
        image.src = url;
        await image.decode();
        entry.image = image;
        result = {
          status: "ready",
          url,
          width: image.naturalWidth,
          height: image.naturalHeight,
          file,
        };
      } catch {
        result = { status: "error" };
      }
      entry.result = result;
      if (entry.retired) this.release(entry);
      else this.emit();
      return result;
    })();

    this.entries.set(photo.id, entry);
    return entry.promise;
  }

  /** Forgets every photo whose id is not in `keep`. */
  retain(keep: Set<string>) {
    for (const [id, entry] of this.entries) {
      if (keep.has(id)) continue;
      this.entries.delete(id);
      entry.retired = true;
      if (entry.result) this.release(entry);
    }
  }

  dispose() {
    this.retain(new Set());
    this.listeners.clear();
  }

  private release(entry: Entry) {
    const url = entry.url;
    entry.image = undefined;
    if (url) setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY);
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
