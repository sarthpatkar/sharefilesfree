"use client";

import { useEffect, useMemo } from "react";
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
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const savedPct = originalSize ? Math.round((1 - file.size / originalSize) * 100) : null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background p-6 text-center">
      <p className="max-w-xs truncate font-medium text-foreground">{file.name}</p>
      <p className="text-sm text-muted">
        {formatBytes(file.size)}
        {savedPct !== null && savedPct > 0 && <span className="text-accent"> · {savedPct}% smaller</span>}
      </p>
      {/* Some inputs (already-compressed JPEGs, high-noise images, flat-color
          graphics better suited to PNG) genuinely don't shrink under lossy
          re-encoding — say so plainly instead of silently showing nothing,
          which reads as broken rather than as an honest result. */}
      {savedPct !== null && savedPct <= 0 && (
        <p className="text-xs text-muted">
          Not smaller this time — this file may already be efficiently compressed. Try a lower quality, or a
          different output format.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        <a
          href={url}
          download={file.name}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover active:scale-[0.98]"
        >
          <IconDownload className="h-4 w-4" /> Download
        </a>
        {onSend && (
          <button
            type="button"
            onClick={() => onSend(file)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover hover:underline"
          >
            <IconSend className="h-4 w-4" /> Send this file
          </button>
        )}
      </div>
      <button type="button" onClick={onReset} className="text-xs text-muted hover:underline">
        Start over
      </button>
    </div>
  );
}
