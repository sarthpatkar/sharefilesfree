"use client";

import { useEffect, useState } from "react";
import { formatBytes } from "@/lib/format";
import { IconDownload, IconSend } from "../icons";

/** Shared "here's your file" result screen for every tool — download it, send it via the existing P2P/link flow, or start over. */
export function ToolResultCard({
  file,
  originalSize,
  onSend,
  onReset,
}: {
  file: File;
  originalSize?: number;
  onSend?: (file: File) => void;
  onReset: () => void;
}) {
  // Deliberately NOT `useMemo(() => URL.createObjectURL(file), [file])` — that
  // pattern creates the URL during render, which React 18 Strict Mode's dev-only
  // double-render can leave pointing at an already-revoked URL (verified: traced
  // two URLs being created but the *revoked* one ending up in the committed
  // render). Creating it inside an effect and pushing it through state instead
  // means the last effect invocation's fresh URL always wins.
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    // Deferred: React flags a synchronous setState call in an effect body as a
    // footgun in general, even though this one is intentional and correct.
    const timer = setTimeout(() => setUrl(objectUrl), 0);
    return () => {
      clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  const savedPct = originalSize ? Math.round((1 - file.size / originalSize) * 100) : null;

  return (
    // Ruled block, not a bordered card — this already sits inside a section, and
    // a box inside a box is the nested-card look we avoid site-wide.
    <div className="flex flex-col gap-6 border-t-2 border-ink pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="min-w-0 flex-1 truncate font-display text-xl font-bold tracking-[-0.015em] text-red">
          {file.name}
        </p>
        <p className="font-mono text-xs tabular-nums text-red">
          {formatBytes(file.size)}
          {savedPct !== null && savedPct > 0 && <span className="ml-2 text-accent">−{savedPct}%</span>}
        </p>
      </div>

      {/* Some inputs (already-compressed JPEGs, high-noise images, flat-colour
          graphics better suited to PNG) genuinely don't shrink under lossy
          re-encoding — say so plainly instead of silently showing nothing,
          which reads as broken rather than as an honest result. */}
      {savedPct !== null && savedPct <= 0 && (
        <p className="border-l-2 border-rule-strong pl-3 text-sm text-red">
          Not smaller this time — this file may already be efficiently compressed. Try a lower quality, or a
          different output format.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-7 gap-y-3">
        <a
          href={url ?? undefined}
          download={file.name}
          aria-disabled={!url}
          className={`sff-press inline-flex items-center gap-2 bg-ink px-5 py-3 text-sm font-medium leading-none text-paper shadow-[4px_4px_0_var(--accent)] hover:bg-accent ${
            url ? "" : "pointer-events-none opacity-40"
          }`}
        >
          <IconDownload className="h-4 w-4" /> Download
        </a>
        {onSend && (
          <button
            type="button"
            onClick={() => onSend(file)}
            className="link inline-flex items-center gap-2 py-1 text-sm font-medium text-red"
          >
            <IconSend className="h-4 w-4" /> Send this file
          </button>
        )}
        <button type="button" onClick={onReset} className="link py-1 text-sm text-red">
          Start over
        </button>
      </div>
    </div>
  );
}
