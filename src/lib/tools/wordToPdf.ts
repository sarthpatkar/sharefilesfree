// DOCX -> HTML (mammoth) -> PDF (rasterized with html2canvas, then sliced into
// pages and dropped into the PDF as images). Works well for straightforward
// documents; complex layouts (multi-column, precise page breaks, tables that
// span pages) won't paginate perfectly — an inherent limit of the "render
// HTML to canvas" approach, not something worth pretending isn't there.
//
// This deliberately does NOT use jsPDF's own `.html()` helper. That method's
// `autoPaging: "text"` mode doesn't rasterize at all — it re-walks html2canvas's
// parsed DOM through a custom Context2d shim that draws vector text, and on
// real documents it was silently producing pages with nothing on them (verified:
// every page came back blank while the container it was reading from had real,
// correctly-sized content). Rasterizing the container ourselves and slicing the
// result into pages is the well-worn, reliable way to get a div onto a PDF; the
// trade-off already noted above (formatting is baked into pixels, not kept as
// real text) is the same trade-off the old code's own comment already claimed
// to be making — it just wasn't actually making it.
import mammoth from "mammoth";
import { sanitizeDocumentHtml } from "./sanitizeHtml";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface WordToPdfOptions {
  pageSize: "a4" | "letter";
  fontSize: number; // px, applied to the rendered HTML before rasterizing
}

const PAGE_SIZES_PT: Record<WordToPdfOptions["pageSize"], { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

const RENDER_WIDTH_PX = 700; // CSS px the HTML is laid out at before rasterizing
const MARGIN_X_PT = 24;
const MARGIN_Y_PT = 40;
// Sharp enough for print-quality text without producing an unreasonably large
// file or tripping a browser's canvas size ceiling on a long document.
const RASTER_SCALE = 2;

export async function wordToPdf(file: File, options: WordToPdfOptions = { pageSize: "a4", fontSize: 14 }): Promise<File> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const container = document.createElement("div");
  container.style.cssText = `width: ${RENDER_WIDTH_PX}px; padding: ${MARGIN_Y_PT}px ${MARGIN_X_PT}px; font-family: 'Times New Roman', serif; font-size: ${options.fontSize}px; line-height: 1.5; color: #000; background: #fff; position: absolute; top: 0; left: -99999px;`;
  // The .docx came from outside, so the HTML mammoth derived from it did too.
  // This container is appended to the live document (html2canvas can only
  // photograph laid-out nodes), and script-src carries 'unsafe-inline', so an
  // event handler reaching this DOM would actually run. Sanitised first —
  // see sanitizeHtml.ts.
  container.innerHTML = sanitizeDocumentHtml(html || "") || "<p></p>";
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: RASTER_SCALE,
      width: RENDER_WIDTH_PX,
      windowWidth: RENDER_WIDTH_PX,
      backgroundColor: "#ffffff",
      useCORS: true,
    });

    const { width: pageWidth, height: pageHeight } = PAGE_SIZES_PT[options.pageSize];
    const contentWidthPt = pageWidth - MARGIN_X_PT * 2;
    const contentHeightPt = pageHeight - MARGIN_Y_PT * 2;
    // Uniform, so the same ratio maps the canvas's height into points too —
    // the canvas isn't stretched, only the page it's mapped onto changes.
    const ptPerCanvasPx = contentWidthPt / canvas.width;
    const sliceHeightPx = Math.max(1, Math.floor(contentHeightPt / ptPerCanvasPx));

    const pdf = new jsPDF({ unit: "pt", format: options.pageSize });
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    const pageCtx = pageCanvas.getContext("2d");
    if (!pageCtx) throw new Error("This browser doesn't support canvas rendering.");

    let y = 0;
    let pageIndex = 0;
    while (y < canvas.height) {
      const thisSliceHeight = Math.min(sliceHeightPx, canvas.height - y);
      pageCanvas.height = thisSliceHeight;
      pageCtx.clearRect(0, 0, pageCanvas.width, pageCanvas.height);
      pageCtx.drawImage(canvas, 0, y, canvas.width, thisSliceHeight, 0, 0, canvas.width, thisSliceHeight);

      if (pageIndex > 0) pdf.addPage();
      const imageData = pageCanvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(imageData, "JPEG", MARGIN_X_PT, MARGIN_Y_PT, contentWidthPt, thisSliceHeight * ptPerCanvasPx);

      y += thisSliceHeight;
      pageIndex += 1;
    }

    const blob = pdf.output("blob");
    return new File([blob], `${file.name.replace(/\.docx?$/i, "")}.pdf`, { type: "application/pdf" });
  } finally {
    document.body.removeChild(container);
  }
}
