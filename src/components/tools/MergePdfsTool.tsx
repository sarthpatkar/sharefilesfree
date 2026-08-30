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
        hint="Joined in the order added"
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex justify-between gap-3">
              <span className="truncate text-foreground">
                {i + 1}. {f.name}
              </span>
              <span className="shrink-0 text-muted">{formatBytes(f.size)}</span>
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
