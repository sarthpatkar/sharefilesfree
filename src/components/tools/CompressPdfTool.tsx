"use client";

import { useState } from "react";
import { compressPdf, type CompressLevel } from "@/lib/tools/compressPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function CompressPdfTool({ onSend }: { onSend: (file: File) => void }) {
  const [level, setLevel] = useState<CompressLevel>("light");
  return (
    <SimpleConversionTool
      accept="application/pdf"
      dropLabel="Drop a PDF here, or click to choose"
      convert={(files) => compressPdf(files[0], level)}
      options={level}
      setOptions={setLevel}
      compareSize
      convertLabel="Compress"
      onSend={onSend}
      renderOptions={(value, set) => (
        <fieldset className="flex flex-col gap-2 text-sm text-muted">
          <legend className="mb-1 text-foreground">Compression level</legend>
          <label className="flex items-start gap-2">
            <input type="radio" checked={value === "light"} onChange={() => set("light")} className="mt-1 accent-accent" />
            <span>
              <strong className="text-foreground">Light</strong> — lossless, modest savings, text and images untouched.
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" checked={value === "strong"} onChange={() => set("strong")} className="mt-1 accent-accent" />
            <span>
              <strong className="text-foreground">Strong</strong> — much smaller for image-heavy/scanned PDFs, but text becomes
              part of an image afterward (no longer selectable or searchable).
            </span>
          </label>
        </fieldset>
      )}
    />
  );
}
