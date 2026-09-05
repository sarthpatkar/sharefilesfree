"use client";

import { useEffect, useRef, useState } from "react";
import { PeerTransfer, type FileProgress, type IncomingFile, type TransferStatus } from "@/lib/peerTransfer";
import { formatBytes } from "@/lib/format";
import { ProgressBar } from "./ProgressBar";
import { Button } from "./Button";
import { zip } from "fflate";

const STATUS_LABEL: Partial<Record<TransferStatus, string>> = {
  "connecting-signal": "Connecting…",
  negotiating: "Found the sender — opening a direct connection…",
  connected: "Connected! Waiting for the sender to start…",
  transferring: "Receiving…",
  done: "All files received.",
};

export function ReceivePanel() {
  const [code, setCode] = useState("");
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
  const [zipping, setZipping] = useState(false);

  /**
   * Saves every file at once. Browsers rate-limit and sometimes silently drop
   * rapid programmatic downloads, so these are spaced out rather than fired in
   * a single loop — without the gap, Chrome delivers the first and discards the
   * rest, which looks exactly like a broken button.
   */
  function saveAll() {
    received.forEach((file, index) => {
      const url = objectUrls.get(file.id);
      if (!url) return;
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = url;
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 350);
    });
  }

  /**
   * Zips everything into one download. Stored, not deflated: these are files
   * someone just sent — usually already-compressed video, photos or PDFs —
   * so compressing costs seconds of main-thread work to save almost nothing.
   * Duplicate names get a numeric suffix, since a zip with two identical
   * entries is a corrupt zip.
   */
  async function downloadZip() {
    if (received.length === 0 || zipping) return;
    setZipping(true);
    setError(null);
    try {
      const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
      const usedNames = new Set<string>();

      for (const file of received) {
        let name = file.name;
        if (usedNames.has(name)) {
          const dot = name.lastIndexOf(".");
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : "";
          let n = 2;
          while (usedNames.has(`${stem} (${n})${ext}`)) n += 1;
          name = `${stem} (${n})${ext}`;
        }
        usedNames.add(name);
        entries[name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }];
      }

      const archive = await new Promise<Uint8Array>((resolve, reject) => {
        zip(entries, { level: 0 }, (err, data) => (err ? reject(err) : resolve(data)));
      });

      const url = URL.createObjectURL(new Blob([archive as BlobPart], { type: "application/zip" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `sharefilesfree-${received.length}-files.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on a delay: revoking immediately can cancel the download the
      // click just started, in Safari especially.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Could not build the zip. Try saving the files individually.");
    } finally {
      setZipping(false);
    }
  }

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

  // A code arriving via a shared link (/receive#123456) is a deliberate
  // click-through — connect right away. Read here rather than passed down from
  // the server component, because a fragment is never sent to the server: that
  // is the point of using one, and it keeps the code out of access logs.
  //
  // The fragment is also cleared from the address bar once read, so the code
  // doesn't linger in browser history or get handed on by a shared screenshot
  // of the URL bar.
  //
  // Deferred with setTimeout so the state updates inside connect() don't fire
  // synchronously during the effect (React flags that as a footgun even though
  // it's a one-time bootstrap).
  useEffect(() => {
    const fromHash = window.location.hash.replace(/^#/, "").trim();
    if (!/^\d{6}$/.test(fromHash)) return;
    window.history.replaceState(null, "", window.location.pathname);
    // Both state updates go inside the timeout: setting state synchronously in
    // an effect cascades renders, and this is a one-time bootstrap either way.
    const timer = setTimeout(() => {
      setCode(fromHash);
      connect(fromHash);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
        <label htmlFor="code-input" className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-55">
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
          className="w-full bg-lime-3 px-5 py-4 text-center text-[2.6rem] font-bold tabular-nums tracking-[0.2em] text-black outline-none placeholder:text-black/35 focus:outline-2 focus:outline-offset-2 focus:outline-red sm:text-5xl"
        />
        {error && (
          <p role="alert" className="bg-red px-4 py-3 text-[14px] font-semibold leading-[1.45] text-y-pale">
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
      <p role="status" aria-live="polite" className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
        {STATUS_LABEL[status] ?? status}
      </p>
      {error && (
        <p role="alert" className="bg-red px-4 py-3 text-[14px] font-semibold leading-[1.45] text-y-pale">
          {error}
        </p>
      )}

      {status === "transferring" && progress && (
        <div className="w-full">
          <div className="mb-2 flex items-baseline justify-between gap-4">
            <p className="truncate text-[14px] font-semibold text-black">{progress.name}</p>
            <p className="shrink-0 text-[13px] font-semibold tabular-nums text-black opacity-55">
              {formatBytes(progress.sent)} / {formatBytes(progress.size)}
            </p>
          </div>
          <ProgressBar fraction={progress.size ? progress.sent / progress.size : 0} />
        </div>
      )}

      {received.length > 1 && (
        // Only shown for more than one file — with a single file these two
        // buttons would both just repeat the Save beside it.
        <div className="flex w-full flex-wrap items-center gap-3">
          <Button onClick={saveAll}>Save all {received.length}</Button>
          <Button variant="ghost" onClick={downloadZip} disabled={zipping}>
            {zipping ? "Building zip…" : "Download as ZIP"}
          </Button>
        </div>
      )}

      {received.length > 0 && (
        // Alternating flat tints, not ruled rows: in this system the field
        // boundary is the divider, so a hairline would be a second grammar
        // saying the same thing.
        <ul className="flex w-full flex-col">
          {received.map((f, i) => (
            <li
              key={f.id}
              className={`flex items-center justify-between gap-4 px-4 py-3 ${i % 2 === 0 ? "bg-lime-pale" : "bg-lime-4"}`}
            >
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-black">{f.name}</span>
              <a
                href={objectUrls.get(f.id)}
                download={f.name}
                className="sff-nudge shrink-0 bg-red px-4 py-2.5 text-[11px] font-bold uppercase leading-none tracking-[0.12em] text-y-pale"
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
