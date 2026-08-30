"use client";

import { useState } from "react";
import { compressImage, type CompressFormat } from "@/lib/tools/compressImage";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

export function CompressImageTool({ onSend }: { onSend?: (file: File) => void }) {
  const [original, setOriginal] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState<CompressFormat>("jpeg");
  const [status, setStatus] = useState<"idle" | "picked" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!original) return;
    setStatus("processing");
    setError(null);
    try {
      const out = await compressImage(original, { quality, format, maxWidth: 2400 });
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setOriginal(null);
    setResult(null);
    setStatus("idle");
    setError(null);
  }

  if (status === "done" && result) {
    return <ToolResultCard file={result} originalSize={original?.size} onSend={onSend} onReset={reset} />;
  }

  if (!original) {
    return (
      <FileDropZone
        onFiles={(files) => {
          setOriginal(files[0]);
          setStatus("picked");
        }}
        accept="image/*"
        multiple={false}
        label="Drop an image here, or click to choose"
        hint="JPG, PNG, or WebP"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-sm text-foreground">{original.name}</p>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Output format
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as CompressFormat)}
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
        >
          <option value="jpeg">JPEG — smallest, no transparency</option>
          <option value="webp">WebP — small, keeps transparency</option>
          <option value="png">PNG — lossless, resize only</option>
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Quality ({Math.round(quality * 100)}%)
        <input
          type="range"
          min={0.2}
          max={0.95}
          step={0.05}
          value={quality}
          disabled={format === "png"}
          onChange={(e) => setQuality(Number(e.target.value))}
          className="accent-accent disabled:opacity-40"
        />
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={run} disabled={status === "processing"}>
          {status === "processing" ? "Compressing…" : "Compress"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
