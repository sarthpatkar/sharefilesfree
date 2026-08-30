"use client";

import { useEffect, useState, type DragEvent } from "react";
import { loadPdf, renderPageToDataUrl } from "@/lib/tools/pdfjs";
import { organizePdf, type PageEntry } from "@/lib/tools/organizePdf";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

interface PageState extends PageEntry {
  /** Unique per on-screen entry (not the original page index) — lets a duplicated page get its own React key. */
  id: number;
  thumb: string;
  deleted: boolean;
}

let nextPageStateId = 0;

export function OrganizePdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageState[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    (async () => {
      const pdf = await loadPdf(file);
      const loaded: PageState[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const { dataUrl } = await renderPageToDataUrl(pdf, i, 0.35);
        loaded.push({ id: nextPageStateId++, originalIndex: i - 1, addRotation: 0, thumb: dataUrl, deleted: false });
      }
      setPages(loaded);
      setStatus("ready");
    })().catch((e) => {
      setError((e as Error).message);
      setStatus("error");
    });
  }, [file]);

  function move(index: number, dir: -1 | 1) {
    setPages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveTo(from: number, to: number) {
    setPages((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onDrop(e: DragEvent<HTMLDivElement>, index: number) {
    e.preventDefault();
    if (dragIndex !== null) moveTo(dragIndex, index);
    setDragIndex(null);
  }

  function rotate(index: number) {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, addRotation: (((p.addRotation + 90) % 360) as PageEntry["addRotation"]) } : p)));
  }

  function toggleDelete(index: number) {
    setPages((prev) => prev.map((p, i) => (i === index ? { ...p, deleted: !p.deleted } : p)));
  }

  function duplicate(index: number) {
    setPages((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, { ...prev[index], id: nextPageStateId++ });
      return next;
    });
  }

  async function run() {
    if (!file) return;
    const kept = pages.filter((p) => !p.deleted);
    if (kept.length === 0) {
      setError("Keep at least one page.");
      return;
    }
    setStatus("processing");
    setError(null);
    try {
      const out = await organizePdf(file, kept.map(({ originalIndex, addRotation }) => ({ originalIndex, addRotation })));
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setFile(null);
    setPages([]);
    setResult(null);
    setStatus("idle");
    setError(null);
  }

  if (status === "done" && result) {
    return <ToolResultCard file={result} onSend={onSend} onReset={reset} />;
  }

  if (!file) {
    return (
      <FileDropZone
        onFiles={(f) => {
          setFile(f[0]);
          setStatus("loading");
          setError(null);
        }}
        accept="application/pdf"
        multiple={false}
        label="Drop a PDF here, or click to choose"
        hint="Drag to reorder, rotate, or delete pages"
      />
    );
  }

  if (status === "loading") {
    return <p className="text-sm text-muted">Reading pages…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {pages.map((page, i) => (
          <div
            key={page.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, i)}
            onDragEnd={() => setDragIndex(null)}
            className={`flex cursor-grab flex-col items-center gap-1 rounded-lg border p-1.5 active:cursor-grabbing ${
              page.deleted ? "opacity-30" : ""
            } ${dragIndex === i ? "border-accent" : "border-border"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.thumb}
              alt={`Page ${page.originalIndex + 1}`}
              className="rounded border border-border"
              style={{ transform: `rotate(${page.addRotation}deg)` }}
            />
            <span className="text-xs text-muted">#{page.originalIndex + 1}</span>
            <div className="flex flex-wrap justify-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move page ${page.originalIndex + 1} earlier`}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === pages.length - 1}
                aria-label={`Move page ${page.originalIndex + 1} later`}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => rotate(i)}
                aria-label={`Rotate page ${page.originalIndex + 1}`}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
              >
                ⟳
              </button>
              <button
                type="button"
                onClick={() => duplicate(i)}
                aria-label={`Duplicate page ${page.originalIndex + 1}`}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-muted hover:text-foreground"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => toggleDelete(i)}
                aria-label={`${page.deleted ? "Restore" : "Delete"} page ${page.originalIndex + 1}`}
                className="rounded border border-border px-1.5 py-0.5 text-xs text-danger hover:underline"
              >
                {page.deleted ? "Undo" : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={run} disabled={status === "processing"}>
          {status === "processing" ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
