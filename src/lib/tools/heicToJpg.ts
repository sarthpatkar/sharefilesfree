// heic2any wraps a WASM build of libheif — the only realistic way to decode
// Apple's HEIC format in a browser, since no browser other than Safari can
// even display one natively, let alone convert it.
//
// Dynamically imported (not a top-level import) because heic2any touches
// `window` as soon as its module is evaluated — a static import would break
// Next.js's server-side prerendering, which evaluates this module graph in
// Node (no `window`) even though the function itself only ever runs
// client-side, triggered by a user action.
export type HeicOutputFormat = "jpeg" | "png";

export interface HeicToJpgOptions {
  format: HeicOutputFormat;
  /** 0-1. Ignored for PNG (lossless regardless). */
  quality: number;
}

export async function heicToJpg(file: File, options: HeicToJpgOptions = { format: "jpeg", quality: 0.9 }): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  const result = await heic2any({ blob: file, toType: mimeType, quality: options.quality });
  const blob = (Array.isArray(result) ? result[0] : result) as Blob;
  const ext = options.format === "png" ? "png" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^.]+$/i, "")}.${ext}`, { type: mimeType });
}
