// Also labeled "basic" in the UI — this is text-per-line extraction into
// rows, not real table/column detection. A PDF has no concept of "cells";
// reconstructing an actual spreadsheet from one requires table-detection
// heuristics or ML that no lightweight client-side library provides. Useful
// for pulling raw text out page by page, not a substitute for a real
// PDF-table extractor.
import * as XLSX from "xlsx";
import { loadPdf, extractPageLines } from "./pdfjs";

export async function pdfToExcelBasic(file: File): Promise<File> {
  const pdf = await loadPdf(file);
  const wb = XLSX.utils.book_new();
  let wroteAnySheet = false;

  for (let i = 1; i <= pdf.numPages; i++) {
    const lines = await extractPageLines(pdf, i);
    if (lines.length === 0) continue;
    const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => [l.text]));
    XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`.slice(0, 31));
    wroteAnySheet = true;
  }
  if (!wroteAnySheet) throw new Error("Couldn't find any text in this PDF (it may be a scanned image).");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], `${file.name.replace(/\.pdf$/i, "")}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
