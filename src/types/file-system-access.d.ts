// Minimal typings for the parts of the File System Access API we use.
//
// TypeScript's DOM library doesn't declare showDirectoryPicker, and the handle
// types it does ship are incomplete for our purposes. These are deliberately
// narrow — only what the receiver needs to stream a file straight to disk — and
// deliberately named apart from any built-in FileSystem* types so they can
// never collide with a future lib.dom update.
//
// Everything here is optional at the type level, because the API exists only in
// Chromium browsers. Firefox and Safari get the buffered path instead.

interface SffWritableFileStream {
  write(data: BufferSource | Blob | string): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

interface SffFileHandle {
  readonly name: string;
  createWritable(options?: { keepExistingData?: boolean }): Promise<SffWritableFileStream>;
}

interface SffDirectoryHandle {
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<SffFileHandle>;
  queryPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: "read" | "readwrite" }): Promise<PermissionState>;
}

interface Window {
  showDirectoryPicker?(options?: {
    mode?: "read" | "readwrite";
    startIn?: "desktop" | "documents" | "downloads" | "music" | "pictures" | "videos";
    id?: string;
  }): Promise<SffDirectoryHandle>;
}
