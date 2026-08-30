import * as XLSX from "xlsx";

export async function csvToExcel(file: File): Promise<File> {
  const text = await file.text();
  const wb = XLSX.read(text, { type: "string" });
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], `${file.name.replace(/\.csv$/i, "")}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Only the first sheet — CSV has no concept of multiple sheets. */
export async function excelToCsv(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) throw new Error("This spreadsheet has no sheets to convert.");
  const csv = XLSX.utils.sheet_to_csv(firstSheet);
  return new File([csv], `${file.name.replace(/\.xlsx?$/i, "")}.csv`, { type: "text/csv" });
}
