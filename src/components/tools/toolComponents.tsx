"use client";

/**
 * Every tool's actual processing widget, loaded on demand — split out of the
 * registry deliberately, because pulling in a tool's icon/title/slug (which
 * the homepage, the footer, and the /tools index all do, just to render a
 * link) used to pull in its processing library too. registry.tsx used to hold
 * a direct `Component: MergePdfsTool` reference per tool, so importing TOOLS
 * anywhere dragged in every tool's component tree — and several of those
 * import tesseract.js, mammoth, docx, jsPDF, html2canvas, pdf-lib and xlsx at
 * module scope, each hundreds of KB on its own. The homepage was shipping all
 * of that, unused, before a visitor had touched a single tool.
 *
 * next/dynamic gives each one its own chunk, fetched only when its
 * /tools/[slug] page actually renders it. ssr: false is safe and correct
 * here — every one of these needs the File/Canvas/Worker APIs a real browser
 * provides, so there was never anything meaningful to render on the server;
 * the surrounding page (title, steps, FAQs) stays server-rendered for SEO,
 * only the interactive widget itself hydrates in.
 */
import dynamic from "next/dynamic";
import type { ComponentType } from "react";

type ToolComponent = ComponentType<{ onSend?: (file: File) => void }>;

function ToolLoading() {
  return (
    <p className="py-16 text-center text-[14px] font-semibold uppercase tracking-[0.1em] text-black opacity-50">
      Loading tool…
    </p>
  );
}

export const TOOL_COMPONENTS: Record<string, ToolComponent> = {
  "merge-pdf": dynamic(() => import("./MergePdfsTool").then((m) => m.MergePdfsTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "split-pdf": dynamic(() => import("./SplitPdfTool").then((m) => m.SplitPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "organize-pdf": dynamic(() => import("./OrganizePdfTool").then((m) => m.OrganizePdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "compress-pdf": dynamic(() => import("./CompressPdfTool").then((m) => m.CompressPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "watermark-pdf": dynamic(() => import("./WatermarkTool").then((m) => m.WatermarkTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "add-page-numbers": dynamic(() => import("./PageNumbersTool").then((m) => m.PageNumbersTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "images-to-pdf": dynamic(() => import("./ImagesToPdfTool").then((m) => m.ImagesToPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "word-to-pdf": dynamic(() => import("./WordToPdfTool").then((m) => m.WordToPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "excel-to-pdf": dynamic(() => import("./ExcelToPdfTool").then((m) => m.ExcelToPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "pdf-to-powerpoint": dynamic(() => import("./PdfToPowerPointTool").then((m) => m.PdfToPowerPointTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "pdf-to-word": dynamic(() => import("./PdfToWordTool").then((m) => m.PdfToWordTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "pdf-to-excel": dynamic(() => import("./PdfToExcelTool").then((m) => m.PdfToExcelTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "pdf-to-markdown": dynamic(() => import("./PdfToMarkdownTool").then((m) => m.PdfToMarkdownTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "compress-image": dynamic(() => import("./CompressImageTool").then((m) => m.CompressImageTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "resize-image": dynamic(() => import("./ResizeImageTool").then((m) => m.ResizeImageTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "heic-to-jpg": dynamic(() => import("./HeicToJpgTool").then((m) => m.HeicToJpgTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "qr-code-generator": dynamic(() => import("./QrCodeTool").then((m) => m.QrCodeTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "csv-excel-converter": dynamic(() => import("./CsvExcelTool").then((m) => m.CsvExcelTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "ocr-pdf": dynamic(() => import("./OcrTool").then((m) => m.OcrTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "rotate-pdf": dynamic(() => import("./RotatePdfTool").then((m) => m.RotatePdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "edit-pdf": dynamic(() => import("./EditPdfTool").then((m) => m.EditPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "flatten-pdf": dynamic(() => import("./FlattenPdfTool").then((m) => m.FlattenPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "txt-to-pdf": dynamic(() => import("./TextToPdfTool").then((m) => m.TextToPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
  "csv-to-pdf": dynamic(() => import("./CsvToPdfTool").then((m) => m.CsvToPdfTool), {
    ssr: false,
    loading: ToolLoading,
  }),
};
