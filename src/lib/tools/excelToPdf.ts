import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export async function excelToPdf(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  workbook.SheetNames.forEach((sheetName, i) => {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (i > 0) pdf.addPage();
    pdf.setFontSize(14);
    pdf.text(sheetName, 20, 30);
    autoTable(pdf, {
      startY: 40,
      head: rows.length ? [rows[0].map((c) => (c ?? "").toString())] : [[]],
      body: rows.slice(1).map((r) => r.map((c) => (c ?? "").toString())),
      styles: { fontSize: 8 },
    });
  });

  const blob = pdf.output("blob");
  return new File([blob], `${file.name.replace(/\.xlsx?$/i, "")}.pdf`, { type: "application/pdf" });
}
