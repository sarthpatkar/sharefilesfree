"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SendPanel } from "../SendPanel";
import { takeHandoffFile } from "@/lib/handoff";
import { TransferAnimation } from "./TransferAnimation";
import { useSpotlight } from "./Reveal";
import { IconLock, IconBlocked, IconCheck } from "../icons";

const TRUST_CHIPS = [
  { icon: IconLock, label: "End-to-end encrypted" },
  { icon: IconBlocked, label: "No account, ever" },
  { icon: IconCheck, label: "No size limit on P2P" },
];

export function Hero() {
  // A file produced by a standalone /tools/[slug] page and handed here via
  // "Send this file" — see src/lib/handoff.ts and ToolPageClient.
  const [handoffFile, setHandoffFile] = useState<File | null>(null);
  const cardRef = useSpotlight<HTMLDivElement>();

  useEffect(() => {
    const timer = setTimeout(() => {
      const file = takeHandoffFile();
      if (file) {
        setHandoffFile(file);
        // Land the user on the drop zone that now holds their file, rather than
        // leaving it silently staged below the fold.
        document.getElementById("send")?.scrollIntoView({ block: "center" });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden">
      {/* ---- Animated backdrop ---- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="sff-grid absolute inset-0 opacity-70" />
        <div
          className="sff-aurora absolute -left-24 -top-32 h-[520px] w-[520px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.16 }}
        />
        <div
          className="sff-aurora absolute -right-32 top-10 h-[460px] w-[460px] rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--ember) 0%, transparent 68%)", opacity: 0.11, animationDelay: "-9s" }}
        />
        <div
          className="sff-aurora absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full blur-[110px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)", opacity: 0.1, animationDelay: "-17s" }}
        />
        {/* Fades the grid out toward the bottom so the section doesn't end on a hard edge */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-12 sm:px-6 sm:pb-28 sm:pt-16">
        {/* ---- Headline block ---- */}
        <div className="mx-auto max-w-3xl text-center">
          <p
            className="sff-enter mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="sff-pulse-ring absolute inline-flex h-full w-full rounded-full bg-accent" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Free forever · No sign-up · Nothing to install
          </p>

          <h1 className="mt-6 font-display text-[2.75rem] font-medium leading-[1.03] tracking-[-0.03em] text-foreground sm:text-6xl lg:text-[4rem]">
            <span className="sff-enter block" style={{ "--i": 1 } as React.CSSProperties}>
              Send files,
            </span>
            <span className="sff-enter relative block" style={{ "--i": 2 } as React.CSSProperties}>
              not{" "}
              <span className="relative inline-block text-accent">
                sign-ups.
                {/* Hand-drawn underline that draws itself in, rather than a flat
                    highlight bar. Offset below the descenders of "g"/"p" — an
                    underline that clips the glyphs reads as a strikethrough. */}
                <svg
                  aria-hidden
                  viewBox="0 0 300 22"
                  className="absolute left-0 h-[0.5em] w-full overflow-visible"
                  style={{ bottom: "-0.36em" }}
                  preserveAspectRatio="none"
                >
                  <path
                    d="M4 15C58 6 128 3 296 9"
                    stroke="var(--accent)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.32"
                    style={{ "--len": 300, strokeDasharray: 300, animation: "sff-draw 1.1s cubic-bezier(0.22,1,0.36,1) 0.55s both" } as React.CSSProperties}
                  />
                </svg>
              </span>
            </span>
          </h1>

          <p
            className="sff-enter mx-auto mt-8 max-w-xl text-pretty text-[17px] leading-relaxed text-muted sm:text-lg"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            Drop a file, get a 6-digit code, and it lands on the other device — straight from browser to browser.
            Or share a link for later. Plus {" "}
            <Link href="/tools" className="font-medium text-foreground decoration-accent/40 underline-offset-4 transition hover:underline">
              19 free PDF &amp; image tools
            </Link>{" "}
            that never upload your files anywhere.
          </p>

          <div className="sff-enter mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3" style={{ "--i": 4 } as React.CSSProperties}>
            {TRUST_CHIPS.map(({ icon: Icon, label }) => (
              <span key={label} className="inline-flex items-center gap-2 text-sm text-muted">
                <Icon className="h-4 w-4 text-accent" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ---- The product itself, side by side with the illustration ---- */}
        <div className="mt-14 grid items-center gap-8 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12">
          <div
            id="send"
            ref={cardRef}
            className="sff-enter-scale sff-spotlight relative scroll-mt-28 rounded-3xl border border-border bg-card/90 p-6 shadow-[0_2px_8px_rgba(20,35,29,0.05),0_24px_60px_-30px_rgba(20,35,29,0.28)] backdrop-blur-sm sm:p-8"
            style={{ "--i": 5 } as React.CSSProperties}
          >
            <div className="relative">
              <div className="mb-6 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-xl font-medium tracking-tight text-foreground">Send a file now</h2>
                <Link href="/receive" className="text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline">
                  Got a code?
                </Link>
              </div>
              <SendPanel initialFile={handoffFile} />
            </div>
          </div>

          {/* Deliberately *after* the send card in DOM order: on a phone the drop
              zone is what the visitor came for, so the illustration shouldn't
              push it below the fold. On lg the grid puts them side by side. */}
          <div className="sff-enter-scale" style={{ "--i": 6 } as React.CSSProperties}>
            <TransferAnimation />
          </div>
        </div>
      </div>
    </section>
  );
}
