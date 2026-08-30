import Link from "next/link";
import { IconCompass } from "@/components/icons";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="sff-aurora absolute left-1/2 top-1/2 h-[320px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[110px]"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.12 }}
          />
        </div>
        <IconCompass className="sff-float h-10 w-10 text-muted" />
        <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground">Page not found</h1>
        <p className="text-muted">This page doesn&apos;t exist — or a shared link here has expired or been removed.</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="sff-sweep relative inline-flex items-center justify-center overflow-hidden rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-[0_1px_2px_rgba(11,110,79,0.25)] transition-all duration-300 hover:bg-accent-hover hover:shadow-[0_8px_28px_-6px_var(--glow)] active:scale-[0.97]"
          >
            Back to ShareFilesFree
          </Link>
          <Link
            href="/tools"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-accent"
          >
            Browse the tools
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
