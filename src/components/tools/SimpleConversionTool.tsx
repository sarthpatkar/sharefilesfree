"use client";

import { useState, type ReactNode } from "react";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

/**
 * Generic "pick file(s) → optionally configure → convert → get a result"
 * shell, shared by every tool whose UX is that simple shape (compress,
 * watermark, page numbers, Word/Excel↔PDF, PDF→PowerPoint/Markdown, …).
 * Only Organize/Split/Merge need bespoke UI (page-level thumbnails), so they
 * don't use this.
 */
export function SimpleConversionTool<Options>({
  accept,
  multiple = false,
  dropLabel,
  dropHint,
  convert,
  options,
  setOptions,
  renderOptions,
  convertLabel,
  compareSize = false,
  onSend,
}: {
  accept: string;
  multiple?: boolean;
  dropLabel: string;
  dropHint?: string;
  convert: (files: File[], options: Options) => Promise<File>;
  options: Options;
  setOptions: (o: Options) => void;
  renderOptions?: (options: Options, setOptions: (o: Options) => void) => ReactNode;
  convertLabel: string;
  /** Only meaningful for actual compression tools — shows a size-change badge on the result. */
  compareSize?: boolean;
  onSend: (file: File) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setStatus("processing");
    setError(null);
    try {
      const out = await convert(files, options);
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
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
    return <ToolResultCard file={result} originalSize={compareSize ? files[0]?.size : undefined} onSend={onSend} onReset={reset} />;
  }

  if (files.length === 0) {
    return <FileDropZone onFiles={setFiles} accept={accept} multiple={multiple} label={dropLabel} hint={dropHint} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-1 text-sm">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="truncate text-foreground">
            {f.name}
          </li>
        ))}
      </ul>
      {renderOptions?.(options, setOptions)}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={run} disabled={status === "processing"}>
          {status === "processing" ? "Working…" : convertLabel}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
