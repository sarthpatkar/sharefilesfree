"use client";

import { useState } from "react";
import { heicToJpg, type HeicToJpgOptions, type HeicOutputFormat } from "@/lib/tools/heicToJpg";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: HeicToJpgOptions = { format: "jpeg", quality: 0.9 };

export function HeicToJpgTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<HeicToJpgOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept=".heic,.heif,image/heic,image/heif"
      allowBatch
      dropLabel="Drop one or more HEIC photos here, or click to choose"
      dropHint="iPhone photos in Apple's HEIC format"
      convertOne={(file, opts) => heicToJpg(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Convert"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <label className="flex flex-col gap-1.5">
            Output format
            <select
              value={value.format}
              onChange={(e) => set({ ...value, format: e.target.value as HeicOutputFormat })}
              className=" border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="jpeg">JPEG — smallest, works everywhere</option>
              <option value="png">PNG — lossless, larger file</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            Quality ({Math.round(value.quality * 100)}%)
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.05}
              value={value.quality}
              disabled={value.format === "png"}
              onChange={(e) => set({ ...value, quality: Number(e.target.value) })}
              className="accent-accent disabled:opacity-40"
            />
          </label>
        </div>
      )}
    />
  );
}
