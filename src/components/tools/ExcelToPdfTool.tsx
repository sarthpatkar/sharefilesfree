"use client";

import { excelToPdf } from "@/lib/tools/excelToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function ExcelToPdfTool({ onSend }: { onSend?: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      allowBatch
      dropLabel="Drop one or more Excel files here, or click to choose"
      convertOne={(file) => excelToPdf(file)}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to PDF"
      onSend={onSend}
    />
  );
}
