"use client";

import { useState, type ComponentType, type SVGProps } from "react";
import { CompressImageTool } from "./tools/CompressImageTool";
import { ImagesToPdfTool } from "./tools/ImagesToPdfTool";
import { MergePdfsTool } from "./tools/MergePdfsTool";
import { IconShrink, IconStack, IconArrowLeft } from "./icons";

type Tool = "compress-image" | "images-to-pdf" | "merge-pdfs";

const TOOLS: { id: Tool; title: string; description: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "compress-image", title: "Compress image", description: "Shrink a JPG, PNG, or WebP", icon: IconShrink },
  { id: "images-to-pdf", title: "Images to PDF", description: "Combine photos into one PDF", icon: IconStack },
  { id: "merge-pdfs", title: "Merge PDFs", description: "Join PDFs into one file", icon: IconStack },
];

/** Client-side file tools — compression/conversion happens entirely in the browser, no upload, no server cost. */
export function ToolsPanel({ onSendFile }: { onSendFile: (file: File) => void }) {
  const [active, setActive] = useState<Tool | null>(null);

  if (!active) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            onClick={() => setActive(tool.id)}
            className="flex flex-col items-center gap-2 rounded-xl border border-border p-5 text-center transition hover:border-accent hover:bg-accent/[.04]"
          >
            <tool.icon className="h-6 w-6 text-accent" />
            <span className="font-medium text-foreground">{tool.title}</span>
            <span className="text-xs text-muted">{tool.description}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setActive(null)}
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <IconArrowLeft className="h-4 w-4" /> All tools
      </button>
      {active === "compress-image" && <CompressImageTool onSend={onSendFile} />}
      {active === "images-to-pdf" && <ImagesToPdfTool onSend={onSendFile} />}
      {active === "merge-pdfs" && <MergePdfsTool onSend={onSendFile} />}
    </div>
  );
}
