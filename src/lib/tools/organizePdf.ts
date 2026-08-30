// Powers the "Organize PDF" tool: reorder, rotate, and delete pages in one
// pass. A single function handles all three, since they're really the same
// operation — "build a new PDF from this ordered list of (page, rotation)
// pairs, having already dropped whatever isn't in the list."
import { PDFDocument, degrees } from "pdf-lib";

export interface PageEntry {
  /** 0-based index into the *original* document. */
  originalIndex: number;
  /** Additional rotation to apply on top of the page's existing rotation, in degrees. */
  addRotation: 0 | 90 | 180 | 270;
}

export async function organizePdf(file: File, pages: PageEntry[]): Promise<File> {
  if (pages.length === 0) throw new Error("Keep at least one page.");
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const doc = await PDFDocument.create();
  const copied = await doc.copyPages(src, pages.map((p) => p.originalIndex));
  copied.forEach((page, i) => {
    const add = pages[i].addRotation;
    if (add) page.setRotation(degrees((page.getRotation().angle + add) % 360));
    doc.addPage(page);
  });
  const out = await doc.save();
  return new File([out as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-organized.pdf`, { type: "application/pdf" });
}
