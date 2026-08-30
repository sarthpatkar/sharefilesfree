"use client";

import { useState } from "react";
import { pdfToPowerPoint } from "@/lib/tools/pdfToPowerPoint";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToPowerPointTool({ onSend }: { onSend?: (file: File) => void }) {
  const [resolutionScale, setResolutionScale] = useState(2);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Each page becomes a slide image — visually accurate, but text on the slides isn't editable"
      convertOne={(file, opts, onProgress) => pdfToPowerPoint(file, opts, onProgress)}
      options={resolutionScale}
      setOptions={setResolutionScale}
      convertLabel="Convert to PowerPoint"
      onSend={onSend}
      renderOptions={(value, set) => (
        <label className="flex flex-col gap-1.5 text-sm text-muted">
          Slide image resolution ({value.toFixed(1)}×)
          <input type="range" min={1} max={3} step={0.5} value={value} onChange={(e) => set(Number(e.target.value))} className="accent-accent" />
          <span className="text-xs">Higher looks sharper on a big screen but makes the file larger.</span>
        </label>
      )}
    />
  );
}
