"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type IncomingFile, type TransferStatus } from "@/lib/peerTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import { Button } from "./Button";

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
  // Object URLs are created exactly once per received file, at receipt time —
  // not inline in JSX during render. Creating them during render (even
  // memoized) risks the URL being revoked out from under the very render that
  // uses it under React Strict Mode's double-render in dev — see the fix in
  // ToolResultCard.tsx for the verified version of this bug.
  const [objectUrls, setObjectUrls] = useState<Map<string, string>>(new Map());

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
      onFileReceived: (file) => {
        const url = URL.createObjectURL(file.blob);
        setObjectUrls((prev) => new Map(prev).set(file.id, url));
        setReceived((prev) => [...prev, file]);
      },
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
    objectUrls.forEach((u) => URL.revokeObjectURL(u));
    setObjectUrls(new Map());
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
        className="flex flex-col gap-6"
      >
        <label htmlFor="code-input" className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">
          Enter the 6-digit code from the sender
        </label>
        {/* Display-scale, underlined rather than boxed — this is the single
            most important control on the page, so it's sized like it. */}
        <input
          id="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="000000"
          className="w-full bg-lime px-5 py-4 text-center font-display text-5xl tabular-nums tracking-[0.16em] text-red outline-none placeholder:text-red/25 sm:text-6xl"
        />
        {error && (
          <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" className="self-start">
          Connect
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p role="status" aria-live="polite" className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        {STATUS_LABEL[status] ?? status}
      </p>
      {error && (
        <p role="alert" className="border-l-2 border-danger pl-3 text-sm text-danger">
          {error}
        </p>
      )}

      {status === "transferring" && progress && (
        <div className="w-full">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <p className="truncate text-sm text-ink">{progress.name}</p>
            <p className="shrink-0 font-mono text-xs tabular-nums text-ink-soft">
              {formatBytes(progress.sent)} / {formatBytes(progress.size)}
            </p>
          </div>
          <ProgressBar fraction={progress.size ? progress.sent / progress.size : 0} />
        </div>
      )}

      {received.length > 0 && (
        // A ruled list, not a stack of bordered rows — same device as the
        // sender's staged-file list.
        <ul className="flex w-full flex-col border-t border-ink">
          {received.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-4 border-b border-rule py-3 text-sm">
              <span className="truncate text-ink">{f.name}</span>
              <a
                href={objectUrls.get(f.id)}
                download={f.name}
                className="sff-press shrink-0 bg-ink px-4 py-2 text-xs font-medium leading-none text-paper shadow-[3px_3px_0_var(--accent)] hover:bg-accent"
              >
                Save
              </a>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-6">
        {status === "done" && <Button onClick={reset}>Receive more files</Button>}
        {status !== "done" && (
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
