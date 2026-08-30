// Single source of truth for every tool: its URL slug, SEO copy, grouping,
// icon, and component. Both the in-page Tools directory (Home.tsx's Tools
// tab) and the real indexable /tools/[slug] pages read from this — one place
// to add a tool instead of wiring it into two UIs separately.
import type { ComponentType, SVGProps } from "react";
import {
  IconShrink,
  IconStack,
  IconScissors,
  IconLayers,
  IconStamp,
  IconHash,
  IconFileText,
  IconGrid,
  IconPresentation,
  IconMarkdown,
  IconQrCode,
  IconImage,
  IconTextScan,
} from "../icons";
import { CompressImageTool } from "./CompressImageTool";
import { ImagesToPdfTool } from "./ImagesToPdfTool";
import { MergePdfsTool } from "./MergePdfsTool";
import { SplitPdfTool } from "./SplitPdfTool";
import { OrganizePdfTool } from "./OrganizePdfTool";
import { CompressPdfTool } from "./CompressPdfTool";
import { WatermarkTool } from "./WatermarkTool";
import { PageNumbersTool } from "./PageNumbersTool";
import { WordToPdfTool } from "./WordToPdfTool";
import { ExcelToPdfTool } from "./ExcelToPdfTool";
import { PdfToPowerPointTool } from "./PdfToPowerPointTool";
import { PdfToWordTool } from "./PdfToWordTool";
import { PdfToExcelTool } from "./PdfToExcelTool";
import { PdfToMarkdownTool } from "./PdfToMarkdownTool";
import { ResizeImageTool } from "./ResizeImageTool";
import { HeicToJpgTool } from "./HeicToJpgTool";
import { QrCodeTool } from "./QrCodeTool";
import { CsvExcelTool } from "./CsvExcelTool";
import { OcrTool } from "./OcrTool";

export interface ToolDef {
  slug: string;
  title: string;
  /** Full <title> tag copy for the dedicated page. */
  seoTitle: string;
  /** Meta description for the dedicated page. */
  description: string;
  /** One-line blurb for the directory card. */
  cardBlurb: string;
  group: "PDF pages" | "Convert to PDF" | "Convert from PDF" | "Images" | "Utilities";
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  caveat?: string;
  /** Whether "Send this file" (handoff to the Send tab) makes sense for this tool's output. */
  canSend: boolean;
  Component: ComponentType<{ onSend?: (file: File) => void }>;
}

