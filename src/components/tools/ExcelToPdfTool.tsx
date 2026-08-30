"use client";

import { useEffect, useState } from "react";
import { excelToPdf, type ExcelToPdfOptions } from "@/lib/tools/excelToPdf";
import { listSheetNames } from "@/lib/tools/csvExcel";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: ExcelToPdfOptions = { orientation: "landscape", sheetNames: [] };

function SheetPicker({ value, set, files }: { value: ExcelToPdfOptions; set: (o: ExcelToPdfOptions) => void; files: File[] }) {
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

  if (sheetNames.length <= 1) return null;

  const selected = value.sheetNames?.length ? value.sheetNames : sheetNames;

  function toggle(name: string) {
    const next = selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name];
    set({ ...value, sheetNames: next });
  }

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-0.5">Sheets to include</legend>
      <div className="flex flex-wrap gap-2">
        {sheetNames.map((name) => (
          <label key={name} className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1">
            <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="accent-accent" />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExcelToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<ExcelToPdfOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      dropLabel="Drop an Excel file here, or click to choose"
      convertOne={(file, opts) => excelToPdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to PDF"
      onSend={onSend}
      renderOptions={(value, set, files) => (
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
          <SheetPicker value={value} set={set} files={files} />
        </div>
      )}
    />
  );
}
