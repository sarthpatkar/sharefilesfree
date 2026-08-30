import { PDFDocument } from "pdf-lib";
import { zipSync } from "fflate";
import { parsePageRange } from "./pageRange";

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

/** Splits into fixed-size chunks of `size` pages each (last chunk may be smaller), bundled into one .zip. */
export async function splitPdfEveryNPages(file: File, size: number): Promise<File> {
  if (size < 1) throw new Error("Chunk size must be at least 1 page.");
  const bytes = await file.arrayBuffer();
  const count = (await PDFDocument.load(bytes)).getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");
  const entries: Record<string, Uint8Array> = {};
  let chunkNum = 1;
  for (let start = 0; start < count; start += size) {
    const end = Math.min(count, start + size);
    const indices = Array.from({ length: end - start }, (_, i) => start + i);
    const chunkFile = await extractPages(file, indices, `-part-${chunkNum}`);
    entries[chunkFile.name] = new Uint8Array(await chunkFile.arrayBuffer());
    chunkNum++;
  }
  const zipped = zipSync(entries);
  return new File([zipped as BlobPart], `${baseName}-split.zip`, { type: "application/zip" });
}

/** Extracts several independent page ranges (e.g. "1-3,5,8-10" → three separate PDFs), bundled into one .zip. */
export async function splitPdfCustomRanges(file: File, rangesInput: string): Promise<File> {
  const bytes = await file.arrayBuffer();
  const count = (await PDFDocument.load(bytes)).getPageCount();
  const baseName = file.name.replace(/\.pdf$/i, "");
  const groups = rangesInput
    .split(/[,;]/)
    .map((g) => g.trim())
    .filter(Boolean);
  if (groups.length === 0) throw new Error('Enter at least one range, e.g. "1-3, 5, 8-10".');

  const entries: Record<string, Uint8Array> = {};
  for (let i = 0; i < groups.length; i++) {
    const indices = parsePageRange(groups[i], count);
    const label = groups[i].replace(/\s+/g, "");
    const groupFile = await extractPages(file, indices, `-${label}`);
    entries[entries[groupFile.name] ? `${i + 1}-${groupFile.name}` : groupFile.name] = new Uint8Array(
      await groupFile.arrayBuffer(),
    );
  }
  const zipped = zipSync(entries);
  return new File([zipped as BlobPart], `${baseName}-split.zip`, { type: "application/zip" });
}
