"use client";

import { useState } from "react";
import { pdfToMarkdown, type PdfToMarkdownOptions } from "@/lib/tools/pdfToMarkdown";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: PdfToMarkdownOptions = { pageSeparators: false };

export function PdfToMarkdownTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<PdfToMarkdownOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Headings and bullets are guessed from font size — works best on simply-formatted documents"
      convertOne={(file, opts, onProgress) => pdfToMarkdown(file, opts, onProgress)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to Markdown"
      onSend={onSend}
      renderOptions={(value, set) => (
        <label className="flex items-center gap-1.5 text-sm text-muted">
          <input type="checkbox" checked={value.pageSeparators} onChange={(e) => set({ ...value, pageSeparators: e.target.checked })} className="accent-accent" />
          Insert a divider between each original page
        </label>
      )}
    />
  );
}
