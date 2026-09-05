"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type TransferStatus } from "@/lib/peerTransfer";
import { formatBytes } from "@/lib/format";
import { DEFAULT_ROOM_DURATION, ROOM_DURATION_ADS, ROOM_DURATION_CHOICES } from "@/lib/ads";
import { useKeepOpen } from "@/lib/useKeepOpen";
import { ProgressBar } from "./ProgressBar";
import { CodeDisplay } from "./CodeDisplay";
import { Button } from "./Button";
import { AdGate } from "./ads/AdGate";
import { AdSlot } from "./ads/AdSlot";
import { FileDropZone } from "./tools/FileDropZone";

const STATUS_LABEL: Partial<Record<TransferStatus, string>> = {
  "connecting-signal": "Connecting…",
  "waiting-for-peer": "Waiting for the receiver to enter the code…",
  negotiating: "Receiver found — opening a direct connection…",
  connected: "Connected! Starting transfer…",
  transferring: "Sending…",
  done: "All files sent.",
};

export function SendPanel({ initialFile }: { initialFile?: File | null } = {}) {
  const [files, setFiles] = useState<File[]>([]);

  // A file handed off from the Tools tab (e.g. "compress then send") lands here —
  // each hand-off is a fresh File instance, so this fires once per hand-off.
  // Deferred via setTimeout for the same reason as ReceivePanel's initial-code
  // effect: React flags a synchronous setState in an effect body.
  useEffect(() => {
    if (!initialFile) return;
    const timer = setTimeout(() => setFiles([initialFile]), 0);
    return () => clearTimeout(timer);
  }, [initialFile]);

  const [status, setStatus] = useState<TransferStatus>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  /**
   * How long the code should keep working. Ten minutes covers the case this is
   * built for — reading six digits to someone who is right there. Longer is for
   * when they aren't, and is opt-in because the file waits on THIS device the
   * whole time.
   */
  const [roomMinutes, setRoomMinutes] = useState<number>(DEFAULT_ROOM_DURATION);
  const [progress, setProgress] = useState<Map<string, FileProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  // Which action is currently waiting behind an ad. The gate renders where the
  // result would have appeared, so the user is never covered by an overlay.
  const [gate, setGate] = useState<null | "code">(null);
  const transferRef = useRef<PeerTransfer | null>(null);
  const startedSendingRef = useRef(false);

  function startSending(minutes: number) {
    setError(null);
    startedSendingRef.current = false;
    const transfer = new PeerTransfer("sender", {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === "error" && detail) setError(detail);
        if (s === "connected" && !startedSendingRef.current) {
          startedSendingRef.current = true;
          transfer.sendFiles(files).catch((e) => setError(e.message));
        }
      },
      onCode: (c, expires) => {
        setCode(c);
        setExpiresAt(expires);
      },
      onProgress: (p) => setProgress((prev) => new Map(prev).set(p.id, p)),
      onError: setError,
    });
    transferRef.current = transfer;
    transfer.connectAsSender(minutes);
  }

  function reset() {
    transferRef.current?.close();
    transferRef.current = null;
    setFiles([]);
    setStatus("idle");
    setCode(null);
    setExpiresAt(null);
    setRoomMinutes(DEFAULT_ROOM_DURATION);
    setProgress(new Map());
    setError(null);
    setGate(null);
  }

  // From the moment a code exists until the last byte lands, this tab IS the
  // transfer — see useKeepOpen.
  useKeepOpen(status === "waiting-for-peer" || status === "negotiating" || status === "connected" || status === "transferring");

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSent = [...progress.values()].reduce((sum, p) => sum + p.sent, 0);

  if (status === "idle") {
    return (
      <div className="flex flex-col gap-6">
        <FileDropZone
          onFiles={(picked) => setFiles(picked)}
          label="Drop a file here, or click to choose"
          hint="Any size. Any type. No account."
        />

        {files.length > 0 && (
          // A ruled list sitting on the page — deliberately not a bordered
          // panel, which would nest a box inside the section's own box.
          <div className="flex flex-col gap-5">
            <ul className="flex flex-col border-t border-rule text-sm">
              {files.map((f) => (
                <li key={f.name} className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
                  <span className="truncate text-ink">{f.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-ink-soft">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
            {gate === "code" ? (
              <AdGate
                purpose="reveal-code"
                roomMinutes={roomMinutes}
                waitingFor="Your code"
                onPass={() => {
                  setGate(null);
                  startSending(roomMinutes);
                }}
                onCancel={() => setGate(null)}
              />
            ) : (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5 text-[13px] font-medium text-black">
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-55">
                    How long should the code work?
                  </span>
                  <select
                    value={roomMinutes}
                    onChange={(e) => setRoomMinutes(Number(e.target.value))}
                    className="max-w-xs border-2 border-black bg-transparent px-3 py-2.5 text-[14px] font-semibold text-black outline-none focus:border-red"
                  >
                    {ROOM_DURATION_CHOICES.map((m) => (
                      <option key={m} value={m}>
                        {m < 60 ? `${m} minutes` : `${m / 60} hour${m === 60 ? "" : "s"}`}
                        {" · "}
                        {ROOM_DURATION_ADS[m]}s ad
                      </option>
                    ))}
                  </select>
                </label>

                <p className="max-w-md text-[13px] font-medium leading-[1.5] text-black opacity-55">
                  {roomMinutes === DEFAULT_ROOM_DURATION
                    ? "Ten minutes is right when they're with you or already waiting. Your file never leaves this device, so this page has to stay open until they collect it."
                    : `Your code will be 8 digits instead of 6 — a code that works for ${
                        roomMinutes < 60 ? `${roomMinutes} minutes` : `${roomMinutes / 60} hour${roomMinutes === 60 ? "" : "s"}`
                      } is one a stranger has longer to guess, so it gets a bigger haystack. Send it as a link or QR rather than reading it out. This page must stay open the whole time — your file is waiting here, not on a server.`}
                </p>

                <Button onClick={() => setGate("code")} className="self-start">
                  Get a code to share
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium text-foreground">
          Sent {files.length} file{files.length === 1 ? "" : "s"}.
        </p>
        <Button onClick={reset}>Send more files</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p role="status" aria-live="polite" className="text-sm font-medium text-foreground">
        {STATUS_LABEL[status] ?? status}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {code && (status === "waiting-for-peer" || status === "negotiating") && <CodeDisplay code={code} expiresAt={expiresAt} />}
      {(status === "transferring" || status === "connected") && (
        <div className="w-full max-w-md">
          <ProgressBar fraction={totalSize ? totalSent / totalSize : 0} />
          <p className="mt-2 text-center text-sm text-muted">
            {formatBytes(totalSent)} / {formatBytes(totalSize)}
          </p>
        </div>
      )}
      {/* The one thing a sender needs to know here, and the thing that
          replaced the upload fallback: the file is waiting on THIS device, so
          the tab has to stay open. An hour is what the code is good for. */}
      {status === "waiting-for-peer" && (
        <p className="max-w-md bg-y-max px-4 py-3 text-center text-[13px] font-semibold leading-[1.45] text-black">
          Keep this page open — your file is waiting on this device, not on a server. Close the tab and the transfer
          is gone.
          {expiresAt ? ` The code stops working at ${new Date(expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : ""}
        </p>
      )}

      {/* The sender waits here for as long as it takes the other person to
          type six digits — dead time that already existed, so filling it costs
          nobody a second they weren't already spending. */}
      {status === "waiting-for-peer" && <AdSlot slotId="send-waiting" format="rectangle" className="my-2" />}
      <Button variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
