/**
 * Parses a human page-range string like "1,3-5,8" into a sorted, deduped,
 * 0-indexed array of page indices, clamped to a document's real page count.
 * A blank/whitespace-only string means "every page" — the common default.
 */
export function parsePageRange(input: string, pageCount: number): number[] {
  const trimmed = input.trim();
  if (!trimmed) return Array.from({ length: pageCount }, (_, i) => i);

  const indices = new Set<number>();
  for (const part of trimmed.split(",")) {
    const piece = part.trim();
    if (!piece) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(piece);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(pageCount, parseInt(rangeMatch[2], 10));
      for (let n = start; n <= end; n++) indices.add(n - 1);
      continue;
    }
    const single = parseInt(piece, 10);
    if (!Number.isNaN(single) && single >= 1 && single <= pageCount) {
      indices.add(single - 1);
    }
  }

  if (indices.size === 0) throw new Error(`No valid pages found in "${input}" — try something like "1,3-5".`);
  return Array.from(indices).sort((a, b) => a - b);
}
