"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SendPanel } from "../SendPanel";
import { takeHandoffFile } from "@/lib/handoff";
import { TransferAnimation } from "./TransferAnimation";
import { GridBackdrop } from "./GridBackdrop";

const FACTS = [
  { k: "Size limit", v: "None on P2P" },
  { k: "Accounts", v: "Zero, ever" },
  { k: "Encryption", v: "End to end" },
  { k: "Free tools", v: "19 included" },
];

export function Hero() {
  // A file produced by a standalone /tools/[slug] page and handed here via
  // "Send this file" — see src/lib/handoff.ts and ToolPageClient.
  const [handoffFile, setHandoffFile] = useState<File | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const file = takeHandoffFile();
      if (file) {
        setHandoffFile(file);
        // Land the user on the drop zone that now holds their file, rather
        // than leaving it silently staged below the fold.
        document.getElementById("send")?.scrollIntoView({ block: "center" });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden border-b border-rule">
      <GridBackdrop size={64} className="opacity-60" />

      <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* --- Masthead line ------------------------------------------------ */}
        <div className="flex items-center gap-4 border-b border-rule py-4">
          <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">
            Free forever
          </span>
          <span className="hidden h-px flex-1 bg-rule sm:block" />
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft sm:ml-0">
            No sign-up · Nothing to install
          </span>
        </div>

        {/* --- Headline ----------------------------------------------------- */}
        <div className="grid gap-x-12 pt-10 sm:pt-14 lg:grid-cols-12">
          <h1 className="col-span-full font-display text-[clamp(2.7rem,8vw,6.25rem)] font-medium leading-[1.0] tracking-[-0.018em] text-ink lg:col-span-9">
            {/* Each line gets its own overflow-hidden box so the type wipes up
                from behind a hard edge instead of fading in. */}
            <span className="block overflow-hidden pb-[0.13em]">
              <span className="sff-line" style={{ "--i": 0 } as React.CSSProperties}>
                Send files,
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.13em]">
              <span className="sff-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>
                not sign-ups.
              </span>
            </span>
          </h1>

          <div className="col-span-full mt-7 lg:col-span-5 lg:col-start-1">
            <p
              className="sff-enter max-w-lg text-pretty text-[17px] leading-[1.65] text-ink-soft sm:text-lg"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              Drop a file, read out a 6-digit code, and it lands on the other device — straight from one browser to
              the other. No account, no upload queue, no size-limit games. Plus{" "}
              <Link href="/tools" className="sff-underline font-medium text-ink">
                19 free file tools
              </Link>{" "}
              that never send your files anywhere.
            </p>
          </div>
        </div>

        {/* --- Fact rail: ruled cells, not a row of pills ------------------- */}
        <dl
          className="sff-enter mt-12 grid grid-cols-2 border-t border-rule sm:grid-cols-4"
          style={{ "--i": 6 } as React.CSSProperties}
        >
          {FACTS.map((fact) => (
            <div key={fact.k} className="border-b border-r border-rule py-5 pr-4 last:border-r-0 sm:border-b-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">{fact.k}</dt>
              <dd className="mt-1.5 font-display text-lg font-medium tracking-[-0.004em] text-ink">{fact.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* --- The product itself, full-bleed against the illustration -------- */}
      <div className="relative mx-auto mt-12 w-full max-w-[1400px] border-t border-rule px-5 sm:mt-14 sm:px-8">
        <div className="grid lg:grid-cols-12">
          <div id="send" className="scroll-mt-24 py-10 lg:col-span-6 lg:pr-14">
            <div className="mb-7 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl font-medium tracking-[-0.008em] text-ink">Send a file now</h2>
              <Link href="/receive" className="sff-underline text-sm text-ink-soft hover:text-ink">
                Got a code?
              </Link>
            </div>
            <SendPanel initialFile={handoffFile} />
          </div>

          {/* Deliberately after the send panel in DOM order: on a phone the
              drop zone is what the visitor came for, so the illustration must
              not push it below the fold. The vertical rule only exists at lg,
              where the two genuinely sit side by side. */}
          <div className="relative flex items-center border-t border-rule py-10 lg:col-span-6 lg:border-l lg:border-t-0 lg:pl-14">
            <TransferAnimation />
          </div>
        </div>
      </div>
    </section>
  );
}
