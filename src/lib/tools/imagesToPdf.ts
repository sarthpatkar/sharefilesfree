// Combines one or more images into a single PDF, entirely client-side via
// pdf-lib (pure JS, no server round-trip).
import { PDFDocument, type PDFImage } from "pdf-lib";

export type PageSizeMode = "fit-image" | "a4" | "letter";
export type Orientation = "portrait" | "landscape";

export interface ImagesToPdfOptions {
  pageSize: PageSizeMode;
  orientation: Orientation;
  /** Points of blank space around the image when using a fixed page size (A4/Letter). Ignored for "fit-image". */
  marginPt: number;
}

const PAGE_SIZES_PT: Record<Exclude<PageSizeMode, "fit-image">, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612, height: 792 },
};

async function toEmbeddableBytes(file: File): Promise<{ bytes: ArrayBuffer; kind: "png" | "jpg" }> {
  // pdf-lib can only embed PNG and JPEG directly. Anything else (WebP, GIF, etc.)
  // gets re-encoded to PNG via canvas first — invisible to the user, just a
  // couple extra lines rather than a hard "unsupported format" wall.
  if (file.type === "image/png") return { bytes: await file.arrayBuffer(), kind: "png" };
  if (file.type === "image/jpeg") return { bytes: await file.arrayBuffer(), kind: "jpg" };

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support image processing.");
  ctx.drawImage(bitmap, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(`Couldn't read ${file.name}.`))), "image/png");
  });
  return { bytes: await blob.arrayBuffer(), kind: "png" };
}

function fitContain(image: PDFImage, boxWidth: number, boxHeight: number) {
  const scale = Math.min(boxWidth / image.width, boxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width, height, x: (boxWidth - width) / 2, y: (boxHeight - height) / 2 };
}

export async function imagesToPdf(files: File[], options: ImagesToPdfOptions = { pageSize: "fit-image", orientation: "portrait", marginPt: 0 }): Promise<File> {
  if (files.length === 0) throw new Error("Pick at least one image.");

  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const { bytes, kind } = await toEmbeddableBytes(file);
    const image = kind === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

    if (options.pageSize === "fit-image") {
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      continue;
    }

    const base = PAGE_SIZES_PT[options.pageSize];
    const [pageWidth, pageHeight] =
      options.orientation === "landscape" ? [Math.max(base.width, base.height), Math.min(base.width, base.height)] : [Math.min(base.width, base.height), Math.max(base.width, base.height)];
    const page = pdfDoc.addPage([pageWidth, pageHeight]);
    const margin = options.marginPt;
    const { width, height, x, y } = fitContain(image, pageWidth - margin * 2, pageHeight - margin * 2);
    page.drawImage(image, { x: x + margin, y: y + margin, width, height });
  }

  const pdfBytes = await pdfDoc.save();
  const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : "images";
  // pdf-lib's Uint8Array is typed over ArrayBufferLike, which TS's DOM lib no
  // longer accepts as BlobPart without a cast — a real Uint8Array at runtime
  // either way, so this is just satisfying the type checker.
  return new File([pdfBytes as BlobPart], `${name}.pdf`, { type: "application/pdf" });
}
