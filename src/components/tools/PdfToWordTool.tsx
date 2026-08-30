"use client";

import { useState } from "react";
import { pdfToWordBasic, type PdfToWordOptions } from "@/lib/tools/pdfToWord";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: PdfToWordOptions = { headingSensitivity: 0.85 };

export function PdfToWordTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<PdfToWordOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Basic text recovery — layout and images aren't preserved"
      convertOne={(file, opts, onProgress) => pdfToWordBasic(file, opts, onProgress)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to Word (basic)"
      onSend={onSend}
      renderOptions={(value, set) => (
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Heading detection ({value.headingSensitivity < 0.75 ? "more headings" : value.headingSensitivity > 0.9 ? "fewer headings" : "balanced"})
          <input
            type="range"
            min={0.65}
            max={0.95}
            step={0.05}
            value={value.headingSensitivity}
            onChange={(e) => set({ ...value, headingSensitivity: Number(e.target.value) })}
            className="accent-accent"
          />
          <span className="text-xs">Lines are guessed as headings by how much larger their font is than the rest of the document.</span>
        </label>
      )}
    />
  );
}
