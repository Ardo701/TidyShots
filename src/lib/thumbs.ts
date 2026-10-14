/*
 * Small JPEG previews for the review grid, made on demand and a few at a time
 * so a grid of several hundred photos never decodes them all at once.
 */

import type { Photo } from "./fs";

const CONCURRENCY = 3;
const cache = new Map<string, Promise<string | null>>();
const queue: (() => void)[] = [];
let active = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active++;
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          queue.shift()?.();
        });
    };
    if (active < CONCURRENCY) start();
    else queue.push(start);
  });
}

async function render(photo: Photo, size: number): Promise<string | null> {
  const file = await photo.handle.getFile();
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await createImageBitmap(file);
  }
  // Cover crop: the short side fills the square.
  const scale = size / Math.min(bitmap.width, bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.82 });
  return URL.createObjectURL(blob);
}

export function thumbnail(photo: Photo, size = 360): Promise<string | null> {
  let pending = cache.get(photo.id);
  if (!pending) {
    pending = schedule(() => render(photo, size)).catch(() => null);
    cache.set(photo.id, pending);
  }
  return pending;
}

export function clearThumbnails() {
  for (const pending of cache.values()) {
    pending.then((url) => url && URL.revokeObjectURL(url));
  }
  cache.clear();
}
