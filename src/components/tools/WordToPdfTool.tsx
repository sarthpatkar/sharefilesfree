"use client";

import { wordToPdf } from "@/lib/tools/wordToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function WordToPdfTool({ onSend }: { onSend: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      dropLabel="Drop a Word document here, or click to choose"
      dropHint="Works best on straightforward layouts — very complex formatting may not paginate perfectly"
      convert={(files) => wordToPdf(files[0])}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to PDF"
      onSend={onSend}
    />
  );
}
