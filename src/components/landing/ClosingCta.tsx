"use client";

import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-red">
      {/* Big flat shapes, in the two ladder tints that hold up on a red field. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="sff-bob absolute -bottom-24 -right-16 h-[300px] w-[300px] bg-red-bright"
          style={{ "--tilt": "-14deg" } as React.CSSProperties}
        />
        <div className="absolute -left-20 -top-16 h-[200px] w-[200px] rotate-[24deg] bg-red-bright opacity-60" />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 py-24 sm:px-8 sm:py-32">
        <h2 className="max-w-4xl font-display text-[clamp(2.2rem,5vw,4rem)] leading-[1.06] text-yellow">
          Nothing to lose.
          <br />
          <span className="text-lime">Literally nothing.</span>
        </h2>

        <p className="mt-8 max-w-lg text-[17px] font-medium leading-[1.6] text-yellow sm:text-[19px]">
          No account to abandon later. No card to cancel. No file of yours sitting on a server you forgot about.
          Close the tab and there is nothing left behind.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/#send"
            className="sff-nudge inline-flex items-center bg-lime px-8 py-4 text-[16px] font-bold leading-none text-black"
          >
            Send a file
          </Link>
          <Link
            href="/tools"
            className="sff-nudge inline-flex items-center bg-yellow px-7 py-3.5 text-[15px] font-bold leading-none text-black"
          >
            Explore the 19 tools
          </Link>
        </div>
      </div>
    </section>
  );
}
