"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";
import { Button } from "./Button";
import { AdGate } from "./ads/AdGate";
import { adsEnabled } from "./ads/adNetwork";
import { AdSlot } from "./ads/AdSlot";
import { IconWarning, IconBlocked, IconLock, IconPackage } from "./icons";

interface FileMeta {
  name: string;
  size: number;
  mime: string;
  expiresAt: number;
  downloadUrl: string;
}

type ReportState = "idle" | "confirming" | "submitting" | "reported" | "error";

export function DownloadPanel({ token }: { token: string }) {
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportState, setReportState] = useState<ReportState>("idle");
  // Unlike the upload gate, this one is client-side only and deliberately so:
  // R2 charges nothing for egress, so there is no cost here to protect — only
  // revenue to earn. Enforcing it server-side would mean withholding the
  // presigned URL behind a receipt, which buys nothing and adds a way for the
  // download to fail.
  // Starts already passed where there are no ads to show, so a deployment
  // without an ad account keeps the single-click download it has today.
  const [downloadGate, setDownloadGate] = useState<"idle" | "playing" | "passed">(() =>
    adsEnabled() ? "idle" : "passed",
  );

  useEffect(() => {
    fetch(`/api/file/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Something went wrong.");
        if (body.requiresPassword) setRequiresPassword(true);
        else setMeta(body);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    fetch(`/api/file/${token}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Incorrect password.");
        setMeta(body);
        setRequiresPassword(false);
      })
      .catch((e) => setUnlockError(e.message))
      .finally(() => setUnlocking(false));
  }

  function submitReport() {
    setReportState("submitting");
    fetch(`/api/report/${token}`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setReportState("reported");
      })
      .catch(() => setReportState("error"));
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <IconWarning className="h-7 w-7 text-danger" />
        <p className="text-lg font-medium text-foreground">{error}</p>
        <p className="text-sm text-muted">Ask the sender for a fresh link.</p>
      </div>
    );
  }

  if (reportState === "reported") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <IconBlocked className="h-7 w-7 text-danger" />
        <p className="text-lg font-medium text-foreground">Reported</p>
        <p className="text-sm text-muted">This link has been disabled. Thanks for flagging it.</p>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <form onSubmit={submitPassword} className="flex flex-col items-center gap-4 text-center">
        <IconLock className="h-7 w-7 text-muted" />
        <p className="text-sm text-foreground">This file is password protected</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-56 border border-border bg-transparent px-3 py-2 text-center text-foreground outline-none placeholder:text-muted/70 focus:border-accent"
        />
        {unlockError && <p className="text-sm text-danger">{unlockError}</p>}
        <Button type="submit" disabled={unlocking}>
          {unlocking ? "Checking…" : "Unlock"}
        </Button>
      </form>
    );
  }

  if (!meta) {
    return <p className="text-center text-sm text-muted">Looking up this file…</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <IconPackage className="h-8 w-8 text-accent" />
      <p className="max-w-xs truncate text-lg font-medium text-foreground">{meta.name}</p>
      <p className="text-sm text-muted">{formatBytes(meta.size)}</p>
      {downloadGate === "playing" ? (
        <div className="w-full max-w-sm text-left">
          <AdGate
            purpose="link-download"
            waitingFor="Your download"
            onPass={() => setDownloadGate("passed")}
            onCancel={() => setDownloadGate("idle")}
          />
        </div>
      ) : downloadGate === "passed" ? (
        <a
          href={meta.downloadUrl}
          className="inline-flex items-center justify-center bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground shadow-[4px_4px_0_var(--ink)] sff-press hover:bg-accent-hover"
        >
          Download
        </a>
      ) : (
        <Button onClick={() => setDownloadGate("playing")}>Get this file</Button>
      )}

      <AdSlot slotId="download-page" format="leaderboard" className="mt-2" />

      {reportState === "idle" && (
        <button type="button" onClick={() => setReportState("confirming")} className="text-xs text-muted hover:text-foreground hover:underline">
          Report this file
        </button>
      )}
      {reportState === "confirming" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted">Disable this link for everyone? This can&apos;t be undone.</p>
          <div className="flex gap-3">
            <button type="button" onClick={submitReport} className="text-xs font-medium text-danger hover:underline">
              Yes, report it
            </button>
            <button type="button" onClick={() => setReportState("idle")} className="text-xs text-muted hover:underline">
              Cancel
            </button>
          </div>
        </div>
      )}
      {reportState === "submitting" && <p className="text-xs text-muted">Reporting…</p>}
      {reportState === "error" && <p className="text-xs text-danger">Couldn&apos;t submit the report — try again.</p>}
    </div>
  );
}
