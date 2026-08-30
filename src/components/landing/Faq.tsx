"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { FAQ_ITEMS } from "./faqData";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="relative scroll-mt-20 border-t border-border py-24 sm:py-32">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">FAQ</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-[2.75rem]">
            The questions worth answering.
          </h2>
        </Reveal>

        <div className="mt-12 divide-y divide-border border-y border-border">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <Reveal key={item.q} delay={Math.min(i, 4) * 60}>
                <div>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      className="group flex w-full items-start justify-between gap-6 py-5 text-left"
                    >
                      <span
                        className={`text-[17px] font-medium transition-colors duration-300 ${
                          isOpen ? "text-accent" : "text-foreground group-hover:text-accent"
                        }`}
                      >
                        {item.q}
                      </span>
                      {/* A plus that rotates into a minus — one element, no icon swap */}
                      <span aria-hidden className="relative mt-1.5 h-4 w-4 shrink-0">
                        <span className="absolute left-0 top-1/2 h-0.5 w-4 -translate-y-1/2 rounded-full bg-current text-muted transition-colors group-hover:text-accent" />
                        <span
                          className={`absolute left-1/2 top-0 h-4 w-0.5 -translate-x-1/2 rounded-full bg-current text-muted transition-all duration-300 group-hover:text-accent ${
                            isOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"
                          }`}
                        />
                      </span>
                    </button>
                  </h3>
                  <div id={`faq-panel-${i}`} className="sff-collapse" data-open={isOpen} role="region">
                    <div>
                      <p className="pb-6 pr-10 text-[15px] leading-relaxed text-muted">{item.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
