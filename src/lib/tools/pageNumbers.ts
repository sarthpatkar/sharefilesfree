import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type NumberPosition = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export async function addPageNumbers(file: File, position: NumberPosition, startAt: number): Promise<File> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const margin = 24;

  doc.getPages().forEach((page, i) => {
    const { width, height } = page.getSize();
    const label = `${startAt + i}`;
    const textWidth = font.widthOfTextAtSize(label, size);
    let x = width / 2 - textWidth / 2;
    if (position.endsWith("right")) x = width - margin - textWidth;
    if (position.endsWith("left")) x = margin;
    const y = position.startsWith("top") ? height - margin : margin;
    page.drawText(label, { x, y, size, font, color: rgb(0.35, 0.35, 0.35) });
  });

  const out = await doc.save();
  return new File([out as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-numbered.pdf`, { type: "application/pdf" });
}
