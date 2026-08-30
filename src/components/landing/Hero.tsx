"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SendPanel } from "../SendPanel";
import { takeHandoffFile } from "@/lib/handoff";
import { GridBackdrop } from "./GridBackdrop";

/*
 * Benefit-framed, not feature-framed — see BRAND.md §1. "None on P2P" is a
 * spec; "Send the whole 4GB video" is the thing the person actually wanted.
 * These four are also part of the scan path (§4).
 */
const FACTS = [
  { k: "File size", v: "Send the whole 4GB video" },
  { k: "Sign-up", v: "There isn't one" },
  { k: "Who can read it", v: "You two, nobody else" },
  { k: "Also included", v: "19 tools, no watermark" },
];

/*
 * Shrink the downside (BRAND.md §3). These are the three things someone
 * actually hesitates over before handing a website they just found a file,
 * and they sit beside the drop zone because that is where the hesitation
 * happens — not in a trust section below the fold.
 */
const OBJECTIONS: [string, string][] = [
  ["Is it safe?", "Encrypted end to end by your browser. We never get a copy."],
  ["Will it work?", "Any browser, any OS, phone to laptop. Nothing to install."],
  ["What's the catch?", "Ads pay for it, later. Never your file size or your wallet."],
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
          <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">Free forever</span>
          <span className="h-px flex-1 bg-rule" />
          {/* Hidden on phones: at 390px this wrapped to two cramped lines, and
              the headline directly below already says "not sign-ups". */}
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft sm:block">
            No sign-up · Nothing to install
          </span>
        </div>

        {/*
          Headline and the product itself, side by side. The pitch and the
          thing it's pitching share the first screen, so the scan path
          (BRAND.md §4) runs headline → action with nothing in between.

          Switches at 900px rather than Tailwind's lg (1024px): a laptop
          window with devtools open, or a browser that isn't maximised, sits
          right in the 900–1023 gap and was stacking when it had ample room
          for two columns. Below 900 they stack, words first then drop zone —
          on a phone the drop zone is what the visitor came for.
        */}
        <div className="grid gap-x-10 gap-y-12 pt-10 sm:pt-14 min-[900px]:grid-cols-12 min-[900px]:gap-y-0 lg:gap-x-14">
          <div className="min-[900px]:col-span-7">
            <h1 className="font-display text-[clamp(2.8rem,6.2vw,5.4rem)] font-black leading-[0.85] tracking-[-0.03em] text-ink">
              {/* Each line gets its own overflow-hidden box so the type wipes
                  up from behind a hard edge instead of fading in. */}
              <span className="block overflow-hidden pb-[0.07em]">
                <span className="sff-line" style={{ "--i": 0 } as React.CSSProperties}>
                  Send files,
                </span>
              </span>
              <span className="block overflow-hidden pb-[0.07em]">
                <span className="sff-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>
                  not sign-ups.
                </span>
              </span>
            </h1>

            {/* Pacing (BRAND.md §5): short declarative line, then a longer one,
                then short again — a paragraph of uniform sentences reads as
                filler and the eye slides off it. */}
            <p
              className="sff-enter mt-8 max-w-lg text-pretty text-[17px] leading-[1.65] text-ink-soft sm:text-lg"
              style={{ "--i": 3 } as React.CSSProperties}
            >
              <span className="text-ink">Your file lands on their device while you&apos;re still reading out the code.</span>{" "}
              It goes browser to browser, so there&apos;s no upload to sit through and no ceiling on how big it can be
              — the thing WeTransfer stops at 2GB for. Then it&apos;s gone. Nothing kept, nothing to sign up for, and{" "}
              <Link href="/tools" className="sff-underline font-medium text-ink">
                19 file tools
              </Link>{" "}
              that work the same way.
            </p>
          </div>

          <div
            id="send"
            className="sff-enter scroll-mt-24 min-[900px]:col-span-5 min-[900px]:border-l min-[900px]:border-rule min-[900px]:pl-9 lg:pl-14"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">Send a file now</h2>
              <Link href="/receive" className="sff-underline shrink-0 text-sm text-ink-soft hover:text-ink">
                Got a code?
              </Link>
            </div>

            <SendPanel initialFile={handoffFile} />

            {/* Rows rather than three columns: this column is narrow now, and
                three cramped columns of prose read worse than three rows.
                Question and answer are block-level so a wrapped answer starts
                flush instead of hanging under the question. */}
            <dl className="mt-7 flex flex-col gap-3.5 border-t border-rule pt-5 text-[13px] leading-[1.5]">
              {OBJECTIONS.map(([q, a]) => (
                <div key={q}>
                  <dt className="font-medium text-ink">{q}</dt>
                  <dd className="mt-0.5 text-ink-soft">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* --- Fact rail: ruled cells, not a row of pills ------------------- */}
        <dl
          className="sff-enter mt-14 grid grid-cols-2 border-t border-rule sm:grid-cols-4"
          style={{ "--i": 7 } as React.CSSProperties}
        >
          {FACTS.map((fact) => (
            <div key={fact.k} className="border-b border-r border-rule py-5 pr-4 last:border-r-0 sm:border-b-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">{fact.k}</dt>
              <dd className="mt-1.5 font-display text-lg font-bold tracking-[-0.015em] text-ink">{fact.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
