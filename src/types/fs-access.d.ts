/*
 * Parts of the File System Access API that Chromium ships but TypeScript's DOM
 * library does not describe yet (it only knows the Origin Private File System
 * subset). https://wicg.github.io/file-system-access/
 */

type FileSystemPermissionMode = "read" | "readwrite";

interface FileSystemHandlePermissionDescriptor {
  mode?: FileSystemPermissionMode;
}

interface FileSystemHandle {
  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState>;
}

interface FileSystemFileHandle {
  /** Chromium only, and not on every platform or file system. */
  move?(destination: FileSystemDirectoryHandle, newName?: string): Promise<void>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: FileSystemPermissionMode;
  startIn?: FileSystemHandle | "desktop" | "documents" | "downloads" | "pictures";
}

interface Window {
  showDirectoryPicker?(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>;
}
