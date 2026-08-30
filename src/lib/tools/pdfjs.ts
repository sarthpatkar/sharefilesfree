// Shared pdf.js setup — every tool that needs to *read* a PDF (render a page
// as an image, extract its text, count its pages) goes through this file so
// the worker gets configured exactly once.
import * as pdfjsLib from "pdfjs-dist";

let configured = false;
function ensureWorker() {
  if (configured) return;
  // Copied into /public by scripts/copy-pdf-worker.mjs (see package.json's
  // postinstall) — served as a plain static file rather than relying on
  // bundler-specific worker-asset resolution, which behaves differently
  // between webpack and Turbopack.
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  configured = true;
}

export async function loadPdf(file: File | ArrayBuffer) {
  ensureWorker();
  const data = file instanceof File ? await file.arrayBuffer() : file;
  const task = pdfjsLib.getDocument({ data });
  return task.promise;
}

/** Renders one page to a PNG data URL at the given scale (1 = 72dpi-ish CSS pixels, 2 ≈ retina). */
export async function renderPageToDataUrl(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale = 1): Promise<{ dataUrl: string; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support canvas rendering.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { dataUrl: canvas.toDataURL("image/png"), width: viewport.width, height: viewport.height };
}

/** Renders one page straight to a JPEG Blob (used when building output files, not previews). */
export async function renderPageToBlob(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support canvas rendering.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Rendering failed."))), "image/jpeg", quality);
  });
  return { blob, width: viewport.width, height: viewport.height };
}

export interface PageTextLine {
  text: string;
  fontSize: number;
}

/** Extracts text from one page as a flat list of lines with their font size (used for basic heading detection). */
export async function extractPageLines(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<PageTextLine[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const lines: PageTextLine[] = [];
  let currentY: number | null = null;
  let currentText = "";
  let currentFontSize = 0;

  for (const item of content.items) {
    if (!("str" in item)) continue;
    const y = item.transform[5];
    const fontSize = Math.hypot(item.transform[2], item.transform[3]);
    if (currentY === null || Math.abs(y - currentY) > 2) {
      if (currentText.trim()) lines.push({ text: currentText.trim(), fontSize: currentFontSize });
      currentText = item.str;
      currentY = y;
      currentFontSize = fontSize;
    } else {
      currentText += item.str;
    }
  }
  if (currentText.trim()) lines.push({ text: currentText.trim(), fontSize: currentFontSize });
  return lines;
}
