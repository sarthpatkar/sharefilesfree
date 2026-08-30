"use client";

import { useState } from "react";
import { watermarkPdf, type WatermarkOptions, type WatermarkPosition } from "@/lib/tools/watermarkPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: WatermarkOptions = {
  text: "CONFIDENTIAL",
  opacity: 0.3,
  fontSize: 48,
  rotationDeg: 45,
  color: "#808080",
  position: "center",
  pageRange: "",
};

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "center", label: "Center (single stamp)" },
  { value: "tile", label: "Tiled across the page" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

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
            Position
            <select
              value={value.position}
              onChange={(e) => set({ ...value, position: e.target.value as WatermarkPosition })}
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              {POSITIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5">
              Color
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value.color}
                  onChange={(e) => set({ ...value, color: e.target.value })}
                  className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
                  aria-label="Watermark color"
                />
                <input
                  value={value.color}
                  onChange={(e) => set({ ...value, color: e.target.value })}
                  className="w-full rounded-lg border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-accent"
                />
              </div>
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
          </div>
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
          <label className="flex flex-col gap-1.5">
            Pages (optional)
            <input
              value={value.pageRange}
              onChange={(e) => set({ ...value, pageRange: e.target.value })}
              placeholder="e.g. 1,3-5 — leave blank for every page"
              className="rounded-lg border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            />
          </label>
        </div>
      )}
    />
  );
}
