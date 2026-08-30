"use client";

import Link from "next/link";
import { TOOLS } from "../tools/registry";

const HALF = Math.ceil(TOOLS.length / 2);
const ROW_ONE = TOOLS.slice(0, HALF);
const ROW_TWO = TOOLS.slice(HALF);

/* Every chip takes one of the six in turn, so the band reads as the whole
   palette moving rather than one accent repeated. */
const CHIP_FIELDS = ["bg-yellow", "bg-lime", "bg-pink", "bg-gold", "bg-blush"];

function MarqueeRow({ tools, speed, reverse = false }: { tools: typeof TOOLS; speed: string; reverse?: boolean }) {
  return (
    <div className="flex overflow-hidden py-2">
      {/* The track holds the list twice; translating exactly -50% loops seamlessly. */}
      <div
        className="sff-marquee-track flex shrink-0 gap-3 pr-3"
        style={{ "--speed": speed, animationDirection: reverse ? "reverse" : "normal" } as React.CSSProperties}
      >
        {[...tools, ...tools].map((tool, i) => (
          <Link
            key={`${tool.slug}-${i}`}
            href={`/tools/${tool.slug}`}
            // aria-hidden on the duplicate half so screen readers don't hear
            // every tool twice.
            aria-hidden={i >= tools.length}
            tabIndex={i >= tools.length ? -1 : undefined}
            className={`sff-nudge flex shrink-0 items-center gap-2.5 px-5 py-3.5 ${CHIP_FIELDS[i % CHIP_FIELDS.length]}`}
          >
            <tool.icon className="h-5 w-5 shrink-0 text-red" />
            <span className="whitespace-nowrap font-display text-[16px] leading-none text-red">{tool.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ToolsShowcase() {
  return (
    <section className="overflow-hidden bg-gold">
      <div className="mx-auto w-full max-w-[1400px] px-5 pt-20 sm:px-8 sm:pt-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          {TOOLS.length} free tools
        </p>

        <div className="mt-8 grid gap-x-14 gap-y-6 lg:grid-cols-12">
          <h2 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.0] text-red-bright lg:col-span-7">
            Fix the file before you send it.
          </h2>
          <div className="flex flex-col justify-end lg:col-span-5">
            <p className="max-w-md text-[17px] font-medium leading-[1.6] text-red">
              Too big to email? Wrong format? A photo of a document when you needed the words? Squash it, convert it,
              merge it, pull the text out of it. Every one runs on your own machine — the contract you just signed
              never goes anywhere near anyone&apos;s server.
            </p>
            <Link href="/tools" className="link mt-5 w-fit text-[17px] text-red">
              See all {TOOLS.length} tools
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-14 bg-red py-4">
        <MarqueeRow tools={ROW_ONE} speed="50s" />
        <MarqueeRow tools={ROW_TWO} speed="62s" reverse />
      </div>
    </section>
  );
}
