import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolsPanel } from "@/components/ToolsPanel";
import { TOOLS } from "@/components/tools/registry";

export const metadata: Metadata = {
  title: "Free PDF & File Tools — No Signup — ShareFilesFree",
  description:
    "Merge, split, compress, and convert PDFs and images for free, right in your browser. No signup, no upload — every tool runs on your device.",
};

export default function ToolsIndexPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="relative flex flex-1 flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="sff-grid absolute inset-0 opacity-60" />
          <div
            className="sff-aurora absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.13 }}
          />
          <div className="absolute inset-x-0 top-[420px] h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
          <header className="sff-enter flex flex-col items-center gap-4 text-center" style={{ "--i": 0 } as React.CSSProperties}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">{TOOLS.length} free tools</p>
            <h1 className="max-w-2xl font-display text-4xl font-medium leading-[1.08] tracking-[-0.025em] text-foreground sm:text-5xl">
              File tools that never see your files.
            </h1>
            <p className="max-w-lg text-pretty text-[17px] leading-relaxed text-muted">
              Every tool below runs entirely in your browser — no upload, no signup, no watermark, no daily limit.
            </p>
          </header>

          <div className="sff-enter mt-14" style={{ "--i": 1 } as React.CSSProperties}>
            <ToolsPanel />
          </div>

          <p className="sff-enter mt-14 text-center text-sm text-muted" style={{ "--i": 2 } as React.CSSProperties}>
            Need to move a file to another device instead?{" "}
            <Link href="/#send" className="font-medium text-accent transition-colors hover:text-accent-hover hover:underline">
              Send it with a 6-digit code
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
