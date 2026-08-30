// A one-shot, in-memory handoff for "send this file" from a standalone
// /tools/[slug] page to the Send tab on "/". Deliberately not React state —
// this needs to survive a client-side route change (a hard requirement
// once tools live on their own URLs for SEO), and a plain module-level
// variable does that for free as long as the browser tab doesn't hard-reload,
// which a Next.js <Link> navigation never does. Files aren't serializable
// (no sessionStorage/URL option), so this only works for in-app navigation —
// an acceptable scope limit, not a bug.
let pendingFile: File | null = null;

export function setHandoffFile(file: File) {
  pendingFile = file;
}

/** Reads and clears the pending file — call once, on the Send tab's mount. */
export function takeHandoffFile(): File | null {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
