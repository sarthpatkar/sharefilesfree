// "Compress PDF" has an honest split into two real strategies, not one
// pretend one — see the comment above STRONG below for why we don't fake a
// single "best" mode.
import { PDFDocument } from "pdf-lib";
import { loadPdf, renderPageToBlob } from "./pdfjs";

export type CompressLevel = "light" | "strong";

export interface CompressPdfOptions {
  level: CompressLevel;
  /** Strong mode only: JPEG quality 0-1 for the rasterized pages. */
  imageQuality: number;
  /** Strong mode only: render scale — lower means smaller file but blurrier text/images. */
  renderScale: number;
}

export async function compressPdf(
  file: File,
  options: CompressPdfOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<File> {
  const { level, imageQuality, renderScale } = options;
  if (level === "light") {
    // Lossless: re-serializes with object streams, which typically saves a
    // modest amount (often 5-20%) with zero quality loss — text stays text,
    // images stay untouched. pdf-lib has no API to recompress images already
    // embedded in an existing PDF, which is what "real" compressors
    // (Adobe/iLovePDF) do server-side with heavier tooling.
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const out = await doc.save({ useObjectStreams: true });
    return new File([out as BlobPart], file.name, { type: "application/pdf" });
  }

  // Strong: rasterizes every page to a JPEG and rebuilds the PDF from those
  // images. This can shrink image-heavy or scanned PDFs dramatically, but
  // it's a real trade-off we say plainly in the UI: text is no longer
  // selectable/searchable afterward, because it's now a picture of text.
  const pdf = await loadPdf(file);
  const doc = await PDFDocument.create();
  for (let i = 1; i <= pdf.numPages; i++) {
    const { blob, width, height } = await renderPageToBlob(pdf, i, renderScale, imageQuality);
    const bytes = await blob.arrayBuffer();
    const image = await doc.embedJpg(bytes);
    const page = doc.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
    onProgress?.(i, pdf.numPages);
  }
  const out = await doc.save();
  return new File([out as BlobPart], file.name, { type: "application/pdf" });
}
