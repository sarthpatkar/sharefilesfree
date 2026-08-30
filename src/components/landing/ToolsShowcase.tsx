"use client";

import Link from "next/link";
import { TOOLS } from "../tools/registry";
import { Reveal, SectionLabel } from "./Reveal";

const HALF = Math.ceil(TOOLS.length / 2);
const ROW_ONE = TOOLS.slice(0, HALF);
const ROW_TWO = TOOLS.slice(HALF);

/**
 * Two rows scrolling in opposite directions. Hard-clipped by `overflow-hidden`
 * on the section rather than faded with a mask-image, because masks require a
 * gradient and gradients are banned site-wide — the hard edge suits the ruled
 * layout better anyway.
 */
function MarqueeRow({ tools, speed, reverse = false }: { tools: typeof TOOLS; speed: string; reverse?: boolean }) {
  return (
    <div className="flex border-b border-rule">
      {/* The track holds the list twice; translating exactly -50% loops seamlessly. */}
      <div
        className="sff-marquee-track flex shrink-0"
        style={{ "--speed": speed, animationDirection: reverse ? "reverse" : "normal" } as React.CSSProperties}
      >
        {[...tools, ...tools].map((tool, i) => (
          <Link
            key={`${tool.slug}-${i}`}
            href={`/tools/${tool.slug}`}
            // aria-hidden on the duplicate half so screen readers don't hear every tool twice.
            aria-hidden={i >= tools.length}
            tabIndex={i >= tools.length ? -1 : undefined}
            className="sff-cell flex shrink-0 items-center gap-3 border-r border-rule px-6 py-5 hover:bg-ink hover:text-paper"
          >
            <tool.icon className="h-[18px] w-[18px] shrink-0 text-accent" />
            <span className="whitespace-nowrap text-sm font-medium">{tool.title}</span>
            {tool.caveat && (
              <span className="border border-current px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] opacity-60">
                {tool.caveat}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ToolsShowcase() {
  return (
    <section className="overflow-hidden border-b border-rule">
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-20 sm:px-8 sm:pt-28">
        <Reveal>
          <SectionLabel index="02">Free tools</SectionLabel>
        </Reveal>

        <div className="mt-10 grid gap-x-12 gap-y-8 lg:grid-cols-12">
          <Reveal delay={90} className="lg:col-span-7">
            <h2 className="font-display text-[clamp(2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.012em] text-ink">
              Fix the file before you send it.
            </h2>
          </Reveal>
          <Reveal delay={160} className="flex flex-col justify-end lg:col-span-5">
            <p className="max-w-md text-[16px] leading-[1.7] text-ink-soft">
              <span className="text-ink">Too big for email? Wrong format? Scanned instead of typed?</span> Merge, split,
              compress, convert and OCR — {TOOLS.length} tools that run on your own machine, so the contract you just
              signed never gets uploaded to anyone&apos;s server to be processed. No watermark, no daily cap.
            </p>
            <Link href="/tools" className="sff-underline mt-5 w-fit text-sm font-medium text-ink">
              Browse all {TOOLS.length} tools
            </Link>
          </Reveal>
        </div>
      </div>

      <div className="mt-16 border-t border-rule">
        <MarqueeRow tools={ROW_ONE} speed="56s" />
        <MarqueeRow tools={ROW_TWO} speed="68s" reverse />
      </div>
    </section>
  );
}
