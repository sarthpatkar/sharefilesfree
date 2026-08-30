import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolsPanel } from "@/components/ToolsPanel";
import { GridBackdrop } from "@/components/landing/GridBackdrop";
import { TOOLS } from "@/components/tools/registry";

export const metadata: Metadata = {
  title: "Free PDF & File Tools — No Signup — ShareFilesFree",
  description:
    "Merge, split, compress, and convert PDFs and images for free, right in your browser. No signup, no upload — every tool runs on your device.",
};

export default function ToolsIndexPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden border-b border-rule">
          <GridBackdrop size={64} className="opacity-60" />
          <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
            <div className="flex items-center gap-4 border-b border-rule py-4">
              <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">
                {TOOLS.length} tools · all free
              </span>
            </div>
            <div className="grid gap-x-12 py-16 sm:py-24 lg:grid-cols-12">
              <h1 className="col-span-full font-display text-[clamp(2.6rem,8vw,6rem)] font-black leading-[0.88] tracking-[-0.028em] text-ink lg:col-span-8">
                <span className="block overflow-hidden pb-[0.07em]">
                  <span className="sff-line" style={{ "--i": 0 } as React.CSSProperties}>
                    File tools that
                  </span>
                </span>
                <span className="block overflow-hidden pb-[0.07em]">
                  <span className="sff-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>
                    never see your files.
                  </span>
                </span>
              </h1>
              <p
                className="sff-enter col-span-full mt-8 max-w-lg text-[17px] leading-[1.65] text-ink-soft lg:col-span-5"
                style={{ "--i": 4 } as React.CSSProperties}
              >
                Every tool below runs entirely in your browser — no upload, no signup, no watermark, no daily limit.
                Your file never leaves the device you opened this page on.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8 sm:py-20">
          <ToolsPanel />

          <p className="mt-20 border-t border-rule pt-8 text-[15px] text-ink-soft">
            Need to move a file to another device instead?{" "}
            <Link href="/#send" className="sff-underline font-medium text-ink">
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
