"use client";

import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import { PeerTransfer, type FileProgress, type TransferStatus } from "@/lib/peerTransfer";
import { uploadFileForLink, type UploadProgress } from "@/lib/linkTransfer";
import { formatBytes } from "@/lib/format";
import { retentionChoicesFor, retentionLabel } from "@/lib/retention";
import { ProgressBar } from "./ProgressBar";
import { CodeDisplay } from "./CodeDisplay";
import { LinkShare } from "./LinkShare";
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
  // Which action is currently waiting behind an ad. The gate renders where the
  // result would have appeared, so the user is never covered by an overlay.
  const [gate, setGate] = useState<null | "code" | "link">(null);
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
  // Multi-file link sharing only works if the files are bundled into one zip
  // first — deliberately opt-in, unchecked by default, never automatic.
  const [linkZipFiles, setLinkZipFiles] = useState(false);

  useEffect(() => {
    const delay = status === "waiting-for-peer" ? LINK_FALLBACK_DELAY_MS : 0;
    const shouldOffer = status === "waiting-for-peer";
    const timer = setTimeout(() => setShowLinkOffer(shouldOffer), delay);
    return () => clearTimeout(timer);
  }, [status]);

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

  async function buildLinkFile(): Promise<File> {
    if (files.length === 1) return files[0];
    // Multiple files, bundled by explicit user choice (see the checkbox below) —
    // zipping is the only way multi-file link sharing works today, but it's
    // never applied automatically.
    const entries: Record<string, Uint8Array> = {};
    for (const f of files) entries[f.name] = new Uint8Array(await f.arrayBuffer());
    const zipped = zipSync(entries);
    return new File([zipped as BlobPart], "files.zip", { type: "application/zip" });
  }

  async function createLink(adReceipt: string | null) {
    setLinkStatus("uploading");
    setLinkError(null);
    try {
      const fileToUpload = await buildLinkFile();
      const result = await uploadFileForLink(fileToUpload, setLinkProgress, {
        password: linkPassword,
        expiryHours,
        burnAfterDownload: linkBurnAfterDownload,
        adReceipt,
      });
      setLinkResult(result);
      setLinkStatus("ready");
    } catch (e) {
      setLinkError((e as Error).message);
      setLinkStatus("error");
    }
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
    setGate(null);
    setLinkPassword("");
    setLinkExpiryHours(24);
    setLinkBurnAfterDownload(false);
    setLinkZipFiles(false);
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  // What this particular file is allowed to ask for — see lib/retention.ts.
  const retentionChoices = retentionChoicesFor(totalSize);
  const longestChoice = retentionChoices.length > 0 ? retentionChoices[retentionChoices.length - 1] : 1;
  // Adding a big file to the pile can put the chosen window out of reach.
  // Derived rather than corrected in an effect, so the menu can never render a
  // value it doesn't contain.
  const expiryHours = retentionChoices.includes(linkExpiryHours) ? linkExpiryHours : longestChoice;
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

  if (mode === "link") {
    return (
      <div className="flex flex-col items-center gap-6">
        {linkStatus === "configuring" && (
          <div className="flex w-full max-w-sm flex-col gap-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              Optional protections
            </p>
            {files.length > 1 && (
              <div className="flex flex-col gap-2 border-l-2 border-accent pl-3 text-sm text-ink-soft">
                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={linkZipFiles}
                    onChange={(e) => setLinkZipFiles(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Bundle these {files.length} files into one .zip
                </label>
                {!linkZipFiles && (
                  <p className="text-xs">
                    A shareable link needs a single file — check the box above to bundle them, or go back and send
                    them one at a time via a code instead.
                  </p>
                )}
              </div>
            )}
            <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
              Password (optional)
              <input
                type="password"
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="Leave blank for no password"
                className="border border-rule bg-transparent px-3 py-2.5 text-ink outline-none placeholder:text-ink-soft/70 focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-ink-soft">
              Link expires after
              <select
                value={expiryHours}
                onChange={(e) => setLinkExpiryHours(Number(e.target.value))}
                className="border border-rule bg-transparent px-3 py-2.5 text-ink outline-none focus:border-accent"
              >
                {retentionChoices.map((h) => (
                  <option key={h} value={h}>
                    {retentionLabel(h)}
                  </option>
                ))}
              </select>
              {longestChoice < 168 && (
                <span className="text-xs">
                  A file this size can be kept for {retentionLabel(longestChoice)}. Storing it is the only part of
                  ShareFilesFree that costs us money, and a big file costs more for every hour it sits there — so the
                  bigger it is, the shorter the window.
                </span>
              )}
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={linkBurnAfterDownload}
                onChange={(e) => setLinkBurnAfterDownload(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              Delete after first download
            </label>
            {retentionChoices.length === 0 && (
              // Caught before the ad rather than after it: nobody should sit
              // through a countdown only to be told the file was never eligible.
              <p className="bg-red px-4 py-3 text-[14px] font-semibold leading-[1.45] text-y-pale">
                {formatBytes(totalSize)} is past what a shareable link can hold. Send it with a code instead — that
                path goes straight to the other device and has no size limit at all.
              </p>
            )}
            {gate === "link" ? (
              // Priced on bytes x retention, so the ad load matches what
              // holding this file actually costs — see lib/ads.ts.
              <AdGate
                purpose="link-upload"
                bytes={totalSize}
                hours={expiryHours}
                waitingFor="Your link"
                onPass={(receipt) => {
                  setGate(null);
                  void createLink(receipt);
                }}
                onCancel={() => setGate(null)}
              />
            ) : (
              <Button
                onClick={() => setGate("link")}
                disabled={(files.length > 1 && !linkZipFiles) || retentionChoices.length === 0}
                className="self-start"
              >
                Create link
              </Button>
            )}
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
      {/* The sender waits here for as long as it takes the other person to
          type six digits — dead time that already existed, so filling it costs
          nobody a second they weren't already spending. */}
      {status === "waiting-for-peer" && <AdSlot slotId="send-waiting" format="rectangle" className="my-2" />}
      {showLinkOffer && status === "waiting-for-peer" && (
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
