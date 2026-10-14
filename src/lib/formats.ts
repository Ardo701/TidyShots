/** Formats every Chromium build can draw in an <img>. */
const VIEWABLE = ["jpg", "jpeg", "jpe", "jfif", "png", "webp", "avif", "gif", "bmp"];

/** Camera raw formats, usually shot next to a JPEG of the same name. */
const RAW = [
  "3fr", "arw", "cr2", "cr3", "crw", "dcr", "dng", "erf", "iiq", "kdc", "mef", "mos",
  "mrw", "nef", "nrw", "orf", "pef", "raf", "raw", "rw2", "rwl", "sr2", "srf", "srw", "x3f",
];

/** Image formats the browser cannot show: counted as skipped when alone. */
const UNVIEWABLE_IMAGES = [...RAW, "heic", "heif", "tif", "tiff", "psd", "jxl"];

/**
 * Files that belong to a photo when they share its name in the same folder:
 * raw negatives, sidecars (XMP, Apple edits, thumbnails), the video half of a
 * Live Photo and HEIC originals of an exported JPEG. A Photoshop file or a
 * text note with the same name is deliberately not on the list.
 */
const COMPANIONS = [...RAW, "xmp", "aae", "thm", "mov", "heic", "heif"];

const viewable = new Set(VIEWABLE);
const unviewable = new Set(UNVIEWABLE_IMAGES);
const companions = new Set(COMPANIONS);

export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { base: name, ext: "" };
  return { base: name.slice(0, dot), ext: name.slice(dot + 1).toLowerCase() };
}

export const isViewable = (ext: string) => viewable.has(ext);
export const isUnviewableImage = (ext: string) => unviewable.has(ext);
export const isCompanion = (ext: string) => companions.has(ext);

/** Ranks the viewable files of a group so a JPEG wins over its PNG export. */
export function viewableRank(ext: string): number {
  const index = VIEWABLE.indexOf(ext);
  return index === -1 ? VIEWABLE.length : index;
}

export function companionKind(ext: string): "raw" | "live" | "sidecar" | "original" {
  if (ext === "mov") return "live";
  if (ext === "xmp" || ext === "aae" || ext === "thm") return "sidecar";
  if (ext === "heic" || ext === "heif") return "original";
  return "raw";
}
