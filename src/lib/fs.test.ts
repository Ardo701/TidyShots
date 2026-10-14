import { describe, expect, it } from "vitest";
import { applyRejections, freeName, scanFolder } from "./fs";

/* A minimal in-memory stand-in for the File System Access API: enough of
   FileSystemDirectoryHandle and FileSystemFileHandle for scanning and moving. */

type Tree = { [name: string]: Tree | string };

class MemoryFile {
  readonly kind = "file";
  constructor(
    public name: string,
    public content: string,
    public lastModified = 1_700_000_000_000,
  ) {}
  async getFile() {
    return new File([this.content], this.name, { lastModified: this.lastModified });
  }
  async createWritable() {
    let written = "";
    return {
      write: async (data: Blob | string) => {
        written = typeof data === "string" ? data : await data.text();
      },
      close: async () => {
        this.content = written;
      },
      abort: async () => {},
    };
  }
}

class MemoryDirectory {
  readonly kind = "directory";
  entries = new Map<string, MemoryDirectory | MemoryFile>();
  constructor(public name: string, tree: Tree = {}) {
    for (const [key, value] of Object.entries(tree)) {
      this.entries.set(
        key,
        typeof value === "string" ? new MemoryFile(key, value) : new MemoryDirectory(key, value),
      );
    }
  }
  async *values() {
    yield* this.entries.values();
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryFile) return entry;
    if (entry) throw Object.assign(new Error("Is a directory"), { name: "TypeMismatchError" });
    if (!options?.create) throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    const file = new MemoryFile(name, "");
    this.entries.set(name, file);
    return file;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const entry = this.entries.get(name);
    if (entry instanceof MemoryDirectory) return entry;
    if (entry) throw Object.assign(new Error("Is a file"), { name: "TypeMismatchError" });
    if (!options?.create) throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    const directory = new MemoryDirectory(name);
    this.entries.set(name, directory);
    return directory;
  }
  async removeEntry(name: string) {
    if (!this.entries.delete(name)) {
      throw Object.assign(new Error("Not found"), { name: "NotFoundError" });
    }
  }
  names() {
    return [...this.entries.keys()].sort();
  }
}

const asHandle = (directory: MemoryDirectory) => directory as unknown as FileSystemDirectoryHandle;

describe("scanFolder", () => {
  it("keeps viewable photos, attaches companions and counts unviewable ones", async () => {
    const root = new MemoryDirectory("root", {
      "IMG_2.JPG": "x",
      "IMG_2.CR2": "raw",
      "IMG_2.xmp": "side",
      "IMG_10.jpg": "x",
      "IMG_3.HEIC": "heic",
      "IMG_4.jpg": "x",
      "IMG_4.MOV": "live",
      "notes.txt": "hello",
      "._IMG_2.JPG": "apple double",
      sub: { "deep.png": "x" },
    });
    const { photos, skipped } = await scanFolder(asHandle(root), { recursive: false, order: "name" });
    expect(photos.map((photo) => photo.id)).toEqual(["IMG_2.JPG", "IMG_4.jpg", "IMG_10.jpg"]);
    expect(photos[0].companions.map((c) => c.name).sort()).toEqual(["IMG_2.CR2", "IMG_2.xmp"]);
    expect(photos[1].companions.map((c) => c.name)).toEqual(["IMG_4.MOV"]);
    expect(skipped).toBe(1);
  });

  it("walks subfolders but never the reject folder", async () => {
    const root = new MemoryDirectory("root", {
      "a.jpg": "x",
      "2024": { "b.jpg": "x", jan: { "c.webp": "x" } },
      _Rejetées: { "old.jpg": "x" },
    });
    const { photos } = await scanFolder(asHandle(root), { recursive: true, order: "name" });
    expect(photos.map((photo) => photo.id)).toEqual(["a.jpg", "2024/b.jpg", "2024/jan/c.webp"]);
  });
});

describe("freeName", () => {
  it("adds a counter when the name is taken", async () => {
    const dir = new MemoryDirectory("d", { "a.jpg": "1", "a (2).jpg": "2" });
    expect(await freeName(asHandle(dir), "b.jpg")).toBe("b.jpg");
    expect(await freeName(asHandle(dir), "a.jpg")).toBe("a (3).jpg");
  });
});

describe("applyRejections", () => {
  it("moves photos and their companions, mirroring subfolders, without overwriting", async () => {
    const root = new MemoryDirectory("root", {
      "a.jpg": "photo a",
      "a.cr2": "raw a",
      "keep.jpg": "keep",
      trip: { "b.jpg": "photo b" },
      _Rejetées: { "a.jpg": "older a" },
    });
    const { photos } = await scanFolder(asHandle(root), { recursive: true, order: "name" });
    const rejected = photos.filter((photo) => photo.name !== "keep.jpg");
    const result = await applyRejections(asHandle(root), rejected, {
      mode: "move",
      withCompanions: true,
      folderName: "_Rejetées",
    });

    expect(result).toMatchObject({ photos: 2, files: 3, failures: [] });
    expect(root.names()).toEqual(["_Rejetées", "keep.jpg", "trip"]);
    const rejects = root.entries.get("_Rejetées") as MemoryDirectory;
    expect(rejects.names()).toEqual(["a (2).jpg", "a.cr2", "a.jpg", "trip"]);
    expect((rejects.entries.get("a (2).jpg") as MemoryFile).content).toBe("photo a");
    expect((rejects.entries.get("a.jpg") as MemoryFile).content).toBe("older a");
    expect((root.entries.get("trip") as MemoryDirectory).names()).toEqual([]);
  });

  it("deletes, and leaves alone a photo modified since the scan", async () => {
    const root = new MemoryDirectory("root", { "a.jpg": "a", "b.jpg": "b" });
    const { photos } = await scanFolder(asHandle(root), { recursive: false, order: "name" });
    (root.entries.get("b.jpg") as MemoryFile).lastModified += 1000;
    const result = await applyRejections(asHandle(root), photos, {
      mode: "delete",
      withCompanions: true,
      folderName: "_Rejetées",
    });
    expect(result.photos).toBe(1);
    expect(result.failures).toMatchObject([{ id: "b.jpg", reason: "changed" }]);
    expect(root.names()).toEqual(["b.jpg"]);
  });
});
