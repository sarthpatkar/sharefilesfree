"use client";

import { useEffect, useRef, useState } from "react";
import { GroupTransfer, type GroupDevice, type GroupStatus } from "@/lib/groupTransfer";
import { formatBytes } from "@/lib/format";
import {
  DEFAULT_DEVICES,
  DEFAULT_ROOM_DURATION,
  DEVICE_CHOICES,
  GATE_SECONDS,
  ROOM_DURATION_CHOICES,
  planFor,
} from "@/lib/ads";
import { useKeepOpen } from "@/lib/useKeepOpen";
import { CodeDisplay } from "./CodeDisplay";
import { DeviceRoster } from "./DeviceRoster";
import { Button } from "./Button";
import { AdGate } from "./ads/AdGate";
import { AdSlot } from "./ads/AdSlot";
import { FileDropZone } from "./tools/FileDropZone";
import { adsEnabled } from "./ads/adNetwork";

const STATUS_LABEL: Partial<Record<GroupStatus, string>> = {
  "connecting-signal": "Connecting…",
  "waiting-for-devices": "Waiting for devices to join…",
  transferring: "Sending…",
  done: "Everyone has the file.",
  error: "Share stopped.",
};

export function GroupPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<GroupStatus>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [devices, setDevices] = useState<GroupDevice[]>([]);
  const [deviceCount, setDeviceCount] = useState<number>(DEFAULT_DEVICES);
  const [minutes, setMinutes] = useState<number>(DEFAULT_ROOM_DURATION);
  const [accepting, setAccepting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gateOpen, setGateOpen] = useState(false);
  const transferRef = useRef<GroupTransfer | null>(null);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const gateSeconds = planFor("reveal-group-code", {
    roomMinutes: minutes,
    totalBytes: totalSize,
    deviceCount,
  }).seconds;

  // From the moment a code exists until the last device has the file, this tab
  // IS the share — every byte is read off this device — so the browser is asked
  // to warn before it closes.
  useKeepOpen(status === "waiting-for-devices" || status === "transferring");

  function start() {
    setError(null);
    const transfer = new GroupTransfer({
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === "error" && detail) setError(detail);
      },
      onCode: (c, expires, key) => {
        setCode(c);
        setExpiresAt(expires);
        setSecret(key);
      },
      onDevices: setDevices,
      onClosed: () => setAccepting(false),
      onError: setError,
    });
    transferRef.current = transfer;
    transfer.start(files, minutes, deviceCount);
  }

  function reset() {
    transferRef.current?.close();
    transferRef.current = null;
    setFiles([]);
    setStatus("idle");
    setCode(null);
    setExpiresAt(null);
    setSecret(null);
    setDevices([]);
    setDeviceCount(DEFAULT_DEVICES);
    setMinutes(DEFAULT_ROOM_DURATION);
    setAccepting(true);
    setError(null);
    setGateOpen(false);
  }

  useEffect(() => () => transferRef.current?.close(), []);

  if (status === "idle") {
    return (
      <div className="flex flex-col gap-6">
        <FileDropZone
          onFiles={(picked) => setFiles(picked)}
          label="Drop a file here, or click to choose"
          hint="Any size. Any type. No account."
        />

        {files.length > 0 && (
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col border-t border-rule text-sm">
              {files.map((f) => (
                <li key={f.name} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                  <span className="truncate text-ink">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-ink-soft">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>

            {gateOpen ? (
              <AdGate
                purpose="reveal-group-code"
                roomMinutes={minutes}
                totalBytes={totalSize}
                deviceCount={deviceCount}
                waitingFor="Your group code"
                onPass={() => {
                  setGateOpen(false);
                  start();
                }}
                onCancel={() => setGateOpen(false)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-black">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-55">
                      How many devices?
                    </span>
                    <select
                      value={deviceCount}
                      onChange={(e) => setDeviceCount(Number(e.target.value))}
                      className="border-2 border-black bg-transparent px-3 py-2.5 text-[14px] font-semibold text-black outline-none focus:border-red"
                    >
                      {DEVICE_CHOICES.map((n) => (
                        <option key={n} value={n}>
                          Up to {n} devices
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-black">
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-55">
                      How long should the code work?
                    </span>
                    <select
                      value={minutes}
                      onChange={(e) => setMinutes(Number(e.target.value))}
                      className="border-2 border-black bg-transparent px-3 py-2.5 text-[14px] font-semibold text-black outline-none focus:border-red"
                    >
                      {ROOM_DURATION_CHOICES.map((m) => (
                        <option key={m} value={m}>
                          {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <p className="max-w-md text-[13px] font-medium leading-[1.5] text-black opacity-55">
                  {minutes === DEFAULT_ROOM_DURATION
                    ? "Everyone gets their own copy, sent straight from this device as they join — so your upload speed is shared between them and the file never sits on a server."
                    : `You'll get a link and a QR code rather than characters to read out. Something that stays open for ${
                        minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes === 60 ? "" : "s"}`
                      } gives a stranger far longer to guess at, so it carries a key that's too long to say aloud.`}
                </p>

                {deviceCount >= 10 && (
                  <p className="max-w-md bg-y-max px-4 py-3 text-[13px] font-semibold leading-[1.45] text-black">
                    {deviceCount} devices means sending the file {deviceCount} times over your own connection. It
                    will work, and every device gets the whole file — it just goes as fast as your upload can feed
                    them all.
                  </p>
                )}

                {/* Said before the gate appears, not after — the same rule the
                    one-to-one screen follows. A share that costs more seconds
                    should say so while the sender can still change it. */}
                {adsEnabled() && gateSeconds > GATE_SECONDS && (
                  <p className="max-w-md bg-y-max px-4 py-3 text-[13px] font-semibold leading-[1.45] text-black">
                    That&rsquo;s {formatBytes(totalSize)} going to {deviceCount} devices, so the ad before your code
                    is {gateSeconds} seconds instead of {GATE_SECONDS}. There&rsquo;s no size limit here and there
                    never will be — big shares just carry more of what keeps this free.
                  </p>
                )}

                <Button onClick={() => setGateOpen(true)} className="self-start">
                  Get a code to share
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const finished = status === "done";

  return (
    <div className="flex flex-col items-center gap-6">
      <p role="status" aria-live="polite" className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
        {STATUS_LABEL[status] ?? status}
      </p>

      {error && (
        <p role="alert" className="bg-red px-4 py-3 text-[14px] font-semibold leading-[1.45] text-y-pale">
          {error}
        </p>
      )}

      {/* The code stays up for as long as a slot is open, which is the one thing
          this screen must not get wrong. The one-to-one screen hides the code
          the moment somebody joins, because there is nobody else it could be
          for. Here there usually is. */}
      {code && accepting && !finished && (
        <CodeDisplay code={code} expiresAt={expiresAt} secret={secret} group />
      )}

      <DeviceRoster
        devices={devices}
        expected={deviceCount}
        onDrop={finished ? undefined : (peerId) => transferRef.current?.dropDevice(peerId)}
      />

      {status === "waiting-for-devices" && (
        <p className="max-w-md bg-y-max px-4 py-3 text-center text-[13px] font-semibold leading-[1.45] text-black">
          Keep this page open — the file is waiting on this device, not on a server. Close the tab and everyone still
          waiting loses it.
          {expiresAt
            ? ` The code stops working at ${new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`
            : ""}
        </p>
      )}

      {status === "waiting-for-devices" && <AdSlot slotId="group-waiting" format="rectangle" className="my-2" />}

      <div className="flex flex-wrap items-center justify-center gap-4">
        {accepting && !finished && devices.length > 0 && (
          // The other half of admitting devices automatically: once everyone who
          // should be here is here, the sender can shut the door without ending
          // the transfers already running.
          <Button
            variant="ghost"
            onClick={() => {
              transferRef.current?.stopAccepting();
              setAccepting(false);
            }}
          >
            Stop accepting devices
          </Button>
        )}
        <Button onClick={reset} variant={finished ? "primary" : "ghost"}>
          {finished ? "Share something else" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
