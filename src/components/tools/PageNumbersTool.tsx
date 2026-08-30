"use client";

import { useState } from "react";
import { addPageNumbers, type NumberPosition } from "@/lib/tools/pageNumbers";
import { SimpleConversionTool } from "./SimpleConversionTool";

interface Options {
  position: NumberPosition;
  startAt: number;
}

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

export function PageNumbersTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<Options>({ position: "bottom-center", startAt: 1 });
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      convertOne={(file, opts) => addPageNumbers(file, opts.position, opts.startAt)}
      options={options}
      setOptions={setOptions}
      convertLabel="Add page numbers"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <label className="flex flex-col gap-1.5">
            Position
            <select
              value={value.position}
              onChange={(e) => set({ ...value, position: e.target.value as NumberPosition })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            Start numbering at
            <input
              type="number"
              min={0}
              value={value.startAt}
              onChange={(e) => set({ ...value, startAt: Number(e.target.value) })}
              className="w-24 rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>
      )}
    />
  );
}
