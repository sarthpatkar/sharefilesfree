// Combines one or more images into a single PDF, entirely client-side via
// pdf-lib (pure JS, no server round-trip). One page per image, sized to the
// image's own pixel dimensions so nothing gets cropped or distorted.
import { PDFDocument } from "pdf-lib";

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

export async function imagesToPdf(files: File[]): Promise<File> {
  if (files.length === 0) throw new Error("Pick at least one image.");

  const pdfDoc = await PDFDocument.create();
  for (const file of files) {
    const { bytes, kind } = await toEmbeddableBytes(file);
    const image = kind === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    const page = pdfDoc.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }

  const pdfBytes = await pdfDoc.save();
  const name = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, "") : "images";
  // pdf-lib's Uint8Array is typed over ArrayBufferLike, which TS's DOM lib no
  // longer accepts as BlobPart without a cast — a real Uint8Array at runtime
  // either way, so this is just satisfying the type checker.
  return new File([pdfBytes as BlobPart], `${name}.pdf`, { type: "application/pdf" });
}
