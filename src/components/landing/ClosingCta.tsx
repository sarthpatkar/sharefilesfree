"use client";

import Link from "next/link";
import { Reveal } from "./Reveal";
import { GridBackdrop } from "./GridBackdrop";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden border-b border-rule">
      <GridBackdrop size={64} className="opacity-50" />

      <div className="relative mx-auto w-full max-w-[1400px] px-5 py-24 sm:px-8 sm:py-32">
        <Reveal>
          <h2 className="max-w-4xl font-display text-[clamp(2.8rem,8vw,6.6rem)] font-black leading-[0.9] tracking-[-0.028em] text-ink">
            Nothing to lose.
            <br />
            Literally nothing.
          </h2>
        </Reveal>

        <Reveal delay={100}>
          {/* Risk reversal, stated as things that cannot happen to you — the
              honest version of a guarantee for a product with no account and
              no price. BRAND.md §3. */}
          <p className="mt-8 max-w-lg text-[17px] leading-[1.65] text-ink-soft">
            No account to abandon later. No card to cancel. No file of yours sitting on a server you forgot about.
            Close the tab and there is nothing left behind.
          </p>
        </Reveal>

        <Reveal delay={170}>
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <Link
              href="/#send"
              className="sff-press inline-flex items-center bg-ink px-7 py-4 text-[15px] font-medium leading-none text-paper shadow-[5px_5px_0_var(--accent)] hover:bg-accent"
            >
              Send a file
            </Link>
            <Link href="/tools" className="sff-underline py-2 text-[15px] font-medium text-ink">
              Explore the 19 tools
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
