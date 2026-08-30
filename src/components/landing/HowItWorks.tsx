"use client";

import { Reveal, SectionLabel } from "./Reveal";

const STEPS = [
  {
    title: "Drop your file",
    body: "Any size, any type, as many as you like. Nothing uploads yet — the file stays on your device while it waits for the other side.",
  },
  {
    title: "Share the 6-digit code",
    body: "Read it out, text it, or let them scan the QR. Works across networks, operating systems, and phone-to-laptop in either direction.",
  },
  {
    title: "It lands, directly",
    body: "The two browsers open an encrypted connection and the bytes flow peer to peer. Receiver offline? Switch to a shareable link instead.",
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
            Three steps. No account anywhere in them.
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
