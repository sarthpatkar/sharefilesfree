"use client";

import { useState } from "react";
import { csvToExcel, excelToCsv } from "@/lib/tools/csvExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

type Mode = "csv-to-excel" | "excel-to-csv";

export function CsvExcelTool({ onSend }: { onSend?: (file: File) => void }) {
  const [mode, setMode] = useState<Mode>("csv-to-excel");
  return (
    <SimpleConversionTool
      accept={mode === "csv-to-excel" ? ".csv,text/csv" : ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
      allowBatch
      dropLabel={mode === "csv-to-excel" ? "Drop one or more CSV files here, or click to choose" : "Drop one or more Excel files here, or click to choose"}
      convertOne={(file) => (mode === "csv-to-excel" ? csvToExcel(file) : excelToCsv(file))}
      options={mode}
      setOptions={setMode}
      convertLabel={mode === "csv-to-excel" ? "Convert to Excel" : "Convert to CSV"}
      onSend={onSend}
      renderOptions={(value, set) => (
        <fieldset className="flex gap-4 text-sm text-muted">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={value === "csv-to-excel"} onChange={() => set("csv-to-excel")} className="accent-accent" />
            CSV → Excel
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={value === "excel-to-csv"} onChange={() => set("excel-to-csv")} className="accent-accent" />
            Excel → CSV
          </label>
        </fieldset>
      )}
    />
  );
}
