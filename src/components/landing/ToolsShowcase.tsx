"use client";

import Link from "next/link";
import { TOOLS } from "../tools/registry";
import { Reveal } from "./Reveal";

/** Split into two rows that scroll in opposite directions — reads as motion rather than as a list that happens to slide. */
const HALF = Math.ceil(TOOLS.length / 2);
const ROW_ONE = TOOLS.slice(0, HALF);
const ROW_TWO = TOOLS.slice(HALF);

function MarqueeRow({ tools, speed, reverse = false }: { tools: typeof TOOLS; speed: string; reverse?: boolean }) {
  return (
    <div className="sff-marquee-mask relative flex overflow-hidden">
      {/* The track holds the list twice; translating exactly -50% loops seamlessly. */}
      <div
        className="sff-marquee-track flex shrink-0 gap-3 pr-3"
        style={{ "--speed": speed, animationDirection: reverse ? "reverse" : "normal" } as React.CSSProperties}
      >
        {[...tools, ...tools].map((tool, i) => (
          <Link
            key={`${tool.slug}-${i}`}
            href={`/tools/${tool.slug}`}
            // aria-hidden on the duplicate half so screen readers don't hear every tool twice.
            aria-hidden={i >= tools.length}
            tabIndex={i >= tools.length ? -1 : undefined}
            className="group flex shrink-0 items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_6px_20px_-8px_var(--glow)]"
          >
            <tool.icon className="h-[18px] w-[18px] text-accent transition-transform duration-300 group-hover:scale-110" />
            <span className="whitespace-nowrap text-sm font-medium text-foreground">{tool.title}</span>
            {tool.caveat && (
              <span className="rounded-full bg-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted">{tool.caveat}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ToolsShowcase() {
  return (
    <section className="relative border-t border-border py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Reveal>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Free tools</p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-[2.75rem]">
                {TOOLS.length} file tools that never see your files.
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
                Merge, split, compress, convert, OCR. Every one runs entirely inside your browser — so there&apos;s no
                upload queue, no watermark, no daily limit, and genuinely nothing for us to leak.
              </p>
            </Reveal>
          </div>
          <Reveal delay={200}>
            <Link
              href="/tools"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_6px_20px_-8px_var(--glow)]"
            >
              Browse all tools
              <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </Reveal>
        </div>
      </div>

      <Reveal delay={240} className="mt-14 flex flex-col gap-3">
        <MarqueeRow tools={ROW_ONE} speed="52s" />
        <MarqueeRow tools={ROW_TWO} speed="64s" reverse />
      </Reveal>
    </section>
  );
}
