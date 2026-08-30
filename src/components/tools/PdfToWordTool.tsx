"use client";

import { pdfToWordBasic } from "@/lib/tools/pdfToWord";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function PdfToWordTool({ onSend }: { onSend: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept="application/pdf"
      dropLabel="Drop a PDF here, or click to choose"
      dropHint="Basic text recovery — pulls the words out, but does not preserve layout, columns, or images"
      convert={(files) => pdfToWordBasic(files[0])}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to Word (basic)"
      onSend={onSend}
    />
  );
}
