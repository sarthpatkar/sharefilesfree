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

/**
 * Renders a page and hands back the viewport that drew it.
 *
 * Edit PDF needs the viewport itself, not just the picture: `convertToPdfPoint`
 * is the only correct way to turn a click into a position in the document, and
 * it is the viewport that knows the scale, the page's own /Rotate and the
 * offset of its crop box. Doing that arithmetic by hand is where annotation
 * tools go wrong on rotated scans.
 */
export async function renderPageWithViewport(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, scale: number): Promise<{ dataUrl: string; viewport: pdfjsLib.PageViewport; canvas: HTMLCanvasElement }> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("This browser doesn't support canvas rendering.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  // The canvas is handed back as well as the picture: covering a line of text
  // to retype it needs the colour of the paper around it, and that can only be
  // had by reading pixels.
  return { dataUrl: canvas.toDataURL("image/png"), viewport, canvas };
}

/**
 * The colour of the page immediately around a box, as `#rrggbb`.
 *
 * Used to patch over a line of text that is being retyped. Sampled in a ring
 * just outside the box and reduced to the most common value rather than an
 * average: a mean of white paper and black glyphs is grey, which would leave a
 * visible smudge, whereas the mode is the paper itself. White is the answer for
 * most documents, but not for a coloured table row or a tinted form.
 */
export function sampleBackground(canvas: HTMLCanvasElement, box: { x: number; y: number; width: number; height: number }): string {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#ffffff";
  const counts = new Map<string, number>();
  const clampX = (v: number) => Math.min(Math.max(Math.round(v), 0), canvas.width - 1);
  const clampY = (v: number) => Math.min(Math.max(Math.round(v), 0), canvas.height - 1);
  const pad = 3;

  for (let i = 0; i <= 12; i++) {
    const x = clampX(box.x + (box.width * i) / 12);
    for (const y of [clampY(box.y - pad), clampY(box.y + box.height + pad)]) {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      // Quantised, so anti-aliasing noise around the glyphs collapses onto the
      // paper colour instead of splitting the vote between near-identical shades.
      const key = `${r >> 3}-${g >> 3}-${b >> 3}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  if (!best) return "#ffffff";
  const [r, g, b] = best.split("-").map((v) => Math.min(Number(v) * 8 + 4, 255));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
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

/**
 * Where each run of text sits on the page, for snapping mark-up to it.
 *
 * `transform` is the run's text matrix in PDF user space and `width` its
 * advance in the same units — both straight from pdf.js. They are kept raw
 * rather than converted, because the on-screen box depends on the viewport and
 * the viewport changes every time somebody zooms.
 */
export interface PageTextRun {
  transform: number[];
  width: number;
  str: string;
  /** CSS family pdf.js resolved for the run — "sans-serif", "serif", "monospace" or a real name. */
  fontFamily: string;
  /** pdf.js's internal font id; its text usually carries "Bold" / "Italic" / "Oblique". */
  fontName: string;
}

export async function extractPageTextRuns(pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number): Promise<PageTextRun[]> {
  const page = await pdf.getPage(pageNumber);
  const content = await page.getTextContent();
  const runs: PageTextRun[] = [];
  const styles = content.styles as Record<string, { fontFamily?: string } | undefined>;
  for (const item of content.items) {
    // Whitespace-only runs would stretch a highlight into the margin.
    if (!("str" in item) || !item.str.trim()) continue;
    runs.push({
      transform: item.transform,
      width: item.width,
      str: item.str,
      fontFamily: styles?.[item.fontName]?.fontFamily ?? "sans-serif",
      fontName: item.fontName ?? "",
    });
  }
  return runs;
}

/** A text run's box in viewport (CSS pixel) coordinates, plus its baseline. */
export interface TextRunBox {
  x: number;
  y: number;
  width: number;
  height: number;
  baseline: number;
}

/**
 * Projects a text run onto the screen through the current viewport.
 *
 * The viewport's transform already folds in the scale and the page's own
 * /Rotate, so composing it with the run's text matrix gives the run's position
 * as drawn — no separate rotation case to get wrong. Returns null for text that
 * is not horizontal on screen (a rotated watermark, a sideways table header),
 * which a rectangular highlight cannot honestly represent.
 */
export function textRunBox(run: PageTextRun, viewport: pdfjsLib.PageViewport): TextRunBox | null {
  const [a, b, c, d, e, f] = viewport.transform;
  const [a2, b2, c2, d2, e2, f2] = run.transform;
  // The 2x3 affine product, spelled out rather than pulled from pdf.js's
  // internal Util so this keeps working if that export moves.
  const m = [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f];

  const height = Math.hypot(m[2], m[3]);
  if (!(height > 0)) return null;
  if (Math.abs(m[1]) > Math.abs(m[0]) * 0.25) return null;

  const width = run.width * viewport.scale;
  // Text running right-to-left on screen (a page turned 180) starts at the
  // right-hand edge of its own box.
  const x = m[0] < 0 ? m[4] - width : m[4];
  // Ascent above the baseline, descent below — the proportions a highlighter
  // covers, rather than the em box, which sits noticeably high.
  return { x, y: m[5] - height * 0.8, width, height: height * 1.0, baseline: m[5] };
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
