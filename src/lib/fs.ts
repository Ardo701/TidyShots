/*
 * Everything that reads or changes the user's folder. The browser hands us a
 * directory handle (File System Access API); files are read in place and
 * never leave the machine.
 */

import {
  isCompanion,
  isUnviewableImage,
  isViewable,
  splitName,
  viewableRank,
} from "./formats";

export type SortOrder = "name" | "oldest" | "newest";

export type ScanOptions = { recursive: boolean; order: SortOrder };

export type Companion = {
  name: string;
  ext: string;
  handle: FileSystemFileHandle;
  size: number;
};

export type Photo = {
  /** Path relative to the chosen folder, e.g. "2024/IMG_0001.jpg". */
  id: string;
  name: string;
  /** Relative folder, "" for the chosen folder itself. */
  dir: string;
  handle: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
  size: number;
  lastModified: number;
  companions: Companion[];
};

export type ScanProgress = { phase: "listing" | "reading"; found: number; read: number };

export type ScanResult = { photos: Photo[]; skipped: number };

/** Where rejected photos go when they are moved rather than deleted. */
export const REJECT_FOLDER = { fr: "_Rejetées", en: "_Rejected" } as const;

const norm = (name: string) => name.normalize("NFC").toLowerCase();

/* System folders, and our own reject folders so a second pass over the same
   folder never shows the photos already set aside. */
const SKIPPED_DIRS = new Set(
  [
    "$RECYCLE.BIN",
    "System Volume Information",
    "@eaDir",
    REJECT_FOLDER.fr,
    REJECT_FOLDER.en,
  ].map(norm),
);

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
}

/** Asks for read-write access again, e.g. for a folder remembered from a past visit. */
export async function ensureWritable(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const descriptor = { mode: "readwrite" as const };
  if ((await handle.queryPermission(descriptor)) === "granted") return true;
  try {
    return (await handle.requestPermission(descriptor)) === "granted";
  } catch {
    // Asking needs a click or a key press first (SecurityError otherwise).
    return false;
  }
}

type Pending = {
  handle: FileSystemFileHandle;
  parent: FileSystemDirectoryHandle;
  dir: string;
  companions: FileSystemFileHandle[];
};

