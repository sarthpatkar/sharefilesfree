"use client";

import { useState, type DragEvent } from "react";
import { imagesToPdf, type ImagesToPdfOptions, type PageSizeMode, type Orientation } from "@/lib/tools/imagesToPdf";
import { formatBytes } from "@/lib/format";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

const DEFAULTS: ImagesToPdfOptions = { pageSize: "fit-image", orientation: "portrait", marginPt: 0 };

export function ImagesToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [options, setOptions] = useState<ImagesToPdfOptions>(DEFAULTS);
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

  function moveTo(from: number, to: number) {
    setFiles((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function remove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function onDrop(e: DragEvent<HTMLLIElement>, index: number) {
    e.preventDefault();
    if (dragIndex !== null) moveTo(dragIndex, index);
    setDragIndex(null);
  }

  async function run() {
    setStatus("processing");
    setError(null);
    try {
      const out = await imagesToPdf(files, options);
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
        hint="Drag to reorder below — combined top to bottom"
      />
      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={() => setDragIndex(null)}
              className={`flex cursor-grab items-center justify-between gap-3 border px-3 py-2 active:cursor-grabbing ${
                dragIndex === i ? "border-accent opacity-50" : "border-border"
              }`}
            >
              <span className="truncate text-foreground">
                {i + 1}. {f.name}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-muted">{formatBytes(f.size)}</span>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${f.name} up`}
                  className="border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === files.length - 1}
                  aria-label={`Move ${f.name} down`}
                  className="border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${f.name}`}
                  className="border border-border px-1.5 py-0.5 text-xs text-danger hover:underline"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <label className="flex flex-col gap-1.5">
            Page size
            <select
              value={options.pageSize}
              onChange={(e) => setOptions({ ...options, pageSize: e.target.value as PageSizeMode })}
              className="border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="fit-image">Fit to each image (no cropping or letterboxing)</option>
              <option value="a4">A4</option>
              <option value="letter">US Letter</option>
            </select>
          </label>
          {options.pageSize !== "fit-image" && (
            <>
              <fieldset className="flex gap-4">
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={options.orientation === "portrait"}
                    onChange={() => setOptions({ ...options, orientation: "portrait" as Orientation })}
                    className="accent-accent"
                  />
                  Portrait
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    checked={options.orientation === "landscape"}
                    onChange={() => setOptions({ ...options, orientation: "landscape" as Orientation })}
                    className="accent-accent"
                  />
                  Landscape
                </label>
              </fieldset>
              <label className="flex flex-col gap-1.5">
                Margin ({options.marginPt}pt)
                <input
                  type="range"
                  min={0}
                  max={72}
                  step={4}
                  value={options.marginPt}
                  onChange={(e) => setOptions({ ...options, marginPt: Number(e.target.value) })}
                  className="accent-accent"
                />
              </label>
            </>
          )}
        </div>
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
