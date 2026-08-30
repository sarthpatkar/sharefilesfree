"use client";

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
    body: "It's already on their screen, at whatever speed your connection can manage. If they're not around right now, you get a link instead.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-lime">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          How it works
        </p>

        <div className="mt-8 grid items-center gap-x-14 gap-y-10 lg:grid-cols-12">
          <h2 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.0] text-red lg:col-span-6">
            Faster than attaching it to an email.
          </h2>

          {/* The illustration belongs here rather than in the hero: it shows a
              file crossing straight from one screen to the other, which is
              exactly what the three steps underneath describe. */}
          <div className="lg:col-span-6">
            <TransferAnimation />
          </div>
        </div>

        {/* Three blocks. The colour change between them is the divider. */}
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="sff-block-sm bg-yellow p-6">
              <span className="font-display text-[44px] leading-none text-pink">0{i + 1}</span>
              <h3 className="mt-3 font-display text-[26px] leading-none text-red">{step.title}</h3>
              <p className="mt-3 text-[15px] font-medium leading-[1.55] text-red">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
