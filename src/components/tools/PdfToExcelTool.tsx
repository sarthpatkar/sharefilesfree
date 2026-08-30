"use client";

import { useState } from "react";
import { pdfToExcelBasic, type PdfToExcelOptions } from "@/lib/tools/pdfToExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: PdfToExcelOptions = { oneSheetPerPage: false, splitColumns: false };

export function PdfToExcelTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<PdfToExcelOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      dropHint="Basic text-per-line extraction — not real table/column detection (PDFs have no concept of cells)"
      convertOne={(file, opts, onProgress) => pdfToExcelBasic(file, opts, onProgress)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to Excel (basic)"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-2 text-sm text-muted">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={!value.oneSheetPerPage}
              onChange={(e) => set({ ...value, oneSheetPerPage: !e.target.checked })}
              className="accent-accent"
            />
            Combine every page into one sheet (with a Page column)
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={value.splitColumns} onChange={(e) => set({ ...value, splitColumns: e.target.checked })} className="accent-accent" />
            Try to split into columns wherever there are 2+ spaces
          </label>
        </div>
      )}
    />
  );
}
