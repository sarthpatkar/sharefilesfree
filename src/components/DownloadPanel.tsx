"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";

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
        <p className="text-lg font-medium">⚠️ {error}</p>
        <p className="text-sm text-black/50 dark:text-white/50">Ask the sender for a fresh link.</p>
      </div>
    );
  }

  if (reportState === "reported") {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-medium">🚫 Reported</p>
        <p className="text-sm text-black/50 dark:text-white/50">This link has been disabled. Thanks for flagging it.</p>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <form onSubmit={submitPassword} className="flex flex-col items-center gap-4 text-center">
        <span className="text-3xl">🔒</span>
        <p className="text-sm text-black/70 dark:text-white/70">This file is password protected</p>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter password"
          className="w-56 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-center outline-none focus:border-emerald-500 dark:border-white/15"
        />
        {unlockError && <p className="text-sm text-red-600 dark:text-red-400">{unlockError}</p>}
        <button
          type="submit"
          disabled={unlocking}
          className="rounded-full bg-emerald-600 px-5 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {unlocking ? "Checking…" : "Unlock"}
        </button>
      </form>
    );
  }

  if (!meta) {
    return <p className="text-center text-sm text-black/50 dark:text-white/50">Looking up this file…</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="text-3xl">📦</span>
      <p className="max-w-xs truncate text-lg font-medium">{meta.name}</p>
      <p className="text-sm text-black/50 dark:text-white/50">{formatBytes(meta.size)}</p>
      <a
        href={meta.downloadUrl}
        className="rounded-full bg-emerald-600 px-6 py-2 font-medium text-white hover:bg-emerald-500"
      >
        Download
      </a>

      {reportState === "idle" && (
        <button
          type="button"
          onClick={() => setReportState("confirming")}
          className="text-xs text-black/40 hover:underline dark:text-white/40"
        >
          Report this file
        </button>
      )}
      {reportState === "confirming" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-black/50 dark:text-white/50">Disable this link for everyone? This can&apos;t be undone.</p>
          <div className="flex gap-3">
            <button type="button" onClick={submitReport} className="text-xs font-medium text-red-600 hover:underline dark:text-red-400">
              Yes, report it
            </button>
            <button type="button" onClick={() => setReportState("idle")} className="text-xs text-black/40 hover:underline dark:text-white/40">
              Cancel
            </button>
          </div>
        </div>
      )}
      {reportState === "submitting" && <p className="text-xs text-black/40 dark:text-white/40">Reporting…</p>}
      {reportState === "error" && <p className="text-xs text-red-600 dark:text-red-400">Couldn&apos;t submit the report — try again.</p>}
    </div>
  );
}
