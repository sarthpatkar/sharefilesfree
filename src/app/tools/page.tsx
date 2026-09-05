import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolsPanel } from "@/components/ToolsPanel";
import { TOOLS } from "@/components/tools/registry";
import { AdSlot } from "@/components/ads/AdSlot";

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
        <section className="relative overflow-hidden">
          <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
            <div className="flex items-center gap-4 py-4">
              <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">
                {TOOLS.length} tools · all free
              </span>
            </div>
            <div className="grid gap-x-12 py-16 sm:py-24 lg:grid-cols-12">
              <h1 className="col-span-full font-display text-[clamp(2.2rem,5vw,4.1rem)] leading-[1.06] tracking-[-0.015em] text-red lg:col-span-8">
                <span className="block">File tools that</span>
                <span className="block text-accent">never see your files.</span>
              </h1>
              <p
                className="sff-enter col-span-full mt-8 max-w-lg text-[17px] leading-[1.65] text-black lg:col-span-5"
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

          <AdSlot slotId="tools-index" format="leaderboard" className="mt-16" />

          <p className="mt-20 pt-8 text-[15px] text-black">
            Need to move a file to another device instead?{" "}
            <Link href="/#send" className="link font-medium text-red">
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
