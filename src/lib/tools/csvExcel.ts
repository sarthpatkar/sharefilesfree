import * as XLSX from "xlsx";
import { zipSync } from "fflate";

export type Delimiter = "," | ";" | "\t" | "|";

export async function csvToExcel(file: File): Promise<File> {
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], `${file.name.replace(/\.csv$/i, "")}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export interface ExcelToCsvOptions {
  delimiter: Delimiter;
  /** Sheet name to export. Ignored (every sheet exported, zipped) if allSheets is true. */
  sheetName?: string;
  allSheets: boolean;
}

/** Lists a workbook's sheet names — used to populate a "which sheet?" picker before conversion. */
export async function listSheetNames(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", bookSheets: true });
  return wb.SheetNames;
}

export async function excelToCsv(file: File, options: ExcelToCsvOptions = { delimiter: ",", allSheets: false }): Promise<File> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  if (wb.SheetNames.length === 0) throw new Error("This spreadsheet has no sheets to convert.");
  const baseName = file.name.replace(/\.xlsx?$/i, "");

  if (options.allSheets && wb.SheetNames.length > 1) {
    const entries: Record<string, Uint8Array> = {};
    for (const name of wb.SheetNames) {
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name], { FS: options.delimiter });
      entries[`${sanitizeFilename(name)}.csv`] = new TextEncoder().encode(csv);
    }
    const zipped = zipSync(entries);
    return new File([zipped as BlobPart], `${baseName}-sheets.zip`, { type: "application/zip" });
  }

  const sheetName = options.sheetName && wb.SheetNames.includes(options.sheetName) ? options.sheetName : wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: options.delimiter });
  return new File([csv], `${baseName}.csv`, { type: "text/csv" });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim() || "sheet";
}
