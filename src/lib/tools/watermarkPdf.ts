import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export interface WatermarkOptions {
  text: string;
  opacity: number; // 0-1
  fontSize: number;
  rotationDeg: number;
}

export async function watermarkPdf(file: File, options: WatermarkOptions): Promise<File> {
  if (!options.text.trim()) throw new Error("Enter some watermark text.");
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    page.drawText(options.text, {
      x: width / 2 - textWidth / 2,
      y: height / 2,
      size: options.fontSize,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity: options.opacity,
      rotate: degrees(options.rotationDeg),
    });
  }

  const out = await doc.save();
  return new File([out as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-watermarked.pdf`, { type: "application/pdf" });
}
