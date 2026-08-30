"use client";

import { useState, type ReactNode } from "react";
import { zipSync } from "fflate";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { ProgressBar } from "../ProgressBar";
import { Button } from "../Button";

/**
 * Generic "pick file(s) → optionally configure → convert → get a result"
 * shell, shared by most tools whose UX is that simple shape. Only
 * Organize/Split/Merge need bespoke UI (page-level thumbnails), so they
 * don't use this.
 *
 * `allowBatch` lets the same tool process several files in one go — each
 * converted independently with `convertOne`, then zipped together into a
 * single download (one input in, one output out; no zip needed).
 */
export function SimpleConversionTool<Options>({
  accept,
  allowBatch = false,
  dropLabel,
  dropHint,
  convertOne,
  options,
  setOptions,
  renderOptions,
  convertLabel,
  compareSize = false,
  onSend,
}: {
  accept: string;
  allowBatch?: boolean;
  dropLabel: string;
  dropHint?: string;
  convertOne: (file: File, options: Options, onProgress?: (current: number, total: number) => void) => Promise<File>;
  options: Options;
  setOptions: (o: Options) => void;
  renderOptions?: (options: Options, setOptions: (o: Options) => void) => ReactNode;
  convertLabel: string;
  /** Only meaningful for actual compression tools — shows a size-change badge on the result. */
  compareSize?: boolean;
  onSend?: (file: File) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ label: string; fraction: number } | null>(null);

  async function run() {
    setStatus("processing");
    setError(null);
    setProgress(null);
    try {
      if (files.length === 1) {
        const out = await convertOne(files[0], options, (current, total) =>
          setProgress({ label: `${Math.round((current / total) * 100)}% complete`, fraction: current / total }),
        );
        setResult(out);
      } else {
        const entries: Record<string, Uint8Array> = {};
        for (let i = 0; i < files.length; i++) {
          setProgress({ label: `File ${i + 1} of ${files.length}: ${files[i].name}`, fraction: i / files.length });
          const out = await convertOne(files[i], options);
          const bytes = new Uint8Array(await out.arrayBuffer());
          // Guard against two inputs producing the same output filename.
          entries[entries[out.name] ? `${i + 1}-${out.name}` : out.name] = bytes;
        }
        const zipped = zipSync(entries);
        setResult(new File([zipped as BlobPart], "converted-files.zip", { type: "application/zip" }));
      }
      setStatus("done");
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }

  function reset() {
    setFiles([]);
    setResult(null);
    setStatus("idle");
    setError(null);
  }

  if (status === "done" && result) {
    return <ToolResultCard file={result} originalSize={compareSize && files.length === 1 ? files[0]?.size : undefined} onSend={onSend} onReset={reset} />;
  }

  if (files.length === 0) {
    return <FileDropZone onFiles={setFiles} accept={accept} multiple={allowBatch} label={dropLabel} hint={dropHint} />;
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
      {allowBatch && files.length > 1 && (
        <p className="text-xs text-muted">{files.length} files will be processed and zipped together into one download.</p>
      )}
      {renderOptions?.(options, setOptions)}
      {progress && (
        <div>
          <ProgressBar fraction={progress.fraction} />
          <p className="mt-1 text-xs text-muted">{progress.label}</p>
        </div>
      )}
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