export const TOOLS: ToolDef[] = [
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    seoTitle: "Merge PDF Files Free, No Signup — ShareFilesFree",
    description: "Combine multiple PDFs into one file, in any order you choose. Free, no signup, runs entirely in your browser.",
    cardBlurb: "Combine PDFs in any order",
    group: "PDF pages",
    icon: IconStack,
    canSend: true,
    Component: MergePdfsTool,
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    seoTitle: "Split PDF Free — Extract Pages, No Signup — ShareFilesFree",
    description: "Extract a page range or split every page into its own PDF. Free, private — your file never leaves your browser.",
    cardBlurb: "Extract a range, or every page",
    group: "PDF pages",
    icon: IconScissors,
    canSend: true,
    Component: SplitPdfTool,
  },
  {
    slug: "organize-pdf",
    title: "Organize PDF",
    seoTitle: "Organize PDF Pages Free — Reorder, Rotate, Delete — ShareFilesFree",
    description: "Reorder, rotate, or delete PDF pages using a visual thumbnail view. Free and entirely browser-based.",
    cardBlurb: "Reorder, rotate, delete pages",
    group: "PDF pages",
    icon: IconLayers,
    canSend: true,
    Component: OrganizePdfTool,
  },
  {
    slug: "compress-pdf",
    title: "Compress PDF",
    seoTitle: "Compress PDF Free — Reduce File Size — ShareFilesFree",
    description: "Shrink a PDF's file size, free and in your browser — light (lossless) or strong (smaller, image-based) modes.",
    cardBlurb: "Shrink file size",
    group: "PDF pages",
    icon: IconShrink,
    canSend: true,
    Component: CompressPdfTool,
  },
  {
    slug: "watermark-pdf",
    title: "Watermark PDF",
    seoTitle: "Add a Watermark to a PDF Free — ShareFilesFree",
    description: "Stamp custom text over every page of a PDF — choose the opacity, size, and rotation. Free, no signup.",
    cardBlurb: "Stamp text over every page",
    group: "PDF pages",
    icon: IconStamp,
    canSend: true,
    Component: WatermarkTool,
  },
  {
    slug: "add-page-numbers",
    title: "Add Page Numbers",
    seoTitle: "Add Page Numbers to a PDF Free — ShareFilesFree",
    description: "Number every page of a PDF — choose the position and starting number. Free and browser-based.",
    cardBlurb: "Number every page",
    group: "PDF pages",
    icon: IconHash,
    canSend: true,
    Component: PageNumbersTool,
  },
  {
    slug: "images-to-pdf",
    title: "Images to PDF",
    seoTitle: "Convert JPG/PNG to PDF Free — ShareFilesFree",
    description: "Combine one or more photos into a single PDF, free, with no signup or watermark.",
    cardBlurb: "Combine photos into one PDF",
    group: "Convert to PDF",
    icon: IconStack,
    canSend: true,
    Component: ImagesToPdfTool,
  },
  {
    slug: "word-to-pdf",
    title: "Word to PDF",
    seoTitle: "Convert Word (DOC/DOCX) to PDF Free — ShareFilesFree",
    description: "Convert a Word document to PDF for free, right in your browser — no upload, no signup.",
    cardBlurb: "DOC/DOCX to PDF",
    group: "Convert to PDF",
    icon: IconFileText,
    canSend: true,
    Component: WordToPdfTool,
  },
  {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    seoTitle: "Convert Excel (XLS/XLSX) to PDF Free — ShareFilesFree",
    description: "Convert an Excel spreadsheet to PDF for free, right in your browser.",
    cardBlurb: "XLS/XLSX to PDF",
    group: "Convert to PDF",
    icon: IconGrid,
    canSend: true,
    Component: ExcelToPdfTool,
  },
  {
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    seoTitle: "Convert PDF to PowerPoint Free — ShareFilesFree",
    description: "Turn each page of a PDF into a slide image in a real .pptx file — free, private, browser-based.",
    cardBlurb: "One slide image per page",
    group: "Convert from PDF",
    icon: IconPresentation,
    canSend: true,
    Component: PdfToPowerPointTool,
  },
  {
    slug: "pdf-to-word",
    title: "PDF to Word",
    seoTitle: "Convert PDF to Word Free (Basic Text Recovery) — ShareFilesFree",
    description: "Recover text from a PDF into an editable Word document. Basic text recovery — layout and images aren't preserved.",
    cardBlurb: "Text recovery, basic formatting",
    group: "Convert from PDF",
    icon: IconFileText,
    caveat: "Basic",
    canSend: true,
    Component: PdfToWordTool,
  },
  {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    seoTitle: "Convert PDF to Excel Free (Basic Text Extraction) — ShareFilesFree",
    description: "Extract text from a PDF into a spreadsheet, one line per row. Basic — not real table/column detection.",
    cardBlurb: "Text-per-line extraction",
    group: "Convert from PDF",
    icon: IconGrid,
    caveat: "Basic",
    canSend: true,
    Component: PdfToExcelTool,
  },
  {
    slug: "pdf-to-markdown",
    title: "PDF to Markdown",
    seoTitle: "Convert PDF to Markdown Free — ShareFilesFree",
    description: "Turn a PDF into a Markdown file — great for notes, docs, and feeding into an LLM. Free and browser-based.",
    cardBlurb: "Great for notes and docs",
    group: "Convert from PDF",
    icon: IconMarkdown,
    caveat: "Basic",
    canSend: true,
    Component: PdfToMarkdownTool,
  },
  {
    slug: "compress-image",
    title: "Compress Image",
    seoTitle: "Compress JPG/PNG/WebP Free — ShareFilesFree",
    description: "Shrink an image's file size — JPEG, WebP, or PNG output, adjustable quality. Free and private.",
    cardBlurb: "Shrink a JPG, PNG, or WebP",
    group: "Images",
    icon: IconShrink,
    canSend: true,
    Component: CompressImageTool,
  },
  {
    slug: "resize-image",
    title: "Resize Image",
    seoTitle: "Resize an Image Free — ShareFilesFree",
    description: "Resize an image to exact dimensions or a percentage, free and private, right in your browser.",
    cardBlurb: "Exact dimensions or a percentage",
    group: "Images",
    icon: IconImage,
    canSend: true,
    Component: ResizeImageTool,
  },
  {
    slug: "heic-to-jpg",
    title: "HEIC to JPG",
    seoTitle: "Convert HEIC to JPG Free — ShareFilesFree",
    description: "Convert iPhone HEIC photos to JPG so they open anywhere — free, private, no app install.",
    cardBlurb: "iPhone photos that open anywhere",
    group: "Images",
    icon: IconImage,
    canSend: true,
    Component: HeicToJpgTool,
  },
  {
    slug: "qr-code-generator",
    title: "QR Code Generator",
    seoTitle: "Free QR Code Generator, No Signup — ShareFilesFree",
    description: "Generate a QR code for any text or URL, free, with no signup or watermark.",
    cardBlurb: "For any text or URL",
    group: "Utilities",
    icon: IconQrCode,
    canSend: false,
    Component: QrCodeTool,
  },
  {
    slug: "csv-excel-converter",
    title: "CSV ↔ Excel",
    seoTitle: "Convert CSV to Excel or Excel to CSV Free — ShareFilesFree",
    description: "Convert a CSV file to XLSX, or an Excel spreadsheet to CSV — free and private.",
    cardBlurb: "Convert either direction",
    group: "Utilities",
    icon: IconGrid,
    canSend: true,
    Component: CsvExcelTool,
  },
  {
    slug: "ocr-pdf",
    title: "OCR (Scanned PDF/Image to Text)",
    seoTitle: "Free OCR — Extract Text from a Scanned PDF or Image — ShareFilesFree",
    description: "Extract text from a scanned PDF or photo using on-device OCR. Free, private, works offline once loaded.",
    cardBlurb: "Extract text from a scan or photo",
    group: "Utilities",
    icon: IconTextScan,
    caveat: "Experimental",
    canSend: true,
    Component: OcrTool,
  },
];

export const TOOL_GROUPS = ["PDF pages", "Convert to PDF", "Convert from PDF", "Images", "Utilities"] as const;

export function getToolBySlug(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
