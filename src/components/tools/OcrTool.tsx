"use client";

import { useState } from "react";
import { runOcr, textToTxtFile, textToDocxFile, OCR_LANGUAGES } from "@/lib/tools/ocr";
import { FileDropZone } from "./FileDropZone";
import { ProgressBar } from "../ProgressBar";
import { Button } from "../Button";

type Status = "idle" | "processing" | "done" | "error";

export function OcrTool({ onSend }: { onSend?: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState("eng");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!file) return;
    setStatus("processing");
    setError(null);
    setProgress(0);
    try {
      const extracted = await runOcr(file, language, (current) => setProgress(current));
      setText(extracted);
      setStatus("done");
    } catch (e) {
      setError((e as Error).message);
      setStatus("error");
    } finally {
      setProgress(null);
    }
  }

  function reset() {
    setFile(null);
    setText("");
    setStatus("idle");
    setError(null);
  }

  async function download(format: "txt" | "docx") {
    if (!file) return;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    const outFile = format === "txt" ? await textToTxtFile(text, baseName) : await textToDocxFile(text, baseName);
    const url = URL.createObjectURL(outFile);
    const a = document.createElement("a");
    a.href = url;
    a.download = outFile.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function send() {
    if (!file || !onSend) return;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    onSend(await textToTxtFile(text, baseName));
  }

  if (status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Recognized text — edit before downloading if needed
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => download("txt")}>Download .txt</Button>
          <Button variant="ghost" onClick={() => download("docx")}>
            Download .docx
          </Button>
          {onSend && (
            <Button variant="ghost" onClick={send}>
              Send this file
            </Button>
          )}
        </div>
        <button type="button" onClick={reset} className="self-start text-xs text-muted hover:underline">
          Start over
        </button>
      </div>
    );
  }

  if (!file) {
    return (
      <FileDropZone
        onFiles={(f) => setFile(f[0])}
        accept="application/pdf,image/*"
        multiple={false}
        label="Drop a scanned PDF or a photo here, or click to choose"
        hint="First use downloads a language model (~10-15MB, cached afterward) — may take a moment"
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="truncate text-sm text-foreground">{file.name}</p>
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        Document language
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={status === "processing"}
          className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent disabled:opacity-50"
        >
          {OCR_LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
        <span className="text-xs">Picking the right language noticeably improves accuracy — each is its own model, downloaded only when selected.</span>
      </label>

      {status === "processing" && progress !== null && (
        <div>
          <ProgressBar fraction={progress / 100} />
          <p role="status" aria-live="polite" className="mt-1 text-center text-xs text-muted">
            {progress}% complete
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button onClick={run} disabled={status === "processing"}>
          {status === "processing" ? "Recognizing…" : "Extract text"}
        </Button>
        <Button variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
