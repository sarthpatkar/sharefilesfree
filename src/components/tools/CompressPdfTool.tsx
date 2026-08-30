"use client";

import { useState } from "react";
import { compressPdf, type CompressPdfOptions } from "@/lib/tools/compressPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: CompressPdfOptions = { level: "light", imageQuality: 0.5, renderScale: 1.5 };

export function CompressPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<CompressPdfOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      convertOne={(file, opts, onProgress) => compressPdf(file, opts, onProgress)}
      options={options}
      setOptions={setOptions}
      compareSize
      convertLabel="Compress"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2 text-sm text-muted">
            <legend className="mb-1 text-foreground">Compression level</legend>
            <label className="flex items-start gap-2">
              <input type="radio" checked={value.level === "light"} onChange={() => set({ ...value, level: "light" })} className="mt-1 accent-accent" />
              <span>
                <strong className="text-foreground">Light</strong> — lossless, modest savings, text and images untouched.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" checked={value.level === "strong"} onChange={() => set({ ...value, level: "strong" })} className="mt-1 accent-accent" />
              <span>
                <strong className="text-foreground">Strong</strong> — much smaller for image-heavy/scanned PDFs, but text becomes
                part of an image afterward (no longer selectable or searchable).
              </span>
            </label>
          </fieldset>
          {value.level === "strong" && (
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3 text-sm text-muted">
              <label className="flex flex-col gap-1.5">
                Image quality ({Math.round(value.imageQuality * 100)}%)
                <input
                  type="range"
                  min={0.2}
                  max={0.9}
                  step={0.05}
                  value={value.imageQuality}
                  onChange={(e) => set({ ...value, imageQuality: Number(e.target.value) })}
                  className="accent-accent"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                Resolution ({value.renderScale.toFixed(1)}×)
                <input
                  type="range"
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={value.renderScale}
                  onChange={(e) => set({ ...value, renderScale: Number(e.target.value) })}
                  className="accent-accent"
                />
                <span className="text-xs">Lower resolution and quality both shrink the file further, at the cost of sharpness.</span>
              </label>
            </div>
          )}
        </div>
      )}
    />
  );
}
