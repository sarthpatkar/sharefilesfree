// CSV -> a PDF table.
//
// Reaches the same destination as csv -> xlsx -> excelToPdf, in one step
// instead of two. Worth its own entry point rather than telling people to chain
// two tools: it is what they actually searched for, and a saved trip through an
// intermediate file is a saved chance to lose the leading zeros.
//
// Parsing goes through SheetJS rather than a split on commas, because a real
// CSV has quoted fields containing commas, embedded newlines and escaped
// quotes, and hand-rolled parsers get all three wrong.
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CsvToPdfOptions {
  orientation: "landscape" | "portrait";
  /** Treat the first row as column headings rather than data. */
  firstRowIsHeader: boolean;
}

export const CSV_TO_PDF_DEFAULTS: CsvToPdfOptions = { orientation: "landscape", firstRowIsHeader: true };

export async function csvToPdf(file: File, options: CsvToPdfOptions = CSV_TO_PDF_DEFAULTS): Promise<File> {
  const text = await file.text();
  // raw:false keeps values as the formatted strings they appear as, which is
  // what stops an account number losing its leading zero on the way through.
  const workbook = XLSX.read(text, { type: "string", raw: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("That file has no readable rows in it.");

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
  if (rows.length === 0) throw new Error("That file has no readable rows in it.");

  const asText = (cell: unknown) => (cell ?? "").toString();
  const head = options.firstRowIsHeader ? [rows[0].map(asText)] : undefined;
  const body = (options.firstRowIsHeader ? rows.slice(1) : rows).map((row) => row.map(asText));

  const pdf = new jsPDF({ orientation: options.orientation, unit: "pt", format: "a4" });
  autoTable(pdf, {
    head,
    body,
    startY: 40,
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [213, 0, 0] },
    // Long free-text columns otherwise push the table off the page entirely.
    tableWidth: "auto",
  });

  const blob = pdf.output("blob");
  return new File([blob], `${file.name.replace(/\.csv$/i, "")}.pdf`, { type: "application/pdf" });
}
