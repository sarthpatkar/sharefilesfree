/**
 * Strips characters from a filename that have no business being in one — most
 * importantly control characters and CR/LF.
 *
 * It was written to stop a crafted filename injecting headers into a
 * Content-Disposition response, which no longer exists — nothing is served from
 * here any more. What it still guards is the receiving end: a filename arrives
 * over the data channel from a stranger's machine and gets written to the
 * folder the receiver chose, so it is untrusted input either way.
 */
export function sanitizeFilename(name: string): string {
  // Deliberately stripping control characters (including CR/LF) and double quotes.
  const cleaned = name.replace(/[\x00-\x1f\x7f"]/g, "").trim();
  return (cleaned || "file").slice(0, 255);
}
