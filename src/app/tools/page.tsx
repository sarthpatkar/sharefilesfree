import type { Metadata } from "next";
import Link from "next/link";
import { ToolsPanel } from "@/components/ToolsPanel";

export const metadata: Metadata = {
  title: "Free PDF & File Tools — No Signup — ShareFilesFree",
  description:
    "Merge, split, compress, and convert PDFs and images for free, right in your browser. No signup, no upload — every tool runs on your device.",
};

export default function ToolsIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-14 sm:py-20">
      <header className="flex flex-col items-center gap-3 text-center">
        <Link href="/" className="text-sm text-accent hover:text-accent-hover hover:underline">
          ShareFilesFree
        </Link>
        <h1 className="font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl">Free PDF &amp; file tools</h1>
        <p className="max-w-md text-balance text-muted">
          Every tool below runs entirely in your browser — no upload, no signup, no size limit.
        </p>
      </header>
      <ToolsPanel />
    </main>
  );
}
