"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type TransferStatus } from "@/lib/peerTransfer";
import { uploadFileForLink, type UploadProgress } from "@/lib/linkTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import { CodeDisplay } from "./CodeDisplay";
import { LinkShare } from "./LinkShare";

const STATUS_LABEL: Partial<Record<TransferStatus, string>> = {
  "connecting-signal": "Connecting…",
  "waiting-for-peer": "Waiting for the receiver to enter the code…",
  negotiating: "Receiver found — opening a direct connection…",
  connected: "Connected! Starting transfer…",
  transferring: "Sending…",
  done: "All files sent.",
};

// How long to wait for a receiver before offering the "share a link instead"
// fallback. Long enough that it doesn't flash for a receiver who's just
// slow to type the code; short enough that nobody sits there wondering.
const LINK_FALLBACK_DELAY_MS = 20_000;

export function SendPanel() {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"p2p" | "link">("p2p");

  // --- P2P (default) path ---
  const [status, setStatus] = useState<TransferStatus>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<Map<string, FileProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [showLinkOffer, setShowLinkOffer] = useState(false);
  const transferRef = useRef<PeerTransfer | null>(null);
  const startedSendingRef = useRef(false);

  // --- Link fallback path (Phase 2: upload to R2, share a link for later) ---
  const [linkStatus, setLinkStatus] = useState<"uploading" | "ready" | "error">("uploading");
  const [linkProgress, setLinkProgress] = useState<UploadProgress>({ loaded: 0, total: 0 });
  const [linkResult, setLinkResult] = useState<{ token: string; expiresAt: number } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const delay = status === "waiting-for-peer" ? LINK_FALLBACK_DELAY_MS : 0;
    const shouldOffer = status === "waiting-for-peer";
    const timer = setTimeout(() => setShowLinkOffer(shouldOffer), delay);
    return () => clearTimeout(timer);
  }, [status]);

  function pickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setFiles(Array.from(list));
  }

  function startSending() {
    setError(null);
    setMode("p2p");
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

  function switchToLinkFallback() {
    transferRef.current?.close();
    transferRef.current = null;
    setMode("link");
    setLinkStatus("uploading");
    setLinkError(null);
    uploadFileForLink(files[0], setLinkProgress)
      .then((result) => {
        setLinkResult(result);
        setLinkStatus("ready");
      })
      .catch((e) => {
        setLinkError(e.message);
        setLinkStatus("error");
      });
  }

  function reset() {
    transferRef.current?.close();
    transferRef.current = null;
    setFiles([]);
    setMode("p2p");
    setStatus("idle");
    setCode(null);
    setProgress(new Map());
    setError(null);
    setLinkResult(null);
    setLinkError(null);
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSent = [...progress.values()].reduce((sum, p) => sum + p.sent, 0);

  if (status === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <label
          htmlFor="file-input"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 p-12 text-center transition hover:border-emerald-500 hover:bg-emerald-500/5 dark:border-white/15"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFiles(e.dataTransfer.files);
          }}
        >
          <span className="text-3xl">📁</span>
          <span className="font-medium">Drop files here, or click to choose</span>
          <span className="text-sm text-black/50 dark:text-white/50">No size limit games. No account.</span>
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => pickFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <div className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
            <ul className="flex flex-col gap-1 text-sm">
              {files.map((f) => (
                <li key={f.name} className="flex justify-between">
                  <span className="truncate">{f.name}</span>
                  <span className="text-black/50 dark:text-white/50">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={startSending}
              className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500"
            >
              Get a code to share
            </button>
          </div>
        )}
      </div>
    );
  }

  if (mode === "link") {
    return (
      <div className="flex flex-col items-center gap-6">
        {linkStatus === "uploading" && (
          <>
            <p className="text-sm font-medium text-black/70 dark:text-white/70">Uploading so the link works anytime…</p>
            <div className="w-full max-w-md">
              <ProgressBar fraction={linkProgress.total ? linkProgress.loaded / linkProgress.total : 0} />
              <p className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
                {formatBytes(linkProgress.loaded)} / {formatBytes(linkProgress.total)}
              </p>
            </div>
          </>
        )}
        {linkStatus === "error" && <p className="text-sm text-red-600 dark:text-red-400">{linkError}</p>}
        {linkStatus === "ready" && linkResult && <LinkShare token={linkResult.token} expiresAt={linkResult.expiresAt} />}
        <button type="button" onClick={reset} className="text-sm text-black/50 hover:underline dark:text-white/50">
          {linkStatus === "ready" ? "Send another file" : "Cancel"}
        </button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-lg font-medium">✅ Sent {files.length} file{files.length === 1 ? "" : "s"}.</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Send more files
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm font-medium text-black/70 dark:text-white/70">{STATUS_LABEL[status] ?? status}</p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {code && (status === "waiting-for-peer" || status === "negotiating") && <CodeDisplay code={code} />}
      {(status === "transferring" || status === "connected") && (
        <div className="w-full max-w-md">
          <ProgressBar fraction={totalSize ? totalSent / totalSize : 0} />
          <p className="mt-2 text-center text-sm text-black/50 dark:text-white/50">
            {formatBytes(totalSent)} / {formatBytes(totalSize)}
          </p>
        </div>
      )}
      {showLinkOffer && status === "waiting-for-peer" && files.length === 1 && (
        <button
          type="button"
          onClick={switchToLinkFallback}
          className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
        >
          Receiver not online? Get a shareable link instead
        </button>
      )}
      <button type="button" onClick={reset} className="text-sm text-black/50 hover:underline dark:text-white/50">
        Cancel
      </button>
    </div>
  );
}
