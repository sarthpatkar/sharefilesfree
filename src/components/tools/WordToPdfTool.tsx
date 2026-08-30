"use client";

import { useState } from "react";
import { wordToPdf, type WordToPdfOptions } from "@/lib/tools/wordToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: WordToPdfOptions = { pageSize: "a4", fontSize: 14 };

export function WordToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<WordToPdfOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      allowBatch
      dropLabel="Drop one or more Word documents here, or click to choose"
      dropHint="Works best on straightforward layouts — very complex formatting may not paginate perfectly"
      convertOne={(file, opts) => wordToPdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert to PDF"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.pageSize === "a4"} onChange={() => set({ ...value, pageSize: "a4" })} className="accent-accent" />
              A4
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.pageSize === "letter"} onChange={() => set({ ...value, pageSize: "letter" })} className="accent-accent" />
              US Letter
            </label>
          </fieldset>
          <label className="flex flex-col gap-1.5">
            Base text size ({value.fontSize}px)
            <input
              type="range"
              min={10}
              max={18}
              value={value.fontSize}
              onChange={(e) => set({ ...value, fontSize: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
        </div>
      )}
    />
  );
}
