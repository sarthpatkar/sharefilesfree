"use client";

import { useEffect, useState } from "react";
import { loadPdf, renderPageToDataUrl } from "@/lib/tools/pdfjs";
import { splitPdfRange, splitPdfEveryPage, splitPdfEveryNPages, splitPdfCustomRanges } from "@/lib/tools/splitPdf";
import { FileDropZone } from "./FileDropZone";
import { ToolResultCard } from "./ToolResultCard";
import { Button } from "../Button";

export function SplitPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [mode, setMode] = useState<"range" | "every-page" | "every-n" | "custom-ranges">("range");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [chunkSize, setChunkSize] = useState(1);
  const [customRanges, setCustomRanges] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "processing" | "done" | "error">("idle");
  const [result, setResult] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return;
    (async () => {
      const pdf = await loadPdf(file);
      const previews: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        previews.push((await renderPageToDataUrl(pdf, i, 0.3)).dataUrl);
      }
      setThumbs(previews);
      setTo(pdf.numPages);
      setStatus("ready");
    })().catch((e) => {
      setError((e as Error).message);
      setStatus("error");
    });
  }, [file]);

  async function run() {
    if (!file) return;
    setStatus("processing");
    setError(null);
    try {
      const out =
        mode === "range"
          ? await splitPdfRange(file, from, to)
          : mode === "every-n"
            ? await splitPdfEveryNPages(file, chunkSize)
            : mode === "custom-ranges"
              ? await splitPdfCustomRanges(file, customRanges)
              : await splitPdfEveryPage(file);
      setResult(out);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    }
  }

  function reset() {
    setFile(null);
    setThumbs([]);
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
      />
    );
  }

  if (status === "loading") {
    return <p className="text-sm text-muted">Reading pages…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
        {thumbs.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt={`Page ${i + 1}`} className="rounded border border-border" />
        ))}
      </div>
      <p className="text-sm text-muted">{thumbs.length} pages</p>

      <fieldset className="flex flex-col gap-2 text-sm text-muted">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "range"} onChange={() => setMode("range")} className="accent-accent" />
          Extract a page range
        </label>
        {mode === "range" && (
          <div className="flex items-center gap-2 pl-6 text-foreground">
            <input
              type="number"
              min={1}
              max={thumbs.length}
              value={from}
              onChange={(e) => setFrom(Number(e.target.value))}
              className="w-16 rounded-lg border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
            />
            <span className="text-muted">to</span>
            <input
              type="number"
              min={1}
              max={thumbs.length}
              value={to}
              onChange={(e) => setTo(Number(e.target.value))}
              className="w-16 rounded-lg border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
            />
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "every-n"} onChange={() => setMode("every-n")} className="accent-accent" />
          Split into fixed-size chunks
        </label>
        {mode === "every-n" && (
          <div className="flex items-center gap-2 pl-6 text-foreground">
            <input
              type="number"
              min={1}
              max={thumbs.length}
              value={chunkSize}
              onChange={(e) => setChunkSize(Number(e.target.value))}
              className="w-16 rounded-lg border border-border bg-transparent px-2 py-1 outline-none focus:border-accent"
            />
            <span className="text-muted">pages per file (downloads a .zip)</span>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "custom-ranges"} onChange={() => setMode("custom-ranges")} className="accent-accent" />
          Extract several ranges at once
        </label>
        {mode === "custom-ranges" && (
          <div className="pl-6">
            <input
              value={customRanges}
              onChange={(e) => setCustomRanges(e.target.value)}
              placeholder="e.g. 1-3, 5, 8-10"
              className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 text-foreground outline-none focus:border-accent"
            />
            <p className="mt-1 text-xs">Each group becomes its own PDF, bundled into one .zip.</p>
          </div>
        )}
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "every-page"} onChange={() => setMode("every-page")} className="accent-accent" />
          Split into individual pages (downloads a .zip)
        </label>
      </fieldset>

      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-3">
        <Button onClick={run} disabled={status === "processing"}>
          {status === "processing" ? "Splitting…" : "Split"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
