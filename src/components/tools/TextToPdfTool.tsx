"use client";

import { useState } from "react";
import { textToPdf, TEXT_TO_PDF_DEFAULTS, type TextToPdfOptions } from "@/lib/tools/textToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function TextToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<TextToPdfOptions>(TEXT_TO_PDF_DEFAULTS);
  return (
    <SimpleConversionTool
      accept=".txt,.log,.md,text/plain,text/markdown"
      allowBatch
      dropLabel="Drop text files here, or click to choose"
      dropHint="Plain text, logs and Markdown — the text stays selectable in the PDF, not turned into a picture"
      convertOne={(file, opts) => textToPdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to PDF"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.pageSize === "a4"} onChange={() => set({ ...value, pageSize: "a4" })} className="accent-accent" />
              A4
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.pageSize === "letter"} onChange={() => set({ ...value, pageSize: "letter" })} className="accent-accent" />
              US Letter
            </label>
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.monospace} onChange={(e) => set({ ...value, monospace: e.target.checked })} className="accent-accent" />
            Monospaced font — keeps logs and code aligned
          </label>
          <label className="flex flex-col gap-1.5">
            Text size ({value.fontSize}pt)
            <input type="range" min={8} max={16} value={value.fontSize} onChange={(e) => set({ ...value, fontSize: Number(e.target.value) })} className="accent-accent" />
          </label>
        </div>
      )}
    />
  );
}
