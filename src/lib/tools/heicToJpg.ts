// heic2any wraps a WASM build of libheif — the only realistic way to decode
// Apple's HEIC format in a browser, since no browser other than Safari can
// even display one natively, let alone convert it.
//
// Dynamically imported (not a top-level import) because heic2any touches
// `window` as soon as its module is evaluated — a static import would break
// Next.js's server-side prerendering, which evaluates this module graph in
// Node (no `window`) even though the function itself only ever runs
// client-side, triggered by a user action.
export async function heicToJpg(file: File, quality = 0.9): Promise<File> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality });
  const blob = (Array.isArray(result) ? result[0] : result) as Blob;
  return new File([blob], `${file.name.replace(/\.[^.]+$/i, "")}.jpg`, { type: "image/jpeg" });
}
