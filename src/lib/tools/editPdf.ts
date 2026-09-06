// Draws text, shapes, freehand strokes, highlighter and images onto an existing
// PDF — the writing half of the Edit PDF tool.
//
// "Edit PDF" and "annotate PDF" are the same job
// ----------------------------------------------
// People search for both, and they want the same thing: a signature on a
// contract, a circle round the wrong number on an invoice, an arrow and the
// word "here", a scanned form filled in by hand. So this is one tool, not two.
// What it deliberately is NOT is a word processor for the text already in the
// document — see the tool page for why that is a different (and much larger)
// problem.
//
// Coordinates
// -----------
// Every annotation is stored in PDF user space, in points, exactly as pdf.js's
// `viewport.convertToPdfPoint()` hands it over. That single decision removes
// two whole classes of bug:
//
//   * Zoom cannot corrupt anything. The on-screen scale is a property of the
//     view, so changing it re-projects the annotations rather than editing them.
//   * Pages with a baked-in /Rotate land in the right place. pdf.js's viewport
//     already accounts for it; the manual `y = height - y` flip that people
//     reach for first does not, and silently puts every mark on a rotated page
//     in the wrong corner.
//
// pdf-lib draws in the same unrotated user space, so positions carry straight
// across. Orientation does not: a glyph drawn at 0 degrees onto a page carrying
// /Rotate 90 is turned on its side by the viewer. So text and images are drawn
// turned by the page's own rotation, which cancels it out and lands them
// upright on screen — see `screenFrame()`.
import { PDFDocument, StandardFonts, BlendMode, LineCapStyle, degrees, type PDFFont, type PDFPage } from "pdf-lib";
import { hexToRgb } from "./pdfColor";

export interface Point {
  x: number;
  y: number;
}

export type FontChoice = "sans" | "serif" | "mono";

/** The PNG/JPEG bytes behind one or more image annotations. `id` lets a picture placed twice be embedded once. */
export interface ImageSource {
  id: string;
  format: "png" | "jpg";
  bytes: Uint8Array;
}

interface AnnotationBase {
  id: string;
  /** 1-based, matching what the page selector shows. */
  page: number;
}

export interface TextAnnotation extends AnnotationBase {
  kind: "text";
  /** Start of the baseline, in PDF points. */
  at: Point;
  text: string;
  size: number;
  color: string;
  font: FontChoice;
  bold: boolean;
}

export interface ShapeAnnotation extends AnnotationBase {
  kind: "rect" | "ellipse";
  /** Opposite corners, in either order. */
  from: Point;
  to: Point;
  color: string;
  /** Hex fill, or null for an outline only. */
  fill: string | null;
  thickness: number;
  opacity: number;
}

export interface InkAnnotation extends AnnotationBase {
  kind: "ink";
  points: Point[];
  color: string;
  thickness: number;
  opacity: number;
  /** Highlighter strokes multiply with the page so the words underneath stay readable. */
  highlighter: boolean;
}

export interface ImageAnnotation extends AnnotationBase {
  kind: "image";
  from: Point;
  to: Point;
  source: ImageSource;
}

export type Annotation = TextAnnotation | ShapeAnnotation | InkAnnotation | ImageAnnotation;

const FONTS: Record<FontChoice, { regular: StandardFonts; bold: StandardFonts }> = {
  sans: { regular: StandardFonts.Helvetica, bold: StandardFonts.HelveticaBold },
  serif: { regular: StandardFonts.TimesRoman, bold: StandardFonts.TimesRomanBold },
  mono: { regular: StandardFonts.Courier, bold: StandardFonts.CourierBold },
};

/**
 * The characters the 14 built-in PDF fonts can actually write.
 *
 * They are encoded as WinAnsi (CP1252), which is Latin-1 plus a handful of
 * typographic extras. Anything outside it — Greek, Cyrillic, Chinese, emoji —
 * has no code point in the font and pdf-lib throws while saving. Supporting
 * those would mean shipping and subsetting a Unicode font, which is a
 * megabyte-plus download on every visit to a tool most people use for the word
 * "APPROVED", so the honest answer is to say what is missing up front.
 */
