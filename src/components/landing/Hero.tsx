"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SendPanel } from "../SendPanel";
import { takeHandoffFile } from "@/lib/handoff";
import { CyclingWord } from "./CyclingWord";

/* Outcomes, not specifications. What someone gets, in their words. */
const FACTS = [
  { k: "File size", v: "The whole 4GB video" },
  { k: "Sign-up", v: "There isn't one" },
  { k: "Who sees it", v: "The two of you" },
  { k: "Also free", v: "19 tools, no watermark" },
];

/* The three things people actually hesitate over, answered right beside the
   drop zone — which is where the hesitation happens. */
const ANSWERS: [string, string][] = [
  ["Is it safe?", "Locked before it leaves you, opened only on their screen. We never hold a copy."],
  ["Will it work?", "Any phone, any laptop, any browser. Nothing to download, on either end."],
  ["What's the catch?", "Ads pay the bills, not you. Your file size is never the price."],
];

export function Hero() {
  const [handoffFile, setHandoffFile] = useState<File | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const file = takeHandoffFile();
      if (file) {
        setHandoffFile(file);
        document.getElementById("send")?.scrollIntoView({ block: "center" });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative overflow-hidden bg-yellow">
      {/* Decorative fields, in hot pink. Placement is a contrast constraint, not
          a taste one: red measures 2.07:1 on this pink and the display red
          1.65:1, so a block may never reach the headline or the "Got a code?"
          link. Black clears it at 6.57:1 — so both blocks bleed in from the
          lower half, where the only type they meet is black. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="sff-bob absolute -bottom-20 -right-16 h-[200px] w-[200px] bg-pink sm:-bottom-28 sm:-right-24 sm:h-[360px] sm:w-[360px]"
          style={{ "--tilt": "12deg" } as React.CSSProperties}
        />
        <div className="absolute -left-36 top-[58%] h-[150px] w-[150px] rotate-[18deg] bg-pink sm:-left-32 sm:top-[60%] sm:h-[240px] sm:w-[240px]" />
      </div>

      <div className="relative mx-auto w-full max-w-[1400px] px-5 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <div className="grid gap-x-10 gap-y-12 min-[900px]:grid-cols-12 min-[900px]:gap-y-0 lg:gap-x-16">
          {/* ---------- Words ---------- */}
          <div className="min-[900px]:col-span-7">
            <p
              className="sff-stamp inline-block bg-red px-3 py-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.18em] text-yellow"
              style={{ "--i": 0 } as React.CSSProperties}
            >
              Free forever · No sign-up
            </p>

            <h1
              className="sff-stamp mt-6 font-display text-[clamp(2.3rem,5vw,4.1rem)] leading-[1.06] text-red-bright"
              style={{ "--i": 1 } as React.CSSProperties}
            >
              <span className="block">Send files,</span>
              <span className="block">
                not{" "}
                <CyclingWord words={["sign-ups.", "accounts.", "uploads.", "waiting.", "excuses."]} />
              </span>
            </h1>

            <p
              className="sff-stamp mt-8 max-w-lg text-[17px] font-medium leading-[1.6] text-black sm:text-[19px]"
              style={{ "--i": 2 } as React.CSSProperties}
            >
              Your file is on their screen before you&apos;ve finished reading out the code. No account. No app. No
              2GB ceiling that suddenly wants your card details. And the moment it lands, it&apos;s gone from here —
              along with{" "}
              <Link href="/tools" className="link">
                19 free tools
              </Link>{" "}
              that work the same way.
            </p>
          </div>

          {/* ---------- The product ---------- */}
          <div
            id="send"
            className="sff-stamp scroll-mt-24 min-[900px]:col-span-5"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            {/* Heading sits on the page ground, not inside a panel — the drop
                zone below is the only block here, so nothing is nested. */}
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <h2 className="font-display text-[21px] leading-none text-red">Send a file now</h2>
              <Link href="/receive" className="link shrink-0 text-[15px] text-red">
                Got a code?
              </Link>
            </div>

            <SendPanel initialFile={handoffFile} />

            <dl className="mt-6 flex flex-col gap-4">
              {ANSWERS.map(([q, a]) => (
                <div key={q}>
                  <dt className="text-[15px] font-bold leading-none text-black">{q}</dt>
                  <dd className="mt-1.5 text-[14px] font-medium leading-[1.5] text-black">{a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* ---------- Fact band: red field, yellow type ---------- */}
      <div className="relative bg-red">
        <dl className="mx-auto grid w-full max-w-[1400px] grid-cols-2 gap-x-8 gap-y-7 px-5 py-9 sm:px-8 md:grid-cols-4">
          {FACTS.map((fact) => (
            <div key={fact.k}>
              <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime-max">{fact.k}</dt>
              <dd className="mt-2 text-[clamp(1.05rem,1.7vw,1.35rem)] font-bold leading-none tracking-[-0.01em] text-yellow">{fact.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
