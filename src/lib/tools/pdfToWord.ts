// Deliberately labeled "basic" everywhere it's surfaced in the UI: this
// extracts text and does rough heading detection by font size, but it does
// NOT preserve layout, columns, images, or exact formatting. No client-side
// library can do that reconstruction — real "PDF to Word, 100% accurate"
// tools run heavy proprietary layout-analysis engines server-side. Promising
// that here and delivering this would be a worse experience than being
// upfront that this is a text-recovery tool, not a layout-preserving one.
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { loadPdf, extractPageLines } from "./pdfjs";

export async function pdfToWordBasic(file: File, onProgress?: (current: number, total: number) => void): Promise<File> {
  const pdf = await loadPdf(file);
  const allLines: { text: string; fontSize: number }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    allLines.push(...(await extractPageLines(pdf, i)));
    onProgress?.(i, pdf.numPages);
  }
  if (allLines.length === 0) throw new Error("Couldn't find any text in this PDF (it may be a scanned image).");

  const maxFont = Math.max(...allLines.map((l) => l.fontSize));
  const paragraphs = allLines.map(
    (line) =>
      new Paragraph({
        text: line.text,
        heading: line.fontSize >= maxFont * 0.85 && line.fontSize > 13 ? HeadingLevel.HEADING_1 : undefined,
      }),
  );

  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return new File([blob], `${file.name.replace(/\.pdf$/i, "")}.docx`, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
