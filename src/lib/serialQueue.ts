/**
 * Runs tasks for a given key strictly one at a time, in the order they arrive.
 *
 * This exists because its absence silently corrupted every file the OPFS sink
 * ever wrote. That worker's `onmessage` was an async function: opening a file
 * awaited several times, and the event loop went on delivering `write` messages
 * throughout. Those writes looked up a file handle that did not exist yet,
 * found nothing, and returned — discarding the first chunks of the file with no
 * error anywhere. Progress still reached 100%, because the bytes had been
 * counted on the way in.
 *
 * The general shape of that bug is "an async handler that assumes the state set
 * up by an earlier message is already there". A per-key queue removes the
 * assumption: work for a key cannot start until the previous work for that key
 * has finished, however many times it yielded in between.
 *
 * Kept separate from the worker so it can be tested, which the worker itself
 * cannot easily be — it needs a worker scope and a real Origin Private File
 * System, neither of which exists in a unit test.
 */
export interface SerialQueue {
  /** Queues `task` behind anything already pending for `key`. */
  enqueue(key: string, task: () => Promise<void> | void): void;
  /** Drops the queue for a key once nothing more will reference it. */
  forget(key: string): void;
  /** Resolves once everything queued for `key` so far has settled. Tests use this. */
  drain(key: string): Promise<void>;
}

export function createSerialQueue(onError: (key: string, error: unknown) => void): SerialQueue {
  const chains = new Map<string, Promise<void>>();

  return {
    enqueue(key, task) {
      const previous = chains.get(key) ?? Promise.resolve();
      // The catch is on the chain, so one failed task reports and the queue
      // keeps running rather than wedging every later task behind a rejection.
      const next = previous.then(task).catch((error: unknown) => onError(key, error));
      chains.set(key, next);
    },
    forget(key) {
      chains.delete(key);
    },
    drain(key) {
      return chains.get(key) ?? Promise.resolve();
    },
  };
}
