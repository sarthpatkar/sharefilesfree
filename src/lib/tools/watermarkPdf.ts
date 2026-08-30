import { PDFDocument, rgb, StandardFonts, degrees, type RGB } from "pdf-lib";
import { parsePageRange } from "./pageRange";

export type WatermarkPosition = "center" | "top-left" | "top-right" | "bottom-left" | "bottom-right" | "tile";

export interface WatermarkOptions {
  text: string;
  opacity: number; // 0-1
  fontSize: number;
  rotationDeg: number;
  color: string; // hex
  position: WatermarkPosition;
  /** Empty/blank = every page. Otherwise e.g. "1,3-5". */
  pageRange: string;
}

function hexToRgb(hex: string): RGB {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return rgb(0.5, 0.5, 0.5);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  return rgb(r, g, b);
}

export async function watermarkPdf(file: File, options: WatermarkOptions): Promise<File> {
  if (!options.text.trim()) throw new Error("Enter some watermark text.");
  const bytes = await file.arrayBuffer();
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const color = hexToRgb(options.color);
  const pages = doc.getPages();
  const targetIndexes = parsePageRange(options.pageRange, pages.length);

  for (const index of targetIndexes) {
    const page = pages[index];
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(options.text, options.fontSize);
    const textHeight = options.fontSize;

    if (options.position === "tile") {
      // Repeats the watermark across the whole page in a loose grid — much
      // harder to crop out than a single centered stamp.
      const stepX = textWidth + 80;
      const stepY = textHeight + 100;
      for (let y = -stepY; y < height + stepY; y += stepY) {
        for (let x = -stepX; x < width + stepX; x += stepX) {
          page.drawText(options.text, {
            x,
            y,
            size: options.fontSize,
            font,
            color,
            opacity: options.opacity,
            rotate: degrees(options.rotationDeg),
          });
        }
      }
      continue;
    }

    const margin = 24;
    const positions: Record<Exclude<WatermarkPosition, "tile">, { x: number; y: number }> = {
      center: { x: width / 2 - textWidth / 2, y: height / 2 },
      "top-left": { x: margin, y: height - margin - textHeight },
      "top-right": { x: width - margin - textWidth, y: height - margin - textHeight },
      "bottom-left": { x: margin, y: margin },
      "bottom-right": { x: width - margin - textWidth, y: margin },
    };
    const { x, y } = positions[options.position];
    page.drawText(options.text, {
      x,
      y,
      size: options.fontSize,
      font,
      color,
      opacity: options.opacity,
      rotate: degrees(options.rotationDeg),
    });
  }

  const out = await doc.save();
  return new File([out as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-watermarked.pdf`, { type: "application/pdf" });
}
