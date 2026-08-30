"use client";

import { useState } from "react";
import { mergePdfs } from "@/lib/tools/mergePdfs";
import { formatBytes } from "@/lib/format";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

export function MergePdfsTool({ onSend }: { onSend: (file: File) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function run() {
    setStatus("processing");
    setError(null);
    try {
      const out = await mergePdfs(files);
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setStatus("idle");
    setError(null);
  }

  if (status === "done" && result) {
    return <ToolResultCard file={result} onSend={onSend} onReset={reset} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <FileDropZone
        onFiles={(picked) => setFiles((prev) => [...prev, ...picked])}
        accept="application/pdf"
        label="Drop PDFs here, or click to choose"
        hint="Reorder below — merged top to bottom"
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <span className="truncate text-foreground">
                {i + 1}. {f.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted">{formatBytes(f.size)}</span>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === files.length - 1} className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30">
                  ↓
                </button>
                <button type="button" onClick={() => remove(i)} className="rounded border border-border px-1.5 py-0.5 text-xs text-danger hover:underline">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      {files.length > 1 && (
        <div className="flex gap-3">
          <Button onClick={run} disabled={status === "processing"}>
            {status === "processing" ? "Merging…" : `Merge ${files.length} PDFs`}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Clear
          </Button>
        </div>
      )}
      {files.length === 1 && <p className="text-sm text-muted">Add at least one more PDF to merge.</p>}
    </div>
  );
}
