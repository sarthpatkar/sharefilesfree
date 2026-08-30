"use client";

import { useEffect, useState } from "react";
import { csvToExcel, excelToCsv, listSheetNames, type Delimiter } from "@/lib/tools/csvExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

type Mode = "csv-to-excel" | "excel-to-csv";

interface Options {
  mode: Mode;
  delimiter: Delimiter;
  sheetName: string;
  allSheets: boolean;
}

const DELIMITERS: { value: Delimiter; label: string }[] = [
  { value: ",", label: "Comma (,)" },
  { value: ";", label: "Semicolon (;) — common in EU Excel locales" },
  { value: "\t", label: "Tab" },
  { value: "|", label: "Pipe (|)" },
];

const DEFAULTS: Options = { mode: "csv-to-excel", delimiter: ",", sheetName: "", allSheets: false };

function ExcelToCsvExtraOptions({ value, set, files }: { value: Options; set: (o: Options) => void; files: File[] }) {
  const [sheetNames, setSheetNames] = useState<string[]>([]);

  useEffect(() => {
    const file = files[0];
    if (!file) {
      const timer = setTimeout(() => setSheetNames([]), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    listSheetNames(file)
      .then((names) => {
        if (!cancelled) setSheetNames(names);
      })
      .catch(() => {
        if (!cancelled) setSheetNames([]);
      });
    return () => {
      cancelled = true;
    };
  }, [files]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        Delimiter
        <select
          value={value.delimiter}
          onChange={(e) => set({ ...value, delimiter: e.target.value as Delimiter })}
          className=" border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
        >
          {DELIMITERS.map((d) => (
            <option key={d.label} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      {sheetNames.length > 1 && (
        <>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={value.allSheets} onChange={(e) => set({ ...value, allSheets: e.target.checked })} className="accent-accent" />
            Export every sheet ({sheetNames.length} sheets → one .zip of .csv files)
          </label>
          {!value.allSheets && (
            <label className="flex flex-col gap-1.5">
              Sheet to export
              <select
                value={value.sheetName || sheetNames[0]}
                onChange={(e) => set({ ...value, sheetName: e.target.value })}
                className=" border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
    </div>
  );
}

export function CsvExcelTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<Options>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept={options.mode === "csv-to-excel" ? ".csv,text/csv" : ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
      allowBatch={options.mode === "csv-to-excel"}
      dropLabel={options.mode === "csv-to-excel" ? "Drop one or more CSV files here, or click to choose" : "Drop an Excel file here, or click to choose"}
      convertOne={(file, opts) => (opts.mode === "csv-to-excel" ? csvToExcel(file) : excelToCsv(file, opts))}
      options={options}
      setOptions={setOptions}
      convertLabel={options.mode === "csv-to-excel" ? "Convert to Excel" : "Convert to CSV"}
      onSend={onSend}
      renderOptions={(value, set, files) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === "csv-to-excel"} onChange={() => set({ ...value, mode: "csv-to-excel" })} className="accent-accent" />
              CSV → Excel
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === "excel-to-csv"} onChange={() => set({ ...value, mode: "excel-to-csv" })} className="accent-accent" />
              Excel → CSV
            </label>
          </fieldset>
          {value.mode === "excel-to-csv" && <ExcelToCsvExtraOptions value={value} set={set} files={files} />}
        </div>
      )}
    />
  );
}
