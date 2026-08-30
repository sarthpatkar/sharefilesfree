import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";

export type NumberPosition = "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left";

export interface PageNumberOptions {
  position: NumberPosition;
  startAt: number;
  /** Template — "{n}" is the current number, "{total}" is the page count. E.g. "Page {n} of {total}". */
  format: string;
  fontSize: number;
  color: string; // hex
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return rgb(0.35, 0.35, 0.35);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return rgb(r, g, b);
}

export async function addPageNumbers(file: File, options: PageNumberOptions): Promise<File> {
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = options.fontSize;
  const margin = 24;
  const color = hexToRgb(options.color);
  const pages = doc.getPages();
  const total = pages.length;

  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const label = options.format
      .replaceAll("{n}", `${options.startAt + i}`)
      .replaceAll("{total}", `${total}`);
    const textWidth = font.widthOfTextAtSize(label, size);
    let x = width / 2 - textWidth / 2;
    if (options.position.endsWith("right")) x = width - margin - textWidth;
    if (options.position.endsWith("left")) x = margin;
    const y = options.position.startsWith("top") ? height - margin : margin;
    page.drawText(label, { x, y, size, font, color });
  });

  const out = await doc.save();
  return new File([out as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-numbered.pdf`, { type: "application/pdf" });
}
