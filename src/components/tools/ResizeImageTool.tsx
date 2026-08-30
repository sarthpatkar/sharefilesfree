"use client";

import { useState } from "react";
import { resizeImage, type ResizeOptions } from "@/lib/tools/resizeImage";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: ResizeOptions = { mode: "percent", percent: 50, format: "jpeg", quality: 0.85 };

export function ResizeImageTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<ResizeOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="image/*"
      allowBatch
      dropLabel="Drop one or more images here, or click to choose"
      convertOne={(file, opts) => resizeImage(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Resize"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <fieldset className="flex gap-4">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === "percent"} onChange={() => set({ ...value, mode: "percent" })} className="accent-accent" />
              By percentage
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={value.mode === "exact"} onChange={() => set({ ...value, mode: "exact" })} className="accent-accent" />
              Exact dimensions
            </label>
          </fieldset>
          {value.mode === "percent" ? (
            <label className="flex flex-col gap-1.5">
              Scale ({value.percent}%)
              <input
                type="range"
                min={5}
                max={200}
                value={value.percent}
                onChange={(e) => set({ ...value, percent: Number(e.target.value) })}
                className="accent-accent"
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 text-foreground">
              <input
                type="number"
                placeholder="Width"
                value={value.width ?? ""}
                onChange={(e) => set({ ...value, width: Number(e.target.value) })}
                className="w-24 rounded-lg border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
              />
              <span>×</span>
              <input
                type="number"
                placeholder="Height"
                value={value.height ?? ""}
                onChange={(e) => set({ ...value, height: Number(e.target.value) })}
                className="w-24 rounded-lg border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
              />
              <span className="text-muted">px</span>
            </div>
          )}
          <label className="flex flex-col gap-1.5">
            Output format
            <select
              value={value.format}
              onChange={(e) => set({ ...value, format: e.target.value as ResizeOptions["format"] })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
              <option value="png">PNG</option>
            </select>
          </label>
        </div>
      )}
    />
  );
}
