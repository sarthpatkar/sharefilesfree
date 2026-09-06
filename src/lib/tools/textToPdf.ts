// Plain text -> PDF, with real selectable text rather than a picture of it.
//
// Deliberately NOT the route wordToPdf takes. That one renders HTML through
// html2canvas because a .docx carries formatting worth preserving, and the cost
// is that the output is rasterised. A .txt file has no formatting to preserve,
// so there is nothing to buy with that trade — drawing the text directly keeps
// it selectable, searchable, copyable and a fraction of the size.
import jsPDF from "jspdf";

export interface TextToPdfOptions {
  pageSize: "a4" | "letter";
  fontSize: number;
  /** Monospace suits logs, code and anything column-aligned by spaces. */
  monospace: boolean;
}

export const TEXT_TO_PDF_DEFAULTS: TextToPdfOptions = { pageSize: "a4", fontSize: 11, monospace: false };

const MARGIN_PT = 56; // ~2cm, a normal document margin

export async function textToPdf(file: File, options: TextToPdfOptions = TEXT_TO_PDF_DEFAULTS): Promise<File> {
  const raw = await file.text();
  if (raw.trim().length === 0) throw new Error("That file has no text in it.");

  const pdf = new jsPDF({ unit: "pt", format: options.pageSize });
  pdf.setFont(options.monospace ? "courier" : "helvetica", "normal");
  pdf.setFontSize(options.fontSize);

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const usableWidth = pageWidth - MARGIN_PT * 2;
  const lineHeight = options.fontSize * 1.45;

  // Normalise line endings first: a file written on Windows carries \r\n, and a
  // stray \r renders as a visible box in some PDF viewers.
  const paragraphs = raw.replace(/\r\n?/g, "\n").split("\n");

  let y = MARGIN_PT;
  for (const paragraph of paragraphs) {
    // An empty line is a blank line, not something to skip — it is how plain
    // text expresses a paragraph break, and dropping it reflows the document.
    const lines: string[] = paragraph.length === 0 ? [""] : pdf.splitTextToSize(paragraph, usableWidth);

    for (const line of lines) {
      if (y + lineHeight > pageHeight - MARGIN_PT) {
        pdf.addPage();
        y = MARGIN_PT;
      }
      if (line.length > 0) pdf.text(line, MARGIN_PT, y);
      y += lineHeight;
    }
  }

  const blob = pdf.output("blob");
  return new File([blob], `${file.name.replace(/\.(txt|log|md|csv)$/i, "")}.pdf`, { type: "application/pdf" });
}
