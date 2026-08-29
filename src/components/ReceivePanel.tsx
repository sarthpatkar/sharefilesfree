"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type IncomingFile, type TransferStatus } from "@/lib/peerTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";

const STATUS_LABEL: Partial<Record<TransferStatus, string>> = {
  "connecting-signal": "Connecting…",
  negotiating: "Found the sender — opening a direct connection…",
  connected: "Connected! Waiting for the sender to start…",
  transferring: "Receiving…",
  done: "All files received.",
};

export function ReceivePanel({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [status, setStatus] = useState<TransferStatus>("idle");
  const [progress, setProgress] = useState<FileProgress | null>(null);
  const [received, setReceived] = useState<IncomingFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const transferRef = useRef<PeerTransfer | null>(null);

  function connect(targetCode: string) {
    if (targetCode.length !== 6) {
      setError("Enter the 6-digit code exactly as shown on the sender's screen.");
      return;
    }
    setError(null);
    const transfer = new PeerTransfer("receiver", {
      onStatus: (s, detail) => {
        setStatus(s);
        if (s === "error" && detail) setError(detail);
      },
      onProgress: setProgress,
      onFileReceived: (file) => setReceived((prev) => [...prev, file]),
      onError: setError,
    });
    transferRef.current = transfer;
    transfer.connectAsReceiver(targetCode);
  }

  // A code arriving via a shared link (?code=123456) is a deliberate click-through — connect right away.
  // Deferred with setTimeout so the state updates inside connect() don't fire synchronously
  // during the effect (React flags that as a footgun even though it's a one-time bootstrap).
  useEffect(() => {
    if (!(initialCode && initialCode.length === 6)) return;
    const timer = setTimeout(() => connect(initialCode), 0);
    return () => clearTimeout(timer);
  }, [initialCode]);

  function reset() {
    transferRef.current?.close();
    transferRef.current = null;
    setCode("");
    setStatus("idle");
    setProgress(null);
    setReceived([]);
    setError(null);
  }

  if (status === "idle") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          connect(code);
        }}
        className="flex flex-col items-center gap-4"
      >
        <label htmlFor="code-input" className="text-sm text-black/60 dark:text-white/60">
          Enter the 6-digit code from the sender
        </label>
        <input
          id="code-input"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-48 rounded-xl border border-black/15 bg-transparent px-4 py-3 text-center font-mono text-2xl tracking-[0.3em] outline-none focus:border-emerald-500 dark:border-white/15"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Connect
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">{STATUS_LABEL[status] ?? status}</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {status === "transferring" && progress && (
        <div className="w-full max-w-md">
          <p className="mb-1 truncate text-sm">{progress.name}</p>
          <ProgressBar fraction={progress.size ? progress.sent / progress.size : 0} />
          <p className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
            {formatBytes(progress.sent)} / {formatBytes(progress.size)}
          </p>
        </div>
      )}

      {received.length > 0 && (
        <ul className="flex w-full max-w-md flex-col gap-2">
          {received.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10"
            >
              <span className="truncate">{f.name}</span>
              <a
                href={URL.createObjectURL(f.blob)}
                download={f.name}
                className="shrink-0 rounded-full bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-500"
              >
                Save
              </a>
            </li>
          ))}
        </ul>
      )}

      {status === "done" && (
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Receive more files
        </button>
      )}
      {status !== "done" && (
        <button type="button" onClick={reset} className="text-sm text-black/50 hover:underline dark:text-white/50">
          Cancel
        </button>
      )}
    </div>
  );
}
