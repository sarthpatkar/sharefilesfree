/// <reference lib="webworker" />
//
// Assembles received files on disk, off the main thread.
//
// Why this exists at all
// ----------------------
// The receiver used to hold every chunk of a file in the page's memory and
// build a Blob at the end. That put a hard ceiling on "any size" — the ceiling
// being whatever RAM the browser would hand one tab — and it did the assembly
// on the main thread, in the same event loop that has to drain the data
// channel. Measured on a loopback connection, a receiver doing no assembly ran
// roughly three times faster than one building Blobs. So the memory limit and
// the slowness were the same problem wearing two hats.
//
// The Origin Private File System solves both. It is a real file on disk that
// only this origin can see, and createSyncAccessHandle gives the fastest write
// path any browser offers — but it is worker-only, which is exactly what we
// want: the main thread's entire job becomes "hand the bytes over", and the
// buffers are transferred rather than copied.
//
// Supported in Chrome 86+, Firefox 111+ and Safari 15.2+, so unlike the folder
// picker this covers phones too. The caller falls back to in-memory assembly
// only where none of this exists.

interface OpenMessage {
  type: "open";
  id: string;
  name: string;
  /** Declared size, checked against what actually lands — see the close branch. */
  size: number;
}
interface WriteMessage {
  type: "write";
  id: string;
  buffer: ArrayBuffer;
}
interface CloseMessage {
  type: "close";
  id: string;
  mime: string;
}
interface DiscardMessage {
  type: "discard";
  id: string;
}
type Incoming = OpenMessage | WriteMessage | CloseMessage | DiscardMessage;

interface SyncAccessHandle {
  write(buffer: BufferSource, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

interface OpfsFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandle>;
  getFile(): Promise<File>;
}

interface OpfsDirHandle {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
}

import { createSerialQueue } from "./serialQueue";

const scope = self as unknown as DedicatedWorkerGlobalScope;

/** Everything this worker writes lives under one prefix, so it can be swept. */
const PREFIX = "sff-";

const open = new Map<string, { handle: SyncAccessHandle; fileName: string; offset: number; expected: number }>();

/**
 * Work for one file runs strictly in arrival order — see createSerialQueue for
 * the bug this prevents, which silently truncated the start of every file this
 * worker ever wrote.
 */
const queue = createSerialQueue((id, error) => {
  scope.postMessage({
    type: "failed",
    id,
    message: error instanceof Error ? error.message : "Could not write the file to storage.",
  });
});

async function root(): Promise<OpfsDirHandle> {
  return (await (navigator.storage as unknown as { getDirectory(): Promise<OpfsDirHandle> }).getDirectory());
}

/**
 * Deletes anything left behind by a previous session. A transfer that was
 * abandoned — tab closed mid-file — leaves its partial file on disk with
 * nothing to reclaim it, and quota is finite. Runs once at startup, before any
 * file for this session is created, so it can never remove a live one.
 */
async function sweepOldFiles() {
  try {
    const dir = await root();
    for await (const name of dir.keys()) {
      if (name.startsWith(PREFIX)) await dir.removeEntry(name).catch(() => {});
    }
  } catch {
    // No OPFS, or nothing to sweep. Either way there is nothing to do.
  }
}

const swept = sweepOldFiles();

scope.onmessage = (event: MessageEvent<Incoming>) => {
  const msg = event.data;

  // Everything for one file goes through that file's chain, in arrival order.
  // Nothing here may run ahead of the open it depends on.
  queue.enqueue(msg.id, async () => {
    if (msg.type === "open") {
      await swept;
      const dir = await root();
      // The name on disk is ours, not the sender's: it is an internal handle,
      // and the real filename is applied when the user saves.
      //
      // The id still comes off the wire though — it is whatever the peer put
      // in its file-start message, not something generated here — so it is
      // reduced to characters that cannot mean anything to a filesystem
      // before being concatenated into a name. The OPFS API rejects
      // separators on its own account, so this is a second lock on a door
      // that is already locked; the reason to fit it is that the first lock
      // belongs to somebody else's code and this one does not.
      const safeId = String(msg.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || "unnamed";
      const fileName = `${PREFIX}${safeId}`;
      const handle = await dir.getFileHandle(fileName, { create: true });
      const access = await handle.createSyncAccessHandle();
      access.truncate(0);
      open.set(msg.id, { handle: access, fileName, offset: 0, expected: Math.max(0, Number(msg.size) || 0) });
      scope.postMessage({ type: "opened", id: msg.id });
      return;
    }

    if (msg.type === "write") {
      const entry = open.get(msg.id);
      // Reachable only if a write arrives for a file that was never opened or
      // has already been closed. That is a bug rather than a condition, and it
      // costs bytes — so it is reported instead of being swallowed, which is
      // what hid the corruption for so long.
      if (!entry) throw new Error("Received data for a file that is not open.");
      entry.offset += entry.handle.write(new Uint8Array(msg.buffer), { at: entry.offset });
      return;
    }

    if (msg.type === "close") {
      const entry = open.get(msg.id);
      if (!entry) throw new Error("Asked to finish a file that is not open.");
      open.delete(msg.id);
      queue.forget(msg.id);
      entry.handle.flush();
      entry.handle.close();

      const dir = await root();
      const handle = await dir.getFileHandle(entry.fileName);
      const file = await handle.getFile();

      // The last line of defence, and the one that would have caught this
      // silently. A file whose bytes on disk do not match what the sender said
      // it would send is corrupt, and handing it over as a success is worse
      // than failing: the person keeps it, deletes the original, and finds out
      // months later. Refuse it instead, and say so.
      if (entry.expected > 0 && file.size !== entry.expected) {
        await dir.removeEntry(entry.fileName).catch(() => {});
        throw new Error(
          `Only ${file.size} of ${entry.expected} bytes arrived, so the file is incomplete and was not kept. Please try again.`,
        );
      }

      // A File from OPFS is a reference to bytes on disk, not a copy in memory,
      // so posting it back costs nothing regardless of how large it is.
      scope.postMessage({ type: "done", id: msg.id, file, mime: msg.mime });
      return;
    }

    if (msg.type === "discard") {
      const entry = open.get(msg.id);
      queue.forget(msg.id);
      if (entry) {
        open.delete(msg.id);
        try {
          entry.handle.close();
        } catch {
          // Already closed.
        }
        const dir = await root();
        await dir.removeEntry(entry.fileName).catch(() => {});
      }
      return;
    }
  });
};

export {};
