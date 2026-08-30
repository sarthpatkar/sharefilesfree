"use client";

import { pdfToPowerPoint } from "@/lib/tools/pdfToPowerPoint";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToPowerPointTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Each page becomes a slide image — visually accurate, but text on the slides isn't editable"
      convertOne={(file, opts, onProgress) => pdfToPowerPoint(file, onProgress)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to PowerPoint"
      onSend={onSend}
    />
  );
}
