"use client";

import { pdfToExcelBasic } from "@/lib/tools/pdfToExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToExcelTool({ onSend }: { onSend: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      dropLabel="Drop a PDF here, or click to choose"
      dropHint="Basic text-per-line extraction — not real table/column detection (PDFs have no concept of cells)"
      convert={(files) => pdfToExcelBasic(files[0])}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to Excel (basic)"
      onSend={onSend}
    />
  );
}
