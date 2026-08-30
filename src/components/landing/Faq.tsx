"use client";

import { useState } from "react";
import { FAQ_ITEMS } from "./faqData";

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-lime">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          Straight answers
        </p>

        <div className="mt-8 grid gap-x-16 gap-y-10 lg:grid-cols-12">
          <h2 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.0] text-red lg:col-span-4">
            The questions worth answering.
          </h2>

          <div className="flex flex-col gap-3 lg:col-span-8">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = open === i;
              return (
                <div key={item.q} className={isOpen ? "bg-red" : "bg-yellow"}>
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${i}`}
                      className="flex w-full items-start gap-4 px-6 py-5 text-left"
                    >
                      <span
                        className={`mt-0.5 font-display text-[17px] leading-none ${isOpen ? "text-pink" : "text-pink"}`}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`flex-1 font-display text-[19px] leading-[1.15] ${isOpen ? "text-yellow" : "text-red"}`}
                      >
                        {item.q}
                      </span>
                      {/* A plus rotating into a minus — one element, no icon swap. */}
                      <span aria-hidden className="relative mt-1 h-4 w-4 shrink-0">
                        <span
                          className={`absolute left-0 top-1/2 h-[3px] w-4 -translate-y-1/2 ${isOpen ? "bg-yellow" : "bg-red"}`}
                        />
                        <span
                          className={`absolute left-1/2 top-0 h-4 w-[3px] -translate-x-1/2 transition-transform duration-300 ${
                            isOpen ? "rotate-90 bg-yellow opacity-0" : "bg-red opacity-100"
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
                    className="grid transition-[grid-template-rows] duration-[380ms] ease-out"
                    style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <p className="max-w-2xl px-6 pb-6 pl-[3.4rem] text-[15px] font-medium leading-[1.6] text-yellow">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
