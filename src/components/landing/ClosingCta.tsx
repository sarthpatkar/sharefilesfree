"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-t border-border py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="sff-grid absolute inset-0 opacity-60" />
        <div
          className="sff-aurora absolute left-1/2 top-1/2 h-[460px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.15 }}
        />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-background to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="font-display text-3xl font-medium leading-[1.1] tracking-[-0.025em] text-foreground sm:text-5xl">
            Your file is one drop away.
          </h2>
        </Reveal>
        <Reveal delay={90}>
          <p className="mx-auto mt-5 max-w-lg text-[17px] leading-relaxed text-muted">
            No account to make, nothing to install, and no upsell waiting at the end of it.
          </p>
        </Reveal>
        <Reveal delay={160}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#send"
              className="sff-sweep relative inline-flex items-center gap-2 overflow-hidden rounded-xl bg-accent px-6 py-3 text-sm font-medium text-accent-foreground shadow-[0_1px_2px_rgba(11,110,79,0.25)] transition-all duration-300 hover:bg-accent-hover hover:shadow-[0_8px_28px_-6px_var(--glow)] active:scale-[0.97]"
            >
              Send a file
            </a>
            <Link
              href="/tools"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_6px_20px_-8px_var(--glow)]"
            >
              Explore the tools
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
