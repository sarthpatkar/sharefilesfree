import { describe, expect, it, vi } from "vitest";
import { createSerialQueue } from "./serialQueue";

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe("createSerialQueue", () => {
  it("will not start a task before the slow one ahead of it has finished", async () => {
    // This is the corruption, reproduced in miniature. The OPFS sink's "open"
    // awaited four times; every "write" delivered during those awaits found no
    // file handle and dropped its chunk on the floor.
    const order: string[] = [];
    const queue = createSerialQueue(() => {});

    queue.enqueue("file-1", async () => {
      order.push("open:start");
      await tick(30);
      order.push("open:end");
    });
    for (let i = 0; i < 3; i++) {
      queue.enqueue("file-1", () => {
        order.push(`write:${i}`);
      });
    }

    await queue.drain("file-1");
    expect(order).toEqual(["open:start", "open:end", "write:0", "write:1", "write:2"]);
  });

  it("keeps writes in the order they arrived", async () => {
    // Out-of-order writes corrupt a file just as thoroughly as missing ones,
    // and are harder to spot because the size still comes out right.
    const written: number[] = [];
    const queue = createSerialQueue(() => {});

    for (let i = 0; i < 12; i++) {
      queue.enqueue("f", async () => {
        // Deliberately uneven: a later task resolving faster must not overtake.
        await tick(i % 3 === 0 ? 5 : 0);
        written.push(i);
      });
    }

    await queue.drain("f");
    expect(written).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("reports a failing task instead of swallowing it", async () => {
    const onError = vi.fn();
    const queue = createSerialQueue(onError);

    queue.enqueue("f", () => {
      throw new Error("disk full");
    });
    await queue.drain("f");

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe("f");
    expect((onError.mock.calls[0][1] as Error).message).toBe("disk full");
  });

  it("keeps running after a failure rather than wedging the queue", async () => {
    const after: string[] = [];
    const queue = createSerialQueue(() => {});

    queue.enqueue("f", () => {
      throw new Error("one bad write");
    });
    queue.enqueue("f", () => {
      after.push("still ran");
    });

    await queue.drain("f");
    expect(after).toEqual(["still ran"]);
  });

  it("runs different files independently, so one stall cannot block another", async () => {
    const done: string[] = [];
    const queue = createSerialQueue(() => {});

    queue.enqueue("slow", async () => {
      await tick(40);
      done.push("slow");
    });
    queue.enqueue("fast", () => {
      done.push("fast");
    });

    await Promise.all([queue.drain("slow"), queue.drain("fast")]);
    expect(done).toEqual(["fast", "slow"]);
  });
});
