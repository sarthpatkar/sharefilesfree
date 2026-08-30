"use client";

import { ocrFile } from "@/lib/tools/ocr";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function OcrTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf,image/*"
      dropLabel="Drop a scanned PDF or a photo here, or click to choose"
      dropHint="First use downloads a language model (~10-15MB, cached afterward) — may take a moment"
      convertOne={(file, opts, onProgress) => ocrFile(file, onProgress)}
      options={null}
      setOptions={() => {}}
      convertLabel="Extract text"
      onSend={onSend}
    />
  );
}
