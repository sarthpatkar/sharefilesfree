"use client";

import { useState } from "react";
import { watermarkPdf, type WatermarkOptions } from "@/lib/tools/watermarkPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: WatermarkOptions = { text: "CONFIDENTIAL", opacity: 0.3, fontSize: 48, rotationDeg: 45 };

export function WatermarkTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<WatermarkOptions>(DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf"
      allowBatch
      dropLabel="Drop one or more PDFs here, or click to choose"
      convertOne={(file, opts) => watermarkPdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Add watermark"
      onSend={onSend}
      renderOptions={(value, set) => (
        <div className="flex flex-col gap-3 text-sm text-muted">
          <label className="flex flex-col gap-1.5">
            Watermark text
            <input
              value={value.text}
              onChange={(e) => set({ ...value, text: e.target.value })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            Opacity ({Math.round(value.opacity * 100)}%)
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={value.opacity}
              onChange={(e) => set({ ...value, opacity: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            Size ({value.fontSize}pt)
            <input
              type="range"
              min={16}
              max={96}
              step={4}
              value={value.fontSize}
              onChange={(e) => set({ ...value, fontSize: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            Rotation ({value.rotationDeg}°)
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={value.rotationDeg}
              onChange={(e) => set({ ...value, rotationDeg: Number(e.target.value) })}
              className="accent-accent"
            />
          </label>
        </div>
      )}
    />
  );
}