const CP1252_EXTRAS = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

function isWritable(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  if (code === 0x0a || code === 0x0d || code === 0x09) return true;
  if (code >= 0x20 && code <= 0x7e) return true;
  if (code >= 0xa0 && code <= 0xff) return true;
  return CP1252_EXTRAS.includes(char);
}

/** The distinct characters in `text` that the built-in fonts cannot write. Empty means the text is safe to draw. */
export function unwritableCharacters(text: string): string[] {
  const bad = new Set<string>();
  for (const char of text) if (!isWritable(char)) bad.add(char);
  return [...bad];
}

function normaliseBox(from: Point, to: Point) {
  const x0 = Math.min(from.x, to.x);
  const y0 = Math.min(from.y, to.y);
  return { x: x0, y: y0, width: Math.abs(to.x - from.x), height: Math.abs(to.y - from.y) };
}

/**
 * Where something rectangular should be anchored, and how it should be turned,
 * so that it reads the right way up on a page carrying /Rotate.
 *
 * The box arrives axis-aligned in user space (a rotation by a multiple of 90
 * keeps it that way). What changes with rotation is which of its four corners
 * the viewer will show at the bottom-left, and which way "along the width" then
 * points — so the anchor moves round the box and the drawing is turned by the
 * page's own angle.
 */
export function screenFrame(from: Point, to: Point, rotation: number) {
  const { x, y, width, height } = normaliseBox(from, to);
  const angle = ((rotation % 360) + 360) % 360;
  const swapped = angle === 90 || angle === 270;
  const size = { width: swapped ? height : width, height: swapped ? width : height };
  const anchors: Record<number, Point> = {
    0: { x, y },
    90: { x: x + width, y },
    180: { x: x + width, y: y + height },
    270: { x, y: y + height },
  };
  return { ...size, ...anchors[angle in anchors ? angle : 0], rotate: angle in anchors ? angle : 0 };
}

function drawText(page: PDFPage, annotation: TextAnnotation, font: PDFFont, rotation: number) {
  const bad = unwritableCharacters(annotation.text);
  if (bad.length > 0) {
    throw new Error(`The built-in PDF fonts can't write ${bad.map((c) => `"${c}"`).join(", ")}. Remove those characters and try again.`);
  }
  page.drawText(annotation.text, {
    x: annotation.at.x,
    y: annotation.at.y,
    size: annotation.size,
    font,
    color: hexToRgb(annotation.color),
    rotate: degrees(rotation),
  });
}

function drawShape(page: PDFPage, annotation: ShapeAnnotation) {
  const { x, y, width, height } = normaliseBox(annotation.from, annotation.to);
  if (width < 0.5 || height < 0.5) return;
  // Built by spreading rather than by passing `color: undefined`, because
  // pdf-lib tests for the *key* — an explicit undefined still counts as "the
  // caller asked for a fill" and suppresses its default border.
  const fill = annotation.fill ? { color: hexToRgb(annotation.fill), opacity: annotation.opacity } : {};
  const stroke = {
    borderColor: hexToRgb(annotation.color),
    borderWidth: annotation.thickness,
    borderOpacity: annotation.opacity,
  };
  if (annotation.kind === "rect") {
    page.drawRectangle({ x, y, width, height, ...fill, ...stroke });
  } else {
    page.drawEllipse({ x: x + width / 2, y: y + height / 2, xScale: width / 2, yScale: height / 2, ...fill, ...stroke });
  }
}

