// Rotates every page of a PDF by a quarter turn.
//
// Organize PDF can already rotate individual pages, and this deliberately does
// not duplicate that. It answers a different question: a scan or a phone
// capture where the WHOLE document came in sideways, and the fix is one control
// rather than a thumbnail grid. That is also the thing people search for.
//
// Rotation is recorded as a property of the page, which is how the PDF format
// intends it — nothing is re-rendered, so text stays selectable and image
// quality is untouched.
import { PDFDocument, degrees } from "pdf-lib";

export type RotationAngle = 90 | 180 | 270;

export interface RotatePdfOptions {
  angle: RotationAngle;
}

export const ROTATE_PDF_DEFAULTS: RotatePdfOptions = { angle: 90 };

export async function rotatePdf(file: File, options: RotatePdfOptions = ROTATE_PDF_DEFAULTS): Promise<File> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const pages = doc.getPages();
  if (pages.length === 0) throw new Error("That PDF has no pages in it.");

  for (const page of pages) {
    // Added to whatever rotation the page already carries, not replacing it. A
    // page that was already turned 90 degrees and is rotated 90 again should
    // end up at 180 — setting absolutely would silently undo the first turn.
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + options.angle) % 360));
  }

  const bytes = await doc.save();
  return new File([bytes as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-rotated.pdf`, {
    type: "application/pdf",
  });
}
