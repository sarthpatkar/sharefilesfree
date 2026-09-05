"use client";

import { useEffect, useRef, useState } from "react";
import { TransferAnimation } from "./TransferAnimation";

/* Outcome first, mechanism as the supporting clause. */
const STEPS = [
  {
    title: "Drop it.",
    body: "Nothing uploads. Your file waits on your own machine, so there's no progress bar to sit through and nothing left on a server if they never turn up.",
  },
  {
    title: "Say six digits.",
    body: "That's the whole handoff. Read them across the room, text them, or let them point a camera at the code. Phone to laptop, any two networks.",
  },
  {
    title: "Done.",
    body: "It's already on their screen, at whatever speed your connection can manage. Not around right now? Ask for a longer code — up to two hours — and leave the tab open.",
  },
];

/**
 * The illustration pins while the three steps scroll past it, and plays the
 * step you're actually reading — file staged, then the code, then the packets
 * crossing. The picture teaches rather than loops.
 *
 * Sticky positioning does the pinning, so the browser handles it natively:
 * no scroll hijacking, no jank, and it simply doesn't engage below lg where
 * there isn't room for two columns.
 */
export function HowItWorks() {
  const [active, setActive] = useState<0 | 1 | 2>(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const els = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (els.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Whichever step occupies the middle band of the viewport wins.
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const index = els.indexOf(top.target as HTMLLIElement);
        if (index >= 0) setActive(index as 0 | 1 | 2);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section id="how" className="scroll-mt-20 bg-lime-pale">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          How it works
        </p>

        <h2 className="mt-8 max-w-3xl font-display text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.06] text-red-bright">
          Faster than attaching it to an email.
        </h2>

        <div className="mt-14 grid gap-x-14 gap-y-10 lg:grid-cols-12">
          {/* Pinned picture. */}
          <div className="lg:col-span-6">
            <div className="lg:sticky lg:top-28">
              <TransferAnimation step={active} />

              {/* A step meter, so the pin reads as progress rather than a
                  picture that happens to sit still. */}
              <div className="mt-5 flex gap-2" aria-hidden>
                {STEPS.map((s, i) => (
                  <span
                    key={s.title}
                    className={`h-2 flex-1 transition-colors duration-300 ${i <= active ? "bg-red" : "bg-y-mid"}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/*
            Each step gets a tall slot on wide screens. That's what gives the
            pinned illustration something to pin *through* — with the steps at
            their natural height the column was barely taller than the picture,
            so it unpinned almost immediately and scrolled away before reaching
            step three.
          */}
          <ol className="flex flex-col gap-6 lg:col-span-6 lg:gap-0">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
                className="lg:flex lg:min-h-[58vh] lg:flex-col lg:justify-center"
              >
                {/* No card. The step is type on the section ground; the only
                    thing marking the one you are reading is that the others
                    step back. Emphasis by weight and position, not by a box. */}
                <div
                  className={`max-w-md transition-all duration-500 ${
                    i === active ? "lg:translate-x-0 lg:opacity-100" : "lg:translate-x-3 lg:opacity-40"
                  }`}
                >
                  <span className="font-display text-[26px] leading-none text-red opacity-25">0{i + 1}</span>
                  <h3 className="mt-2 font-display text-[21px] leading-[1.15] text-red-bright">{step.title}</h3>
                  <p className="mt-3 text-[15.5px] font-medium leading-[1.6] text-black">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
