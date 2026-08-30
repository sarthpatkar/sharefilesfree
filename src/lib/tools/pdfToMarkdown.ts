// Heuristic, not a real document-structure parser: headings are guessed from
// relative font size, bullet lists from a leading bullet character. Works
// reasonably on simply-formatted PDFs (reports, articles); won't reliably
// recover real tables (PDFs have no cell concept to begin with) or complex
// nested structure. Said plainly in the UI rather than promised as automatic.
import { loadPdf, extractPageLines, type PageTextLine } from "./pdfjs";

function median(nums: number[]): number {
  if (nums.length === 0) return 12;
  const sorted = [...nums].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export interface PdfToMarkdownOptions {
  /** Insert a "---" horizontal rule between each original PDF page. */
  pageSeparators: boolean;
}

export async function pdfToMarkdown(
  file: File,
  options: PdfToMarkdownOptions = { pageSeparators: false },
  onProgress?: (current: number, total: number) => void,
): Promise<File> {
  const pdf = await loadPdf(file);
  const pages: PageTextLine[][] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    pages.push(await extractPageLines(pdf, i));
    onProgress?.(i, pdf.numPages);
  }
  const allLines = pages.flat();
  if (allLines.length === 0) throw new Error("Couldn't find any text in this PDF (it may be a scanned image).");

  const bodySize = median(allLines.map((l) => l.fontSize).filter(Boolean));
  function renderLine(line: PageTextLine): string {
    if (line.fontSize > bodySize * 1.5) return `# ${line.text}`;
    if (line.fontSize > bodySize * 1.2) return `## ${line.text}`;
    if (/^[•\-*]\s/.test(line.text)) return `- ${line.text.replace(/^[•\-*]\s/, "")}`;
    return line.text;
  }

  const md = pages
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.map(renderLine).join("\n\n"))
    .join(options.pageSeparators ? "\n\n---\n\n" : "\n\n");

  const blob = new Blob([md], { type: "text/markdown" });
  return new File([blob], `${file.name.replace(/\.pdf$/i, "")}.md`, { type: "text/markdown" });
}
