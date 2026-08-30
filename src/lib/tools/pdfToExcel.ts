// Also labeled "basic" in the UI — this is text-per-line extraction into
// rows, not real table/column detection. A PDF has no concept of "cells";
// reconstructing an actual spreadsheet from one requires table-detection
// heuristics or ML that no lightweight client-side library provides. Useful
// for pulling raw text out page by page, not a substitute for a real
// PDF-table extractor.
import * as XLSX from "xlsx";
import { loadPdf, extractPageLines } from "./pdfjs";

export interface PdfToExcelOptions {
  /** Every page as its own sheet (default) vs. everything in one sheet with a "Page" column. */
  oneSheetPerPage: boolean;
  /** Split each line into columns wherever it finds a run of 2+ spaces — a rough approximation of table columns that lines up reasonably on PDFs with consistent spacing. */
  splitColumns: boolean;
}

function toRow(text: string, splitColumns: boolean): string[] {
  return splitColumns ? text.split(/ {2,}/).map((c) => c.trim()) : [text];
}

export async function pdfToExcelBasic(
  file: File,
  options: PdfToExcelOptions = { oneSheetPerPage: false, splitColumns: false },
  onProgress?: (current: number, total: number) => void,
): Promise<File> {
  const pdf = await loadPdf(file);
  const wb = XLSX.utils.book_new();
  let wroteAnySheet = false;
  const combinedRows: (string | number)[][] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const lines = await extractPageLines(pdf, i);
    if (lines.length > 0) {
      if (options.oneSheetPerPage) {
        const ws = XLSX.utils.aoa_to_sheet(lines.map((l) => toRow(l.text, options.splitColumns)));
        XLSX.utils.book_append_sheet(wb, ws, `Page ${i}`.slice(0, 31));
      } else {
        for (const l of lines) combinedRows.push([i, ...toRow(l.text, options.splitColumns)]);
      }
      wroteAnySheet = true;
    }
    onProgress?.(i, pdf.numPages);
  }
  if (!wroteAnySheet) throw new Error("Couldn't find any text in this PDF (it may be a scanned image).");

  if (!options.oneSheetPerPage) {
    const ws = XLSX.utils.aoa_to_sheet([["Page", "Text"], ...combinedRows]);
    XLSX.utils.book_append_sheet(wb, ws, "Extracted text");
  }

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([out], `${file.name.replace(/\.pdf$/i, "")}.xlsx`, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
