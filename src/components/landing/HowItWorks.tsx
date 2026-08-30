"use client";

import { Reveal } from "./Reveal";
import { IconUpload, IconHash, IconCheck } from "../icons";

const STEPS = [
  {
    icon: IconUpload,
    title: "Drop your file",
    body: "Any size, any type, as many as you like. Nothing uploads yet — the file stays on your device while it waits.",
  },
  {
    icon: IconHash,
    title: "Share the 6-digit code",
    body: "Read it out, text it, or let them scan the QR. Works across networks, operating systems, and phone-to-laptop.",
  },
  {
    icon: IconCheck,
    title: "It lands, directly",
    body: "The two browsers open an encrypted connection and the bytes flow peer to peer. Not online? Fall back to a link instead.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-20 border-t border-border py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">How it works</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-[2.75rem]">
            Three steps. No account anywhere in them.
          </h2>
        </Reveal>

        <div className="relative mt-16">
          {/* The connecting rail behind the steps — draws itself across on desktop */}
          <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-7 hidden md:block">
            <svg viewBox="0 0 1000 2" preserveAspectRatio="none" className="h-0.5 w-full overflow-visible">
              <path d="M 60 1 H 940" stroke="var(--border)" strokeWidth="2" />
              <path
                d="M 60 1 H 940"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeDasharray="6 10"
                strokeLinecap="round"
                opacity="0.55"
                className="sff-dash"
              />
            </svg>
          </div>

          <ol className="relative grid gap-12 md:grid-cols-3 md:gap-8">
            {STEPS.map((step, i) => (
              <Reveal key={step.title} as="li" delay={i * 130} className="relative flex flex-col items-start">
                <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(20,35,29,0.05)]">
                  <step.icon className="h-6 w-6 text-accent" />
                  <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-accent font-mono text-[11px] font-semibold text-accent-foreground">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-xl font-medium tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-muted">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
