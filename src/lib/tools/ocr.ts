// Marked "Experimental" in the UI on purpose: Tesseract.js downloads a
// ~10-15MB language model on first use (cached by the browser afterward,
// which is also what makes it usable offline after that), and OCR accuracy
// on messy scans varies. Still entirely client-side — the scan never leaves
// the browser, which real OCR-as-a-service tools generally can't say.
import { createWorker } from "tesseract.js";
import { Document, Packer, Paragraph } from "docx";
import { loadPdf, renderPageToDataUrl } from "./pdfjs";

/** Tesseract's own trained-data language codes — a practical subset covering the most requested languages. Each is a separate model download, fetched only when picked. */
export const OCR_LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" },
  { code: "rus", label: "Russian" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "chi_sim", label: "Chinese (Simplified)" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
];

export async function runOcr(file: File, language: string, onProgress?: (current: number, total: number) => void): Promise<string> {
  // Reports progress as a percentage (0-100) of the *whole job*, not just the
  // page currently being recognized — combines page index with Tesseract's
  // own per-page progress so a multi-page PDF doesn't look like it resets to
  // 0% at the start of every page.
  let pageIndex = 0;
  let pageCount = 1;
  const worker = await createWorker(language, 1, {
    logger: (m) => {
      if (m.status === "recognizing text") {
        const overall = ((pageIndex + m.progress) / pageCount) * 100;
        onProgress?.(Math.round(overall), 100);
      }
    },
  });

  try {
    let text = "";
    if (file.type === "application/pdf") {
      const pdf = await loadPdf(file);
      pageCount = pdf.numPages;
      for (let i = 1; i <= pdf.numPages; i++) {
        pageIndex = i - 1;
        const { dataUrl } = await renderPageToDataUrl(pdf, i, 2);
        const { data } = await worker.recognize(dataUrl);
        text += `${i > 1 ? "\n\n" : ""}--- Page ${i} ---\n\n${data.text}`;
      }
    } else {
      const { data } = await worker.recognize(file);
      text = data.text;
    }
    if (!text.trim()) throw new Error("No text was recognized in this file.");
    return text.trim();
  } finally {
    await worker.terminate();
  }
}

export async function textToTxtFile(text: string, baseName: string): Promise<File> {
  const blob = new Blob([text], { type: "text/plain" });
  return new File([blob], `${baseName}-ocr.txt`, { type: "text/plain" });
}

export async function textToDocxFile(text: string, baseName: string): Promise<File> {
  const paragraphs = text.split("\n").map((line) => new Paragraph({ text: line }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return new File([blob], `${baseName}-ocr.docx`, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}
