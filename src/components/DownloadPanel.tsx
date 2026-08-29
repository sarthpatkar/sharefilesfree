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

export function DownloadPanel({ token }: { token: string }) {
  const [meta, setMeta] = useState<FileMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/file/${token}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Something went wrong.");
        setMeta(body);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-lg font-medium">⚠️ {error}</p>
        <p className="text-sm text-black/50 dark:text-white/50">Ask the sender for a fresh link.</p>
      </div>
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
    </div>
  );
}
