"use client";

import { useState } from "react";
import { Reveal, SectionLabel } from "./Reveal";
import { FAQ_ITEMS } from "./faqData";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionLabel index="04">FAQ</SectionLabel>
        </Reveal>

        <div className="mt-10 grid gap-x-16 lg:grid-cols-12">
          <Reveal delay={90} className="lg:col-span-4">
            <h2 className="font-display text-[clamp(2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.012em] text-ink lg:sticky lg:top-28">
              The questions worth answering.
            </h2>
          </Reveal>

          <div className="mt-12 lg:col-span-8 lg:mt-0">
            <div className="border-t border-ink">
              {FAQ_ITEMS.map((item, i) => {
                const isOpen = open === i;
                return (
                  <Reveal key={item.q} delay={Math.min(i, 4) * 55}>
                    <div className="border-b border-rule">
                      <h3>
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : i)}
                          aria-expanded={isOpen}
                          aria-controls={`faq-panel-${i}`}
                          // py-5 + line-height clears 44px, so this is a
                          // comfortable touch target without extra padding.
                          className="group flex w-full items-start gap-5 py-5 text-left"
                        >
                          <span className="mt-1 font-mono text-xs tabular-nums text-accent">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span
                            className={`flex-1 text-[17px] font-medium leading-snug transition-colors duration-300 ${
                              isOpen ? "text-accent" : "text-ink group-hover:text-accent"
                            }`}
                          >
                            {item.q}
                          </span>
                          {/* A plus that rotates into a minus — one element,
                              square ends, no icon swap. */}
                          <span aria-hidden className="relative mt-1.5 h-3.5 w-3.5 shrink-0">
                            <span className="absolute left-0 top-1/2 h-[1.5px] w-3.5 -translate-y-1/2 bg-current text-ink-soft transition-colors group-hover:text-accent" />
                            <span
                              className={`absolute left-1/2 top-0 h-3.5 w-[1.5px] -translate-x-1/2 bg-current text-ink-soft transition-all duration-300 group-hover:text-accent ${
                                isOpen ? "rotate-90 opacity-0" : "opacity-100"
                              }`}
                            />
                          </span>
                        </button>
                      </h3>
                      {/* grid-template-rows 0fr→1fr animates height without
                          measuring anything in JS. */}
                      <div
                        id={`faq-panel-${i}`}
                        role="region"
                        className="grid transition-[grid-template-rows] duration-[420ms] ease-[cubic-bezier(0.19,1,0.22,1)]"
                        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden">
                          <p className="max-w-2xl pb-6 pl-10 pr-8 text-[15px] leading-[1.75] text-ink-soft">
                            {item.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