export async function scanFolder(
  root: FileSystemDirectoryHandle,
  options: ScanOptions,
  onProgress?: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const pending: Pending[] = [];
  let skipped = 0;

  async function walk(dir: FileSystemDirectoryHandle, path: string) {
    const files: FileSystemFileHandle[] = [];
    const subdirs: FileSystemDirectoryHandle[] = [];

    for await (const entry of dir.values()) {
      // Hidden files, including the "._IMG_0001.jpg" doubles macOS leaves on
      // external drives.
      if (entry.name.startsWith(".")) continue;
      if (entry.kind === "file") files.push(entry as FileSystemFileHandle);
      else if (options.recursive && !SKIPPED_DIRS.has(norm(entry.name))) {
        subdirs.push(entry as FileSystemDirectoryHandle);
      }
    }

    // Files sharing a base name travel together: IMG_0001.JPG + .CR2 + .XMP.
    const groups = new Map<string, { handle: FileSystemFileHandle; ext: string }[]>();
    for (const handle of files) {
      const { base, ext } = splitName(handle.name);
      const key = norm(base);
      const group = groups.get(key);
      if (group) group.push({ handle, ext });
      else groups.set(key, [{ handle, ext }]);
    }

    for (const group of groups.values()) {
      const viewables = group
        .filter((file) => isViewable(file.ext))
        .sort((a, b) => viewableRank(a.ext) - viewableRank(b.ext));
      if (viewables.length === 0) {
        skipped += group.filter((file) => isUnviewableImage(file.ext)).length;
        continue;
      }
      const extras = group
        .filter((file) => !isViewable(file.ext) && isCompanion(file.ext))
        .map((file) => file.handle);
      viewables.forEach((file, index) => {
        pending.push({
          handle: file.handle,
          parent: dir,
          dir: path,
          companions: index === 0 ? extras : [],
        });
      });
    }

    onProgress?.({ phase: "listing", found: pending.length, read: 0 });

    subdirs.sort((a, b) => collator.compare(a.name, b.name));
    for (const sub of subdirs) await walk(sub, path ? `${path}/${sub.name}` : sub.name);
  }

  await walk(root, "");

  let read = 0;
  const photos = await mapLimit(pending, 24, async (item): Promise<Photo | null> => {
    try {
      const file = await item.handle.getFile();
      const companions = await Promise.all(
        item.companions.map(async (handle) => {
          const size = await handle
            .getFile()
            .then((f) => f.size)
            .catch(() => 0);
          return { name: handle.name, ext: splitName(handle.name).ext, handle, size };
        }),
      );
      return {
        id: item.dir ? `${item.dir}/${item.handle.name}` : item.handle.name,
        name: item.handle.name,
        dir: item.dir,
        handle: item.handle,
        parent: item.parent,
        size: file.size,
        lastModified: file.lastModified,
        companions,
      };
    } catch {
      // Unreadable (locked, vanished, permission): leave it out.
      return null;
    } finally {
      read++;
      if (read % 25 === 0 || read === pending.length) {
        onProgress?.({ phase: "reading", found: pending.length, read });
      }
    }
  });

  const result = photos.filter((photo): photo is Photo => photo !== null);
  result.sort(comparator(options.order));
  return { photos: result, skipped };
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function byPath(a: Photo, b: Photo) {
  // Files of the chosen folder first, then each subfolder in turn.
  if (a.dir !== b.dir) {
    if (a.dir === "") return -1;
    if (b.dir === "") return 1;
    return collator.compare(a.dir, b.dir);
  }
  return collator.compare(a.name, b.name);
}

export function comparator(order: SortOrder) {
  if (order === "name") return byPath;
  const sign = order === "oldest" ? 1 : -1;
  return (a: Photo, b: Photo) => sign * (a.lastModified - b.lastModified) || byPath(a, b);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/* ------------------------------------------------------------------------ */
/* Applying the decisions                                                    */
/* ------------------------------------------------------------------------ */

export type ApplyMode = "move" | "delete";

export type FailureReason = "changed" | "missing" | "locked" | "other";

export type ApplyFailure = { id: string; name: string; reason: FailureReason; message: string };

export type ApplyResult = {
  mode: ApplyMode;
  photos: number;
  files: number;
  bytes: number;
  failures: ApplyFailure[];
};

export async function applyRejections(
  root: FileSystemDirectoryHandle,
  photos: Photo[],
  options: { mode: ApplyMode; withCompanions: boolean; folderName: string },
  onProgress?: (done: number, photo: Photo, ok: boolean) => void,
): Promise<ApplyResult> {
  const result: ApplyResult = {
    mode: options.mode,
    photos: 0,
    files: 0,
    bytes: 0,
    failures: [],
  };
  const folders = new Map<string, FileSystemDirectoryHandle>();

  async function destination(dir: string) {
    let handle = folders.get(dir);
    if (handle) return handle;
    handle = await root.getDirectoryHandle(options.folderName, { create: true });
    for (const part of dir ? dir.split("/") : []) {
      handle = await handle.getDirectoryHandle(part, { create: true });
    }
    folders.set(dir, handle);
    return handle;
  }

  for (const [index, photo] of photos.entries()) {
    let ok = false;
    try {
      // A photo edited since the folder was opened is not the one that was
      // judged: leave it alone.
      const current = await photo.handle.getFile();
      if (current.lastModified !== photo.lastModified || current.size !== photo.size) {
        throw Object.assign(new Error("Modified since the folder was opened"), {
          name: "ChangedError",
        });
      }

      const files = [
        { name: photo.name, handle: photo.handle, size: photo.size },
        ...(options.withCompanions ? photo.companions : []),
      ];
      const target = options.mode === "move" ? await destination(photo.dir) : null;

      for (const [position, file] of files.entries()) {
        try {
          if (target) await moveFile(file.handle, photo.parent, target);
          else await photo.parent.removeEntry(file.name);
          result.files++;
          result.bytes += file.size;
        } catch (error) {
          // The photo itself failed: report it. A missing companion only
          // costs its own file.
          if (position === 0) throw error;
        }
      }
      result.photos++;
      ok = true;
    } catch (error) {
      result.failures.push({
        id: photo.id,
        name: photo.id,
        reason: failureReason(error),
        message: error instanceof Error ? error.message : String(error),
      });
    }
    onProgress?.(index + 1, photo, ok);
  }

  return result;
}

function failureReason(error: unknown): FailureReason {
  const name = error instanceof Error ? error.name : "";
  if (name === "ChangedError") return "changed";
  if (name === "NotFoundError") return "missing";
  if (name === "NoModificationAllowedError" || name === "InvalidStateError") return "locked";
  return "other";
}

async function exists(dir: FileSystemDirectoryHandle, name: string) {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "NotFoundError") return false;
    // A folder with that name, or anything else: treat the name as taken.
    return true;
  }
}

/** "IMG_0001.jpg" → "IMG_0001 (2).jpg" when the first one is taken. */
export async function freeName(dir: FileSystemDirectoryHandle, name: string) {
  if (!(await exists(dir, name))) return name;
  const { base, ext } = splitName(name);
  const suffix = ext ? name.slice(name.length - ext.length - 1) : "";
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base} (${n})${suffix}`;
    if (!(await exists(dir, candidate))) return candidate;
  }
  throw new Error(`No free name for ${name}`);
}

async function moveFile(
  handle: FileSystemFileHandle,
  parent: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
) {
  const name = await freeName(target, handle.name);

  // A real move keeps the file's dates; not every Chromium can do it outside
  // the private file system.
  if (typeof handle.move === "function") {
    try {
      await handle.move(target, name);
      return;
    } catch {
      // Fall back to copy then delete.
    }
  }

  const file = await handle.getFile();
  const copy = await target.getFileHandle(name, { create: true });
  const writable = await copy.createWritable();
  try {
    await writable.write(file);
    await writable.close();
  } catch (error) {
    await writable.abort().catch(() => {});
    await target.removeEntry(name).catch(() => {});
    throw error;
  }
  try {
    await parent.removeEntry(handle.name);
  } catch (error) {
    // Never leave the photo in two places.
    await target.removeEntry(name).catch(() => {});
    throw error;
  }
}
