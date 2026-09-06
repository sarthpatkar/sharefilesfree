// Flattens a PDF's interactive form fields into the page.
//
// What "flatten" means here, precisely, because the word gets used for two
// different operations and only one of them is this:
//
//   - Form flattening (this): the values typed into a form become ordinary page
//     content. The boxes stop being editable, the text stays real text, and the
//     file stays searchable and small. This is what you want before sending a
//     completed form to somebody who should not be able to change the answers.
//
//   - Rasterising: turning each page into an image. That also makes it
//     uneditable, and destroys selectable text while multiplying the file size.
//     Compress PDF's "strong" mode already does that, and it is the wrong tool
//     for this job.
//
// A flattened form cannot be un-flattened, which is the point, so the original
// is worth keeping.
import { PDFDocument } from "pdf-lib";

export interface FlattenPdfResult {
  file: File;
  /** How many fields were flattened, so the UI can say whether anything happened. */
  fieldCount: number;
}

export async function flattenPdf(file: File): Promise<File> {
  return (await flattenPdfDetailed(file)).file;
}

export async function flattenPdfDetailed(file: File): Promise<FlattenPdfResult> {
  const doc = await PDFDocument.load(await file.arrayBuffer());
  const form = doc.getForm();
  const fieldCount = form.getFields().length;

  if (fieldCount > 0) {
    // updateFieldAppearances first, so a field whose value was set
    // programmatically — by another tool, or by a form filler that did not
    // generate an appearance stream — is drawn with its value rather than
    // flattened as an empty box. Without this, filled forms can flatten blank.
    try {
      form.updateFieldAppearances();
    } catch {
      // Some documents carry fonts pdf-lib cannot resolve for appearance
      // generation. Flattening whatever appearances already exist is better
      // than refusing the document outright.
    }
    form.flatten();
  }

  const bytes = await doc.save();
  return {
    file: new File([bytes as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-flattened.pdf`, {
      type: "application/pdf",
    }),
    fieldCount,
  };
}
