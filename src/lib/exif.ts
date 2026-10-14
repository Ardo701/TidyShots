/*
 * The few EXIF fields worth showing while judging a photo. Parsed with the
 * "lite" build of exifr, which reads only the start of the file.
 */

import exifr from "exifr/dist/lite.esm.mjs";

export type PhotoMeta = {
  taken?: Date;
  camera?: string;
  aperture?: number;
  exposure?: number;
  iso?: number;
  focal?: number;
};

const TAGS = ["DateTimeOriginal", "Make", "Model", "FNumber", "ExposureTime", "ISO", "FocalLength"];

const cache = new Map<string, Promise<PhotoMeta | null>>();

type Raw = {
  DateTimeOriginal?: Date;
  Make?: string;
  Model?: string;
  FNumber?: number;
  ExposureTime?: number;
  ISO?: number;
  FocalLength?: number;
};

function cameraName(make?: string, model?: string) {
  if (!model) return make?.trim();
  const cleanMake = make?.trim() ?? "";
  // "Canon" + "Canon EOS R6" → "Canon EOS R6"; "Apple" + "iPhone 15" → "iPhone 15".
  if (!cleanMake || model.toLowerCase().startsWith(cleanMake.toLowerCase().split(" ")[0])) {
    return model.trim();
  }
  if (cleanMake.toLowerCase() === "apple") return model.trim();
  return `${cleanMake} ${model.trim()}`;
}

export function readMeta(id: string, file: File): Promise<PhotoMeta | null> {
  let pending = cache.get(id);
  if (!pending) {
    pending = (exifr.parse(file, { pick: TAGS }) as Promise<Raw | undefined>)
      .then((raw) => {
        if (!raw) return null;
        const taken = raw.DateTimeOriginal instanceof Date ? raw.DateTimeOriginal : undefined;
        return {
          taken: taken && !Number.isNaN(taken.getTime()) ? taken : undefined,
          camera: cameraName(raw.Make, raw.Model),
          aperture: raw.FNumber,
          exposure: raw.ExposureTime,
          iso: raw.ISO,
          focal: raw.FocalLength,
        };
      })
      .catch(() => null);
    cache.set(id, pending);
    // A long session should not keep every parsed header forever.
    if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  }
  return pending;
}
