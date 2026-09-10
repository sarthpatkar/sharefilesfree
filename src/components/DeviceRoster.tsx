"use client";

import type { GroupDevice } from "@/lib/groupTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";

const STATUS_LABEL: Record<GroupDevice["status"], string> = {
  connecting: "Connecting",
  connected: "Ready",
  sending: "Receiving",
  done: "Has the file",
  gone: "Disconnected",
  error: "Failed",
};

/**
 * Who has the file, and how far along they are.
 *
 * This is not decoration — with devices admitted automatically, the roster is
 * the security control. A one-to-one transfer tells the sender something is
 * wrong for free: a second person with the code is refused with "already
 * claimed", and the real receiver notices. A group share has no such moment, so
 * an extra device would arrive silently. Showing the count against the number
 * the sender actually asked for, and giving each device its own verification
 * code, is what puts that back.
 *
 * The per-device code is the same one the one-to-one flow shows: derived from
 * both ends of that connection, identical on both screens when nobody is in the
 * middle. It is per device because there is nothing shared to compare — each
 * connection is its own conversation.
 */
export function DeviceRoster({
  devices,
  expected,
  onDrop,
}: {
  devices: GroupDevice[];
  expected: number;
  onDrop?: (peerId: string) => void;
}) {
  const present = devices.filter((d) => d.status !== "gone").length;

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
          {present} of {expected} device{expected === 1 ? "" : "s"}
        </p>
        {devices.length > 0 && (
          <p className="text-[12px] font-semibold text-black opacity-55">
            {devices.filter((d) => d.status === "done").length} finished
          </p>
        )}
      </div>

      {devices.length === 0 ? (
        <p className="bg-lime-pale px-4 py-3 text-[13px] font-medium leading-[1.5] text-black">
          Nobody has joined yet. The code above works until someone does.
        </p>
      ) : (
        // Alternating flat tints, not ruled rows or cards — the same grammar the
        // received-files list uses, and the reason there is no box around this.
        <ul className="flex w-full flex-col">
          {devices.map((device, i) => (
            <li
              key={device.peerId}
              className={`flex flex-col gap-2 px-4 py-3 ${i % 2 === 0 ? "bg-lime-pale" : "bg-lime-4"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[14px] font-semibold text-black">Device {device.index}</span>
                <span
                  className={`text-[11px] font-bold uppercase tracking-[0.12em] ${
                    device.status === "gone" || device.status === "error" ? "text-red" : "text-black opacity-55"
                  }`}
                >
                  {STATUS_LABEL[device.status]}
                </span>
              </div>

              {device.status === "sending" && (
                <div className="flex flex-col gap-1.5">
                  <ProgressBar fraction={device.totalBytes ? device.sentBytes / device.totalBytes : 0} />
                  <span className="font-mono text-[11px] tabular-nums text-black opacity-55">
                    {formatBytes(device.sentBytes)} / {formatBytes(device.totalBytes)}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                {device.verificationCode ? (
                  <span className="font-mono text-[13px] font-bold tracking-[0.16em] text-black">
                    {device.verificationCode}
                  </span>
                ) : (
                  <span className="text-[12px] font-medium text-black opacity-40">Code appears once connected</span>
                )}

                {onDrop && device.status !== "gone" && device.status !== "done" && (
                  <button
                    type="button"
                    onClick={() => onDrop(device.peerId)}
                    className="link py-1 text-[12px] font-semibold text-red"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {devices.some((d) => d.verificationCode) && (
        // Said once, above the list, rather than repeated on every row — the
        // one-to-one screen can afford a paragraph per code because there is
        // only ever one.
        <p className="max-w-md text-[13px] font-medium leading-[1.5] text-black opacity-55">
          Each device should be showing the same code as the one beside its name here. Checking one or two of them is
          a quick way to be sure the file is going only to the people you meant.
        </p>
      )}
    </div>
  );
}
