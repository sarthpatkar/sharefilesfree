"use client";

import { useState } from "react";
import { rotatePdf, ROTATE_PDF_DEFAULTS, type RotatePdfOptions, type RotationAngle } from "@/lib/tools/rotatePdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

const ANGLES: { value: RotationAngle; label: string }[] = [
  { value: 90, label: "90° right" },
  { value: 180, label: "180° upside down" },
  { value: 270, label: "90° left" },
];

export function RotatePdfTool({ onSend }: { onSend?: (file: File) => void }) {
  const [options, setOptions] = useState<RotatePdfOptions>(ROTATE_PDF_DEFAULTS);
  return (
    <SimpleConversionTool
      accept="application/pdf,.pdf"
      allowBatch
      dropLabel="Drop PDFs here, or click to choose"
      dropHint="Turns every page. To rotate individual pages, use Organize PDF instead"
      convertOne={(file, opts) => rotatePdf(file, opts)}
      options={options}
      setOptions={setOptions}
      convertLabel="Rotate PDF"
      onSend={onSend}
      renderOptions={(value, set) => (
        <fieldset className="flex flex-col gap-2 text-sm text-muted">
          {ANGLES.map((angle) => (
            <label key={angle.value} className="flex items-center gap-1.5">
              <input type="radio" checked={value.angle === angle.value} onChange={() => set({ ...value, angle: angle.value })} className="accent-accent" />
              {angle.label}
            </label>
          ))}
        </fieldset>
      )}
    />
  );
}
