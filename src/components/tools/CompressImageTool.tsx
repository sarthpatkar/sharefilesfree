"use client";

import { useState } from "react";
import { compressImage, type CompressOptions } from "@/lib/tools/compressImage";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: CompressOptions = { quality: 0.7, format: "jpeg", maxWidth: 2400 };

export function CompressImageTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<CompressOptions>(DEFAULTS);

  return (
    <SimpleConversionTool
      accept="image/*"
      allowBatch
      dropLabel="Drop one or more images here, or click to choose"
      dropHint="JPG, PNG, or WebP"
      convertOne={(file, opts) => compressImage(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Compress"
      compareSize
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <label className="flex flex-col gap-1.5">
            Output format
            <select
              value={value.format}
              onChange={(e) => set({ ...value, format: e.target.value as CompressOptions["format"] })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="jpeg">JPEG — smallest, no transparency</option>
              <option value="webp">WebP — small, keeps transparency</option>
              <option value="png">PNG — lossless, resize only</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            Quality ({Math.round(value.quality * 100)}%)
            <input
              type="range"
              min={0.2}
              max={0.95}
              step={0.05}
              value={value.quality}
              disabled={value.format === "png"}
              onChange={(e) => set({ ...value, quality: Number(e.target.value) })}
              className="accent-accent disabled:opacity-40"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            Max dimension ({value.maxWidth ?? 2400}px on the longest side)
            <input
              type="range"
              min={400}
              max={4000}
              step={100}
              value={value.maxWidth ?? 2400}
              onChange={(e) => set({ ...value, maxWidth: Number(e.target.value) })}
              className="accent-accent"
            />
            <span className="text-xs">Downscales large photos before re-encoding — usually the biggest single win for file size.</span>
          </label>
          <p className="text-xs text-muted">
            Re-encoding through the canvas also strips EXIF metadata (camera model, GPS location, timestamps) from the output — a
            privacy side benefit, not just smaller file size.
          </p>
        </div>
      )}
    />
  );
}
