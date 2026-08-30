import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";

async function extractPages(file: File, indices: number[], suffix: string): Promise<File> {
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const doc = await PDFDocument.create();
  const pages = await doc.copyPages(src, indices);
  pages.forEach((p) => doc.addPage(p));
  const out = await doc.save();
  const baseName = file.name.replace(/\.pdf$/i, "");
  return new File([out as BlobPart], `${baseName}${suffix}.pdf`, { type: "application/pdf" });
}

/** Extracts a 1-indexed, inclusive page range into a single PDF. */
export async function splitPdfRange(file: File, from: number, to: number): Promise<File> {
  const bytes = await file.arrayBuffer();
  const count = (await PDFDocument.load(bytes)).getPageCount();
  const start = Math.max(1, from);
  const end = Math.min(count, to);
  if (start > end) throw new Error("Invalid page range.");
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start - 1 + i);
  return extractPages(file, indices, `-p${start}-${end}`);
}

/** Splits every page into its own PDF, bundled into one .zip so it's a single download. */
export async function splitPdfEveryPage(file: File): Promise<File> {
  const bytes = await file.arrayBuffer();
  const count = (await PDFDocument.load(bytes)).getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");
  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < count; i++) {
    const pageFile = await extractPages(file, [i], `-page-${i + 1}`);
    entries[pageFile.name] = new Uint8Array(await pageFile.arrayBuffer());
  }
  const zipped = zipSync(entries);
  return new File([zipped as BlobPart], `${baseName}-pages.zip`, { type: "application/zip" });
}
