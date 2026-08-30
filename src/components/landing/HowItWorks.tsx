"use client";

import { Reveal, SectionLabel } from "./Reveal";

/*
 * Each step leads with what the person gets out of it, with the mechanism as
 * the supporting clause — BRAND.md §1. "Nothing uploads yet" is the reassuring
 * outcome; "the file stays on your device" is why.
 */
const STEPS = [
  {
    title: "Drop it. Nothing uploads.",
    body: "The file stays on your machine while it waits — so there's no progress bar to watch and nothing sitting on a server if the other person never shows up.",
  },
  {
    title: "Say six digits out loud.",
    body: "That's the whole handoff. Read it across the room, text it, or let them scan the QR — it works phone to laptop, Windows to Mac, across any two networks.",
  },
  {
    title: "It's already on their device.",
    body: "The two browsers connect directly and the file moves at whatever your network can do, encrypted the whole way. If they're not online, you get a link instead.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionLabel index="01">How it works</SectionLabel>
        </Reveal>

        <Reveal delay={90}>
          <h2 className="mt-10 max-w-3xl font-display text-[clamp(2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.012em] text-ink">
            Faster than attaching it to an email.
          </h2>
        </Reveal>

        {/* Ruled columns sharing hairlines, rather than three bordered cards. */}
        <ol className="mt-16 grid border-t border-ink md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal
              key={step.title}
              as="li"
              delay={i * 120}
              className="group relative border-b border-rule md:border-b-0 md:border-r md:last:border-r-0"
            >
              <div className="sff-cell h-full px-0 py-8 md:px-7 md:first:pl-0">
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-sm tabular-nums text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="font-display text-2xl font-medium tracking-[-0.008em] text-ink">{step.title}</h3>
                </div>
                <p className="mt-4 max-w-sm text-[15px] leading-[1.7] text-ink-soft md:pl-[3.25rem]">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
