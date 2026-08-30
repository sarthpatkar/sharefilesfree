"use client";

import { excelToPdf } from "@/lib/tools/excelToPdf";
import { SimpleConversionTool } from "./SimpleConversionTool";

export function ExcelToPdfTool({ onSend }: { onSend: (file: File) => void }) {
  return (
    <SimpleConversionTool
      accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      dropLabel="Drop an Excel file here, or click to choose"
      convert={(files) => excelToPdf(files[0])}
      options={null}
      setOptions={() => {}}
      convertLabel="Convert to PDF"
      onSend={onSend}
    />
  );
}
