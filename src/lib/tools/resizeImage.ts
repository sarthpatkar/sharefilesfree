export type ResizeMode = "exact" | "percent";

export interface ResizeOptions {
  mode: ResizeMode;
  width?: number;
  height?: number;
  percent?: number;
  format: "jpeg" | "png" | "webp";
  quality: number;
}

export async function resizeImage(file: File, opts: ResizeOptions): Promise<File> {
  const bitmap = await createImageBitmap(file);
  let width: number;
  let height: number;
  if (opts.mode === "percent") {
    const pct = Math.max(1, opts.percent ?? 100) / 100;
    width = Math.max(1, Math.round(bitmap.width * pct));
    height = Math.max(1, Math.round(bitmap.height * pct));
  } else {
    width = Math.max(1, opts.width ?? bitmap.width);
    height = Math.max(1, opts.height ?? bitmap.height);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser doesn't support image processing.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const mimeType = `image/${opts.format}`;
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Resize failed."))), mimeType, opts.format === "png" ? undefined : opts.quality);
  });
  const ext = opts.format === "jpeg" ? "jpg" : opts.format;
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-resized.${ext}`, { type: mimeType });
}
