"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type TransferStatus } from "@/lib/peerTransfer";
import { formatBytes } from "@/lib/format";
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
  const [progress, setProgress] = useState<Map<string, FileProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  // Which action is currently waiting behind an ad. The gate renders where the
  // result would have appeared, so the user is never covered by an overlay.
  const [gate, setGate] = useState<null | "code">(null);
  const transferRef = useRef<PeerTransfer | null>(null);
  const startedSendingRef = useRef(false);

  function startSending() {
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
      onCode: setCode,
      onProgress: (p) => setProgress((prev) => new Map(prev).set(p.id, p)),
      onError: setError,
    });
    transferRef.current = transfer;
    transfer.connectAsSender();
  }

  function reset() {
    transferRef.current?.close();
    transferRef.current = null;
    setFiles([]);
    setStatus("idle");
    setCode(null);
    setProgress(new Map());
    setError(null);
    setGate(null);
  }

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
                waitingFor="Your code"
                onPass={() => {
                  setGate(null);
                  startSending();
                }}
                onCancel={() => setGate(null)}
              />
            ) : (
              <Button onClick={() => setGate("code")} className="self-start">
                Get a code to share
              </Button>
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
      {code && (status === "waiting-for-peer" || status === "negotiating") && <CodeDisplay code={code} />}
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
          Keep this page open — your file is waiting here, not on a server. The code works for the next hour.
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
