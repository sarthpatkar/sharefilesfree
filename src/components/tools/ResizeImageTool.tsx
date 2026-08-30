"use client";

import { useEffect, useState } from "react";
import { resizeImage, RESIZE_PRESETS, type ResizeOptions } from "@/lib/tools/resizeImage";
import { SimpleConversionTool } from "./SimpleConversionTool";

const DEFAULTS: ResizeOptions = { mode: "percent", percent: 50, format: "jpeg", quality: 0.85 };

/** Native pixel dimensions of the first selected file — used to drive aspect-ratio locking. Only meaningful for a single-file resize; with a batch, each file keeps its own ratio and this preview just reflects the first one. */
function useFirstImageSize(file: File | undefined): { width: number; height: number } | null {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    if (!file) {
      const timer = setTimeout(() => setSize(null), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    createImageBitmap(file)
      .then((bmp) => {
        if (!cancelled) setSize({ width: bmp.width, height: bmp.height });
      })
      .catch(() => {
        if (!cancelled) setSize(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file]);
  return size;
}

function ResizeOptionsPanel({
  value,
  set,
  files,
  lockAspect,
  setLockAspect,
}: {
  value: ResizeOptions;
  set: (o: ResizeOptions) => void;
  files: File[];
  lockAspect: boolean;
  setLockAspect: (v: boolean) => void;
}) {
  const nativeSize = useFirstImageSize(files[0]);
  const aspectRatio = nativeSize ? nativeSize.width / nativeSize.height : null;

  function setWidthLocked(width: number) {
    if (lockAspect && aspectRatio) {
      set({ ...value, width, height: Math.max(1, Math.round(width / aspectRatio)) });
    } else {
      set({ ...value, width });
    }
  }
  function setHeightLocked(height: number) {
    if (lockAspect && aspectRatio) {
      set({ ...value, height, width: Math.max(1, Math.round(height * aspectRatio)) });
    } else {
      set({ ...value, height });
    }
  }

  return (
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
          {nativeSize && value.percent && (
            <span className="text-xs">
              → {Math.round((nativeSize.width * value.percent) / 100)} × {Math.round((nativeSize.height * value.percent) / 100)} px
            </span>
          )}
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            Preset size
            <select
              defaultValue=""
              onChange={(e) => {
                const preset = RESIZE_PRESETS.find((p) => p.label === e.target.value);
                if (preset) set({ ...value, width: preset.width, height: preset.height });
              }}
              className=" border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
            >
              <option value="" disabled>
                Choose a common size…
              </option>
              {RESIZE_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-2 text-foreground">
            <input
              type="number"
              placeholder="Width"
              value={value.width ?? ""}
              onChange={(e) => setWidthLocked(Number(e.target.value))}
              className="w-24 border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
            />
            <span>×</span>
            <input
              type="number"
              placeholder="Height"
              value={value.height ?? ""}
              onChange={(e) => setHeightLocked(Number(e.target.value))}
              className="w-24 border border-border bg-transparent px-2 py-1.5 outline-none focus:border-accent"
            />
            <span className="text-muted">px</span>
          </div>
          {nativeSize && (
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} className="accent-accent" />
              Lock aspect ratio ({nativeSize.width}:{nativeSize.height}, from the first image)
            </label>
          )}
        </div>
      )}
      <label className="flex flex-col gap-1.5">
        Output format
        <select
          value={value.format}
          onChange={(e) => set({ ...value, format: e.target.value as ResizeOptions["format"] })}
          className=" border border-border bg-transparent px-3 py-2 text-foreground outline-none focus:border-accent"
        >
          <option value="jpeg">JPEG</option>
          <option value="webp">WebP</option>
          <option value="png">PNG</option>
        </select>
      </label>
    </div>
  );
}

export function ResizeImageTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<ResizeOptions>(DEFAULTS);
  const [lockAspect, setLockAspect] = useState(true);

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
      renderOptions={(value, set, files) => (
        <ResizeOptionsPanel value={value} set={set} files={files} lockAspect={lockAspect} setLockAspect={setLockAspect} />
      )}
    />
  );
}
