"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type TransferStatus } from "@/lib/peerTransfer";
import { uploadFileForLink, type UploadProgress } from "@/lib/linkTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import { CodeDisplay } from "./CodeDisplay";
import { LinkShare } from "./LinkShare";
import { Button } from "./Button";
import { IconUpload } from "./icons";

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

export function SendPanel({ initialFile }: { initialFile?: File | null } = {}) {
  const [files, setFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<"p2p" | "link">("p2p");

  // A file handed off from the Tools tab (e.g. "compress then send") lands here —
  // each hand-off is a fresh File instance, so this fires once per hand-off.
  // Deferred via setTimeout for the same reason as ReceivePanel's initial-code
  // effect: React flags a synchronous setState in an effect body.
  useEffect(() => {
    if (!initialFile) return;
    const timer = setTimeout(() => setFiles([initialFile]), 0);
    return () => clearTimeout(timer);
  }, [initialFile]);

  // --- P2P (default) path ---
  const [status, setStatus] = useState<TransferStatus>("idle");
  const [code, setCode] = useState<string | null>(null);
  const [progress, setProgress] = useState<Map<string, FileProgress>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [showLinkOffer, setShowLinkOffer] = useState(false);
  const transferRef = useRef<PeerTransfer | null>(null);
  const startedSendingRef = useRef(false);

  // --- Link fallback path (Phase 2: upload to R2, share a link for later) ---
  const [linkStatus, setLinkStatus] = useState<"configuring" | "uploading" | "ready" | "error">("configuring");
  const [linkProgress, setLinkProgress] = useState<UploadProgress>({ loaded: 0, total: 0 });
  const [linkResult, setLinkResult] = useState<{ token: string; expiresAt: number } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkPassword, setLinkPassword] = useState("");
  const [linkExpiryHours, setLinkExpiryHours] = useState(24);
  const [linkBurnAfterDownload, setLinkBurnAfterDownload] = useState(false);

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
    setLinkStatus("configuring");
  }

  function createLink() {
    setLinkStatus("uploading");
    setLinkError(null);
    uploadFileForLink(files[0], setLinkProgress, {
      password: linkPassword,
      expiryHours: linkExpiryHours,
      burnAfterDownload: linkBurnAfterDownload,
    })
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
    setLinkStatus("configuring");
    setLinkPassword("");
    setLinkExpiryHours(24);
    setLinkBurnAfterDownload(false);
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSent = [...progress.values()].reduce((sum, p) => sum + p.sent, 0);

  if (status === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <label
          htmlFor="file-input"
          className="group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-12 text-center transition hover:border-accent hover:bg-accent/[.04]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickFiles(e.dataTransfer.files);
          }}
        >
          <IconUpload className="h-7 w-7 text-muted transition group-hover:text-accent" />
          <span className="font-medium text-foreground">Drop a file here, or click to choose</span>
          <span className="text-sm text-muted">No size limit games. No account.</span>
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => pickFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <ul className="flex flex-col gap-1 text-sm">
              {files.map((f) => (
                <li key={f.name} className="flex justify-between gap-3">
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-muted">{formatBytes(f.size)}</span>
                </li>
              ))}
            </ul>
            <Button onClick={startSending} className="self-start">
              Get a code to share
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (mode === "link") {
    return (
      <div className="flex flex-col items-center gap-6">
        {linkStatus === "configuring" && (
          <div className="flex w-full max-w-sm flex-col gap-4">
            <p className="text-sm font-medium text-foreground">A few optional protections for this link</p>
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              Password (optional)
              <input
                type="password"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none placeholder:text-muted/70 focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-muted">
              Link expires after
              <select
                value={linkExpiryHours}
                onChange={(e) => setLinkExpiryHours(Number(e.target.value))}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
              >
                <option value={1}>1 hour</option>
                <option value={24}>1 day</option>
                <option value={72}>3 days</option>
                <option value={168}>7 days</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={linkBurnAfterDownload}
                onChange={(e) => setLinkBurnAfterDownload(e.target.checked)}
                className="h-4 w-4 accent-accent"
              />
              Delete after first download
            </label>
            <Button onClick={createLink} className="mt-2 self-start">
              Create link
            </Button>
          </div>
        )}
        {linkStatus === "uploading" && (
          <>
            <p className="text-sm font-medium text-foreground">Uploading so the link works anytime…</p>
            <div className="w-full max-w-md">
              <ProgressBar fraction={linkProgress.total ? linkProgress.loaded / linkProgress.total : 0} />
              <p className="mt-2 text-center text-sm text-muted">
                {formatBytes(linkProgress.loaded)} / {formatBytes(linkProgress.total)}
              </p>
            </div>
          </>
        )}
        {linkStatus === "error" && <p className="text-sm text-danger">{linkError}</p>}
        {linkStatus === "ready" && linkResult && <LinkShare token={linkResult.token} expiresAt={linkResult.expiresAt} />}
        <Button variant="ghost" onClick={reset}>
          {linkStatus === "ready" ? "Send another file" : "Cancel"}
        </Button>
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
      <p className="text-sm font-medium text-foreground">{STATUS_LABEL[status] ?? status}</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      {code && (status === "waiting-for-peer" || status === "negotiating") && <CodeDisplay code={code} />}
      {(status === "transferring" || status === "connected") && (
        <div className="w-full max-w-md">
          <ProgressBar fraction={totalSize ? totalSent / totalSize : 0} />
          <p className="mt-2 text-center text-sm text-muted">
            {formatBytes(totalSent)} / {formatBytes(totalSize)}
          </p>
        </div>
      )}
      {showLinkOffer && status === "waiting-for-peer" && files.length === 1 && (
        <Button variant="ghost" onClick={switchToLinkFallback} className="text-accent hover:text-accent-hover">
          Receiver not online? Get a shareable link instead
        </Button>
      )}
      <Button variant="ghost" onClick={reset}>
        Cancel
      </Button>
    </div>
  );
}
