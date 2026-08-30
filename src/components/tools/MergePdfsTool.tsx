"use client";

import { useState, type DragEvent } from "react";
import { mergePdfs, type MergeInput } from "@/lib/tools/mergePdfs";
import { formatBytes } from "@/lib/format";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

interface Entry {
  file: File;
  pageRange: string;
}

export function MergePdfsTool({ onSend }: { onSend?: (file: File) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function move(index: number, dir: -1 | 1) {
    setEntries((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveTo(from: number, to: number) {
    setEntries((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function remove(index: number) {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }

  function setRange(index: number, pageRange: string) {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, pageRange } : e)));
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
      const inputs: MergeInput[] = entries.map((e) => ({ file: e.file, pageRange: e.pageRange }));
      const out = await mergePdfs(inputs);
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setEntries([]);
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
        onFiles={(picked) => setEntries((prev) => [...prev, ...picked.map((file) => ({ file, pageRange: "" }))])}
        accept="application/pdf"
        label="Drop PDFs here, or click to choose"
        hint="Drag to reorder below — merged top to bottom"
      />
      {entries.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm">
          {entries.map((entry, i) => (
            <li
              key={`${entry.file.name}-${i}`}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, i)}
              onDragEnd={() => setDragIndex(null)}
              className={`flex cursor-grab flex-col gap-2 border px-3 py-2 active:cursor-grabbing ${
                dragIndex === i ? "border-accent opacity-50" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-foreground">
                  {i + 1}. {entry.file.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-muted">{formatBytes(entry.file.size)}</span>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    aria-label={`Move ${entry.file.name} up`}
                    className="border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === entries.length - 1}
                    aria-label={`Move ${entry.file.name} down`}
                    className="border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove ${entry.file.name}`}
                    className="border border-border px-1.5 py-0.5 text-xs text-danger hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted">
                Pages to include
                <input
                  value={entry.pageRange}
                  onChange={(e) => setRange(i, e.target.value)}
                  placeholder="all pages"
                  className="w-32 border border-border bg-transparent px-2 py-1 text-foreground outline-none focus:border-accent"
                />
              </label>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {entries.length > 1 && (
        <div className="flex gap-3">
          <Button onClick={run} disabled={status === "processing"}>
            {status === "processing" ? "Merging…" : `Merge ${entries.length} PDFs`}
          </Button>
          <Button variant="ghost" onClick={reset}>
            Clear
          </Button>
        </div>
      )}
      {entries.length === 1 && <p className="text-sm text-muted">Add at least one more PDF to merge.</p>}
    </div>
  );
}
