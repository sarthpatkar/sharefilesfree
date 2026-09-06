"use client";

import { useState } from "react";
import { csvToPdf, CSV_TO_PDF_DEFAULTS, type CsvToPdfOptions } from "@/lib/tools/csvToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function CsvToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<CsvToPdfOptions>(CSV_TO_PDF_DEFAULTS);
  return (
    <SimpleConversionTool
      accept=".csv,text/csv"
      allowBatch
      dropLabel="Drop CSV files here, or click to choose"
      dropHint="Quoted fields, embedded commas and line breaks are all parsed properly"
      convertOne={(file, opts) => csvToPdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to PDF"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.orientation === "landscape"} onChange={() => set({ ...value, orientation: "landscape" })} className="accent-accent" />
              Landscape
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.orientation === "portrait"} onChange={() => set({ ...value, orientation: "portrait" })} className="accent-accent" />
              Portrait
            </label>
          </fieldset>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={value.firstRowIsHeader} onChange={(e) => set({ ...value, firstRowIsHeader: e.target.checked })} className="accent-accent" />
            First row is a heading row
          </label>
        </div>
      )}
    />
  );
}
