// Combines multiple PDFs into one, in the order given — client-side, via pdf-lib.
import { PDFDocument } from "pdf-lib";
import { parsePageRange } from "./pageRange";

export interface MergeInput {
  file: File;
  /** Blank = every page of this file. Otherwise e.g. "1,3-5". */
  pageRange?: string;
}

export async function mergePdfs(inputs: (File | MergeInput)[]): Promise<File> {
  if (inputs.length < 2) throw new Error("Pick at least two PDFs to merge.");

  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const { file, pageRange } = "file" in input ? input : { file: input, pageRange: undefined };
    const bytes = await file.arrayBuffer();
    const doc = await PDFDocument.load(bytes);
    const indices = pageRange?.trim() ? parsePageRange(pageRange, doc.getPageCount()) : doc.getPageIndices();
    const copiedPages = await merged.copyPages(doc, indices);
    copiedPages.forEach((page) => merged.addPage(page));
  }

  const mergedBytes = await merged.save();
  // See the comment in imagesToPdf.ts — pdf-lib's Uint8Array<ArrayBufferLike>
  // needs a cast to satisfy TS's stricter BlobPart typing; harmless at runtime.
  return new File([mergedBytes as BlobPart], "merged.pdf", { type: "application/pdf" });
}
