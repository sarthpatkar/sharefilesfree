"use client";

import { useState } from "react";
import { flattenPdf } from "@/lib/tools/flattenPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function FlattenPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  // No options to configure — flattening is one operation with one outcome.
  const [options, setOptions] = useState<Record<string, never>>({});
  return (
    <SimpleConversionTool
      accept="application/pdf,.pdf"
      allowBatch
      dropLabel="Drop PDFs here, or click to choose"
      dropHint="Locks filled-in form fields into the page. Text stays selectable — nothing is turned into an image"
      convertOne={(file) => flattenPdf(file)}
      options={options}
      setOptions={setOptions}
      convertLabel="Flatten PDF"
      onSend={onSend}
    />
  );
}
