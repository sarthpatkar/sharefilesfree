"use client";

import { pdfToWordBasic } from "@/lib/tools/pdfToWord";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToWordTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Basic text recovery — pulls the words out, but does not preserve layout, columns, or images"
      convertOne={(file, opts, onProgress) => pdfToWordBasic(file, onProgress)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to Word (basic)"
      onSend={onSend}
    />
  );
}
