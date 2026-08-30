"use client";

import { pdfToExcelBasic } from "@/lib/tools/pdfToExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToExcelTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Basic text-per-line extraction — not real table/column detection (PDFs have no concept of cells)"
      convertOne={(file, opts, onProgress) => pdfToExcelBasic(file, onProgress)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to Excel (basic)"
      onSend={onSend}
    />
  );
}
