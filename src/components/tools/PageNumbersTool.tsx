"use client";

import { useState } from "react";
import { addPageNumbers, type NumberPosition, type PageNumberOptions } from "@/lib/tools/pageNumbers";
import { SimpleConversionTool } from "./SimpleConversionTool";

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

const FORMAT_PRESETS = ["{n}", "Page {n}", "Page {n} of {total}", "- {n} -", "{n}/{total}"];

const DEFAULTS: PageNumberOptions = { position: "bottom-center", startAt: 1, format: "{n}", fontSize: 11, color: "#595959" };

export function PageNumbersTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<PageNumberOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      convertOne={(file, opts) => addPageNumbers(file, opts)}
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
            Format
            <input
              value={value.format}
              onChange={(e) => set({ ...value, format: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            />
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_PRESETS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => set({ ...value, format: f })}
                  className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:border-accent/50"
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-xs">Use {"{n}"} for the number and {"{total}"} for the page count.</span>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              Start numbering at
              <input
                type="number"
                min={0}
                value={value.startAt}
                onChange={(e) => set({ ...value, startAt: Number(e.target.value) })}
                className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              Size ({value.fontSize}pt)
              <input
                type="range"
                min={8}
                max={24}
                value={value.fontSize}
                onChange={(e) => set({ ...value, fontSize: Number(e.target.value) })}
                className="accent-accent"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            Color
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.color}
                onChange={(e) => set({ ...value, color: e.target.value })}
                className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                aria-label="Page number color"
              />
              <input
                value={value.color}
                onChange={(e) => set({ ...value, color: e.target.value })}
                className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-accent"
              />
            </div>
          </label>
        </div>
      )}
    />
  );
}
