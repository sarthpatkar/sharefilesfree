"use client";

import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden bg-red">
      {/* Big flat shapes in hot pink — against red it reads as a deliberate
          second colour rather than as a lighter red, which is what red-bright
          did here (1.26:1 against the field; pink is 2.07:1). The cream type
          only measures 2.50:1 on it, so the phone sizes are cut back until both
          blocks sit clear of the words rather than behind them. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="sff-bob absolute -bottom-10 -right-8 h-[150px] w-[150px] bg-pink sm:-bottom-24 sm:-right-16 sm:h-[300px] sm:w-[300px]"
          style={{ "--tilt": "-14deg" } as React.CSSProperties}
        />
        <div className="absolute -left-12 -top-14 h-[120px] w-[120px] rotate-[24deg] bg-pink sm:-left-20 sm:-top-16 sm:h-[200px] sm:w-[200px]" />
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
