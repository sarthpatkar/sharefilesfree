// Combines multiple PDFs into one, in the order given — client-side, via pdf-lib.
import { PDFDocument } from "pdf-lib";

export async function mergePdfs(files: File[]): Promise<File> {
  if (files.length < 2) throw new Error("Pick at least two PDFs to merge.");

  const merged = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const copiedPages = await merged.copyPages(doc, doc.getPageIndices());
    copiedPages.forEach((page) => merged.addPage(page));
  }

  const mergedBytes = await merged.save();
  // See the comment in imagesToPdf.ts — pdf-lib's Uint8Array<ArrayBufferLike>
  // needs a cast to satisfy TS's stricter BlobPart typing; harmless at runtime.
  return new File([mergedBytes as BlobPart], "merged.pdf", { type: "application/pdf" });
}
