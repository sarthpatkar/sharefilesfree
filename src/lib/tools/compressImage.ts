// Client-side image compression via the Canvas API — no server, no upload,
// no library needed. This matters for the product's cost model too: unlike
// the transfer features, a "compress this file" utility that ran on our
// server would burn CPU we'd have to pay for on every use; doing it in the
// visitor's own browser keeps it genuinely free at any scale.
export type CompressFormat = "jpeg" | "webp" | "png";

export interface CompressOptions {
  /** 0-1. Ignored for "png" (canvas encodes PNG losslessly regardless). */
  quality: number;
  format: CompressFormat;
  /** Downscale if wider than this, preserving aspect ratio. */
  maxWidth?: number;
}

export async function compressImage(file: File, { quality, format, maxWidth }: CompressOptions): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support image processing.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const mimeType = `image/${format}`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compression failed."))), mimeType, format === "png" ? undefined : quality);
  });

  // A browser that can't encode the requested format silently falls back to
  // PNG in toBlob rather than erroring — catch that so the UI can say so
  // instead of quietly handing back an unexpectedly large "compressed" file.
  if (format !== "png" && blob.type === "image/png") {
    throw new Error(`This browser can't encode ${format.toUpperCase()} — try JPEG instead.`);
  }

  const ext = format === "jpeg" ? "jpg" : format;
  const newName = `${file.name.replace(/\.[^.]+$/, "")}.${ext}`;
  return new File([blob], newName, { type: mimeType });
}
