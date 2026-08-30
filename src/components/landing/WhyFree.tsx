"use client";

import { useEffect, useRef, useState } from "react";

const PILLARS = [
  {
    field: "bg-y-max",
    title: "Most sends cost us nothing",
    body: "When you're both online the file goes straight across, never touching a server we rent. That's why there's no size cap here, and no reason to charge you for one.",
  },
  {
    field: "bg-lime-max",
    title: "We can't read your files",
    body: "It's locked before it leaves you and opened only on their screen. There's no copy on our side to lose, to sell, or to be asked to hand over.",
  },
  {
    field: "bg-blush",
    title: "No account, no profile",
    body: "Nothing to sign up for means no email list, no password to leak, and no history with your name on it. What we don't collect can't go missing.",
  },
  {
    field: "bg-pink",
    title: "Ads pay, you don't",
    body: "The plan is quiet advertising on this page — never charging you, never capping your file size, never dangling a “Pro” tier. If that has to change, it'll say so right here.",
  },
];

/**
 * Four reasons, presented two ways because one presentation can't serve both
 * widths honestly.
 *
 * Wide: they STACK. Each card sticks a little lower than the last, so the ones
 * above stay on screen as title bands and you end up looking at all four piled
 * up rather than at a winner. Parallel reasons, so nothing implies an order.
 *
 * Narrow: stacking has nowhere to go — a phone viewport can't hold four pinned
 * cards, which is why it previously collapsed to a dead list. So below lg it
 * becomes a snap carousel you swipe, with the next card peeking to advertise
 * that it moves, and a dot rail showing where you are. Native scroll-snap, so
 * momentum and rubber-banding stay exactly as the OS does them.
 */
export function WhyFree() {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const track = trackRef.current;
    const cards = cardRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!track || cards.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!best) return;
        const index = cards.indexOf(best.target as HTMLDivElement);
        if (index >= 0) setActive(index);
      },
      { root: track, threshold: [0.5, 0.75, 1] },
    );

    cards.forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);

  function goTo(i: number) {
    cardRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }

  return (
    <section id="why" className="scroll-mt-20 bg-y-soft">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          Why it&apos;s free
        </p>

        <div className="mt-8 grid gap-x-14 gap-y-6 lg:grid-cols-12">
          <h2 className="font-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.0] text-red-bright lg:col-span-6">
            Free, and here&apos;s exactly how.
          </h2>
          <p className="max-w-xl self-end text-[17px] font-medium leading-[1.6] text-red lg:col-span-6">
            Everything free is free for a reason, and you deserve ours before you hand over a file. Four of them, in
            plain language — including the part most people leave out.
          </p>
        </div>

        {/* ---------- Narrow: swipeable snap carousel ---------- */}
        <div className="mt-12 overflow-hidden lg:hidden">
          <div
            ref={trackRef}
            className="sff-track -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-3"
          >
            {PILLARS.map((pillar, i) => (
              <div
                key={pillar.title}
                ref={(el) => {
                  cardRefs.current[i] = el;
                }}
                className={`sff-block w-[82vw] max-w-sm shrink-0 snap-center p-6 transition-transform duration-300 ${pillar.field} ${
                  i === active ? "scale-100" : "scale-[0.955]"
                }`}
              >
                <span className="font-display text-[46px] leading-none text-red">0{i + 1}</span>
                <h3 className="mt-2 font-display text-[26px] leading-[1.05] text-red-bright">{pillar.title}</h3>
                <p className="mt-3 text-[15px] font-medium leading-[1.55] text-red">{pillar.body}</p>
              </div>
            ))}
          </div>

          {/* Dot rail — also a control, not just an indicator. */}
          <div className="mt-5 flex items-center gap-2">
            {PILLARS.map((pillar, i) => (
              <button
                key={pillar.title}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show reason ${i + 1}: ${pillar.title}`}
                aria-current={i === active}
                className="group flex h-11 flex-1 items-center"
              >
                <span
                  className={`h-2 w-full transition-colors duration-300 ${i === active ? "bg-red" : "bg-lime-4"}`}
                />
              </button>
            ))}
            <span className="ml-2 shrink-0 font-display text-[15px] leading-none text-red">
              {active + 1}/{PILLARS.length}
            </span>
          </div>
        </div>

        {/*
          ---------- Wide: the stack ----------
          The gap between cards is what creates the scroll journey the pile
          forms over. At a 24px gap all four sat inside one screen, so a card
          pinned and unpinned almost immediately and nothing ever stacked.
          Each card now carries ~36vh of space beneath it, which is the
          distance you travel before the next one slides over the top.
        */}
        <div className="mt-20 hidden flex-col lg:flex">
          {PILLARS.map((pillar, i) => (
            // The CARD is the sticky element, not a wrapper around it. A tall
            // sticky box reaches the end of its container early and gets
            // shoved upward, which collapsed all four onto the same offset —
            // the spacing has to be margin *outside* the sticky box, never
            // padding inside it.
            <div
              key={pillar.title}
              // Two things this spacing has to buy:
              //   - room between cards, so each arrives as a separate event;
              //   - a long tail after the LAST one, otherwise the container
              //     ended the moment it landed and the finished pile was only
              //     on screen for a few pixels. Card 03 was being covered
              //     outright by 04 because 04 never finished travelling.
              className={`sff-block sticky flex gap-8 p-9 ${pillar.field} ${
                i === PILLARS.length - 1 ? "mb-[80vh]" : "mb-[38vh]"
              }`}
              // 5.5rem of stagger leaves a comfortably readable band of each
              // card below the one that covers it. 4.5 was too tight.
              style={{ top: `calc(7rem + ${i * 5.5}rem)`, zIndex: i + 1 }}
            >
              <span className="w-24 shrink-0 font-display text-[46px] leading-none text-red">0{i + 1}</span>
              <div>
                <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.05] text-red-bright">
                  {pillar.title}
                </h3>
                <p className="mt-3 max-w-2xl text-[16px] font-medium leading-[1.55] text-red">{pillar.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-2xl bg-red p-7 lg:mt-16">
          <p className="text-[16px] font-medium leading-[1.6] text-yellow">
            <span className="font-display text-[20px] text-lime-max">The part we&apos;d rather say than hide:</span>{" "}
            if the person you&apos;re sending to isn&apos;t around, the shareable link does park your file on storage
            we rent — locked, and deleted on the schedule you choose. That route has a size cap, because it costs us
            real money. The six-digit route doesn&apos;t.
          </p>
        </div>
      </div>
    </section>
  );
}
