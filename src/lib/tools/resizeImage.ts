export type ResizeMode = "exact" | "percent";

export interface ResizeOptions {
  mode: ResizeMode;
  width?: number;
  height?: number;
  percent?: number;
  format: "jpeg" | "png" | "webp";
  quality: number;
}

/** Common target sizes, shown as a shortcut in the "exact dimensions" UI. */
export const RESIZE_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "Instagram post (1080×1080)", width: 1080, height: 1080 },
  { label: "Instagram story (1080×1920)", width: 1080, height: 1920 },
  { label: "Facebook cover (820×312)", width: 820, height: 312 },
  { label: "YouTube thumbnail (1280×720)", width: 1280, height: 720 },
  { label: "Twitter/X header (1500×500)", width: 1500, height: 500 },
  { label: "LinkedIn banner (1584×396)", width: 1584, height: 396 },
  { label: "HD (1920×1080)", width: 1920, height: 1080 },
  { label: "Passport photo (600×600)", width: 600, height: 600 },
];

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
