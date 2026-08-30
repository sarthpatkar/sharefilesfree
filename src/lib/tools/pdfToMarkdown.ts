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

export async function pdfToMarkdown(file: File): Promise<File> {
  const pdf = await loadPdf(file);
  const allLines: PageTextLine[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    allLines.push(...(await extractPageLines(pdf, i)));
  }
  if (allLines.length === 0) throw new Error("Couldn't find any text in this PDF (it may be a scanned image).");

  const bodySize = median(allLines.map((l) => l.fontSize).filter(Boolean));
  const md = allLines
    .map((line) => {
      if (line.fontSize > bodySize * 1.5) return `# ${line.text}`;
      if (line.fontSize > bodySize * 1.2) return `## ${line.text}`;
      if (/^[•\-*]\s/.test(line.text)) return `- ${line.text.replace(/^[•\-*]\s/, "")}`;
      return line.text;
    })
    .join("\n\n");

  const blob = new Blob([md], { type: "text/markdown" });
  return new File([blob], `${file.name.replace(/\.pdf$/i, "")}.md`, { type: "text/markdown" });
}
