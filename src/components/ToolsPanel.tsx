"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { CompressImageTool } from "./tools/CompressImageTool";
import { ImagesToPdfTool } from "./tools/ImagesToPdfTool";
import { MergePdfsTool } from "./tools/MergePdfsTool";
import { SplitPdfTool } from "./tools/SplitPdfTool";
import { OrganizePdfTool } from "./tools/OrganizePdfTool";
import { CompressPdfTool } from "./tools/CompressPdfTool";
import { WatermarkTool } from "./tools/WatermarkTool";
import { PageNumbersTool } from "./tools/PageNumbersTool";
import { WordToPdfTool } from "./tools/WordToPdfTool";
import { ExcelToPdfTool } from "./tools/ExcelToPdfTool";
import { PdfToPowerPointTool } from "./tools/PdfToPowerPointTool";
import { PdfToWordTool } from "./tools/PdfToWordTool";
import { PdfToExcelTool } from "./tools/PdfToExcelTool";
import { PdfToMarkdownTool } from "./tools/PdfToMarkdownTool";
import {
  IconShrink,
  IconStack,
  IconArrowLeft,
  IconScissors,
  IconLayers,
  IconStamp,
  IconHash,
  IconFileText,
  IconGrid,
  IconPresentation,
  IconMarkdown,
} from "./icons";

type Tool =
  | "compress-image"
  | "images-to-pdf"
  | "merge-pdfs"
  | "split-pdf"
  | "organize-pdf"
  | "compress-pdf"
  | "watermark"
  | "page-numbers"
  | "word-to-pdf"
  | "excel-to-pdf"
  | "pdf-to-powerpoint"
  | "pdf-to-word"
  | "pdf-to-excel"
  | "pdf-to-markdown";

interface ToolMeta {
  id: Tool;
  title: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Set on tools whose output quality has an inherent, disclosed limitation — shown as a small badge. */
  caveat?: string;
}

const GROUPS: { label: string; tools: ToolMeta[] }[] = [
  {
    label: "PDF pages",
    tools: [
      { id: "merge-pdfs", title: "Merge PDF", description: "Combine PDFs in any order", icon: IconStack },
      { id: "split-pdf", title: "Split PDF", description: "Extract a range, or every page", icon: IconScissors },
      { id: "organize-pdf", title: "Organize PDF", description: "Reorder, rotate, delete pages", icon: IconLayers },
      { id: "compress-pdf", title: "Compress PDF", description: "Shrink file size", icon: IconShrink },
      { id: "watermark", title: "Watermark", description: "Stamp text over every page", icon: IconStamp },
      { id: "page-numbers", title: "Page numbers", description: "Add numbering to every page", icon: IconHash },
    ],
  },
  {
    label: "Convert to PDF",
    tools: [
      { id: "images-to-pdf", title: "Images to PDF", description: "Combine photos into one PDF", icon: IconStack },
      { id: "word-to-pdf", title: "Word to PDF", description: "DOC/DOCX to PDF", icon: IconFileText },
      { id: "excel-to-pdf", title: "Excel to PDF", description: "XLS/XLSX to PDF", icon: IconGrid },
    ],
  },
  {
    label: "Convert from PDF",
    tools: [
      { id: "pdf-to-powerpoint", title: "PDF to PowerPoint", description: "One slide image per page", icon: IconPresentation },
      { id: "pdf-to-word", title: "PDF to Word", description: "Text recovery, basic formatting", icon: IconFileText, caveat: "Basic" },
      { id: "pdf-to-excel", title: "PDF to Excel", description: "Text-per-line extraction", icon: IconGrid, caveat: "Basic" },
      { id: "pdf-to-markdown", title: "PDF to Markdown", description: "Great for notes and docs", icon: IconMarkdown, caveat: "Basic" },
    ],
  },
  {
    label: "Images",
    tools: [{ id: "compress-image", title: "Compress image", description: "Shrink a JPG, PNG, or WebP", icon: IconShrink }],
  },
];

const ALL_TOOLS = GROUPS.flatMap((g) => g.tools);

/** Client-side file tools — every conversion/compression happens entirely in the browser, no upload, no server cost. */
export function ToolsPanel({ onSendFile }: { onSendFile: (file: File) => void }) {
  const [active, setActive] = useState<Tool | null>(null);

  if (!active) {
    return (
      <div className="flex flex-col gap-6">
        {GROUPS.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{group.label}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {group.tools.map((tool) => (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => setActive(tool.id)}
                  className="relative flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition hover:border-accent hover:bg-accent/[.04]"
                >
                  {tool.caveat && (
                    <span className="absolute right-2 top-2 rounded-full bg-border px-1.5 py-0.5 text-[10px] font-medium text-muted">
                      {tool.caveat}
                    </span>
                  )}
                  <tool.icon className="h-6 w-6 text-accent" />
                  <span className="font-medium text-foreground">{tool.title}</span>
                  <span className="text-xs text-muted">{tool.description}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const meta = ALL_TOOLS.find((t) => t.id === active)!;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setActive(null)}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" /> All tools
      </button>
      <h3 className="flex items-center gap-2 font-medium text-foreground">
        <meta.icon className="h-5 w-5 text-accent" /> {meta.title}
      </h3>
      {active === "compress-image" && <CompressImageTool onSend={onSendFile} />}
      {active === "images-to-pdf" && <ImagesToPdfTool onSend={onSendFile} />}
      {active === "merge-pdfs" && <MergePdfsTool onSend={onSendFile} />}
      {active === "split-pdf" && <SplitPdfTool onSend={onSendFile} />}
      {active === "organize-pdf" && <OrganizePdfTool onSend={onSendFile} />}
      {active === "compress-pdf" && <CompressPdfTool onSend={onSendFile} />}
      {active === "watermark" && <WatermarkTool onSend={onSendFile} />}
      {active === "page-numbers" && <PageNumbersTool onSend={onSendFile} />}
      {active === "word-to-pdf" && <WordToPdfTool onSend={onSendFile} />}
      {active === "excel-to-pdf" && <ExcelToPdfTool onSend={onSendFile} />}
      {active === "pdf-to-powerpoint" && <PdfToPowerPointTool onSend={onSendFile} />}
      {active === "pdf-to-word" && <PdfToWordTool onSend={onSendFile} />}
      {active === "pdf-to-excel" && <PdfToExcelTool onSend={onSendFile} />}
      {active === "pdf-to-markdown" && <PdfToMarkdownTool onSend={onSendFile} />}
    </div>
  );
}