function drawInk(page: PDFPage, annotation: InkAnnotation) {
  if (annotation.points.length === 0) return;
  // The whole stroke goes down as ONE path rather than as a line per pair of
  // points. Drawing it segment by segment looked identical for the pen but was
  // wrong for the highlighter: each translucent segment composites over the
  // last, so every overlapping round cap darkens and the stroke comes out
  // beaded. One path is also one graphics state instead of a few hundred, which
  // is the difference between a signature costing bytes and costing kilobytes.
  //
  // drawSvgPath draws in SVG's coordinate system, whose y axis runs the other
  // way, so the path is written with y negated and the library's own
  // scale(1, -1) puts it back.
  const [first, ...rest] = annotation.points;
  const segments = rest.length > 0 ? rest : [first]; // a tap, not a drag — still worth a dot
  const path = `M ${first.x} ${-first.y} ` + segments.map((p) => `L ${p.x} ${-p.y}`).join(" ");

  page.drawSvgPath(path, {
    x: 0,
    y: 0,
    borderColor: hexToRgb(annotation.color),
    borderWidth: annotation.thickness,
    borderLineCap: LineCapStyle.Round,
    // Only set when they differ from the default: pdf-lib writes a separate
    // ExtGState object whenever either is present, and a plain pen stroke has
    // no need of one.
    ...(annotation.opacity < 1 ? { borderOpacity: annotation.opacity } : {}),
    // Multiply keeps the words under a highlighter legible instead of veiling
    // them, which is the whole reason real highlighter ink is transparent
    // rather than pale paint.
    ...(annotation.highlighter ? { blendMode: BlendMode.Multiply } : {}),
  });
}

export interface EditPdfResult {
  file: File;
  /** How many annotations were written, for the "done" message. */
  drawn: number;
}

export async function editPdf(file: File, annotations: Annotation[]): Promise<EditPdfResult> {
  if (annotations.length === 0) throw new Error("Add something to the page first — text, a shape, a drawing or an image.");

  const doc = await PDFDocument.load(await file.arrayBuffer());
  const pages = doc.getPages();

  // Fonts and images are embedded once each and reused. A signature dropped on
  // forty pages should add one image to the file, not forty.
  const fontCache = new Map<string, PDFFont>();
  const imageCache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();

  for (const annotation of annotations) {
    const page = pages[annotation.page - 1];
    if (!page) throw new Error(`That PDF has no page ${annotation.page}.`);
    const rotation = page.getRotation().angle;

    if (annotation.kind === "text") {
      const key = `${annotation.font}-${annotation.bold}`;
      let font = fontCache.get(key);
      if (!font) {
        const family = FONTS[annotation.font] ?? FONTS.sans;
        font = await doc.embedFont(annotation.bold ? family.bold : family.regular);
        fontCache.set(key, font);
      }
      drawText(page, annotation, font, rotation);
    } else if (annotation.kind === "image") {
      let image = imageCache.get(annotation.source.id);
      if (!image) {
        image =
          annotation.source.format === "png"
            ? await doc.embedPng(annotation.source.bytes)
            : await doc.embedJpg(annotation.source.bytes);
        imageCache.set(annotation.source.id, image);
      }
      const frame = screenFrame(annotation.from, annotation.to, rotation);
      if (frame.width < 0.5 || frame.height < 0.5) continue;
      page.drawImage(image, { x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotate: degrees(frame.rotate) });
    } else if (annotation.kind === "ink") {
      drawInk(page, annotation);
    } else {
      drawShape(page, annotation);
    }
  }

  const bytes = await doc.save();
  return {
    file: new File([bytes as BlobPart], `${file.name.replace(/\.pdf$/i, "")}-edited.pdf`, { type: "application/pdf" }),
    drawn: annotations.length,
  };
}

/**
 * Turns a picked image file into bytes pdf-lib can embed.
 *
 * Browser-only: pdf-lib takes PNG and JPEG and nothing else, so a WebP, a GIF
 * or an AVIF is re-encoded through a canvas first rather than being refused.
 */
export async function imageSourceFromFile(file: File): Promise<ImageSource> {
  const id = `${file.name}-${file.size}-${file.lastModified}`;
  if (file.type === "image/png") return { id, format: "png", bytes: new Uint8Array(await file.arrayBuffer()) };
  if (file.type === "image/jpeg") return { id, format: "jpg", bytes: new Uint8Array(await file.arrayBuffer()) };

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support image processing.");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Couldn't read ${file.name}.`))), "image/png");
  });
  return { id, format: "png", bytes: new Uint8Array(await blob.arrayBuffer()) };
}
