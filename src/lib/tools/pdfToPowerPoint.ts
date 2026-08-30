// Renders each PDF page to an image and places it full-bleed on its own
// slide. This is deliberately an image-based conversion, not a "recover the
// editable text/shapes" one — no reliable client-side engine can reconstruct
// editable PowerPoint content from an arbitrary PDF, and a visually faithful
// slide is more useful than a broken editable one. Good fidelity for
// viewing/presenting; text on the slides isn't selectable/editable.
import PptxGenJS from "pptxgenjs";
import { loadPdf, renderPageToDataUrl } from "./pdfjs";

export async function pdfToPowerPoint(file: File, onProgress?: (current: number, total: number) => void): Promise<File> {
  const pdf = await loadPdf(file);
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PDF_LAYOUT", width: 10, height: 7.5 });
  pptx.layout = "PDF_LAYOUT";

  for (let i = 1; i <= pdf.numPages; i++) {
    const { dataUrl } = await renderPageToDataUrl(pdf, i, 2);
    const slide = pptx.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: 10, h: 7.5 });
    onProgress?.(i, pdf.numPages);
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  return new File([blob], `${file.name.replace(/\.pdf$/i, "")}.pptx`, {
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });
}
