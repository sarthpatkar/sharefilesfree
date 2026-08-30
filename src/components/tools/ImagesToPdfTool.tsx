"use client";

import { useState } from "react";
import { imagesToPdf } from "@/lib/tools/imagesToPdf";
import { formatBytes } from "@/lib/format";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

export function ImagesToPdfTool({ onSend }: { onSend: (file: File) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("processing");
    setError(null);
    try {
      const out = await imagesToPdf(files);
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
        accept="image/*"
        label="Drop images here, or click to choose"
        hint="Combined into one PDF, in the order added"
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
      {files.length > 0 && (
        <div className="flex gap-3">
          <Button onClick={run} disabled={status === "processing"}>
            {status === "processing" ? "Converting…" : `Convert ${files.length} image${files.length === 1 ? "" : "s"} to PDF`}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
