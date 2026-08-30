"use client";

import { pdfToMarkdown } from "@/lib/tools/pdfToMarkdown";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToMarkdownTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Headings and bullets are guessed from font size — works best on simply-formatted documents"
      convertOne={(file, opts, onProgress) => pdfToMarkdown(file, onProgress)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to Markdown"
      onSend={onSend}
    />
  );
}
