/**
 * Strips characters from a filename that have no business being in one — most
 * importantly control characters and CR/LF. Without this, a crafted filename
 * could inject extra headers into the `Content-Disposition` response we build
 * around it in r2.ts (classic CRLF/header-injection). Applied at upload time
 * (upload-url route) so it's clean everywhere downstream, not re-derived per use.
 */
export function sanitizeFilename(name: string): string {
  // Deliberately stripping control characters (including CR/LF) and double quotes.
  const cleaned = name.replace(/[\x00-\x1f\x7f"]/g, "").trim();
  return (cleaned || "file").slice(0, 255);
}
