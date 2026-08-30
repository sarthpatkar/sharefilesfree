"use client";

const PILLARS = [
  {
    field: "bg-y-max",
    title: "Most sends cost us nothing",
    body: "When you're both online the file goes straight across, never touching a server we rent. That's why there's no size cap here, and no reason to charge you for one.",
  },
  {
    field: "bg-lime",
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
 * Four reasons that stack.
 *
 * These are parallel, not sequential — so a horizontal track or a numbered
 * advance would imply an order that isn't there. Stacking is the honest
 * device: each card pins in turn and the next slides over it, leaving a
 * visible edge of every card underneath, so you end up looking at all four
 * piled up rather than at a winner.
 *
 * Built purely on position:sticky. The browser drives it, so there's no
 * scroll listener, no hijacking, and nothing to jank. Below lg the sticky
 * offsets would fight the smaller viewport, so it degrades to a plain
 * stacked list.
 */
export function WhyFree() {
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

        {/* The stack. Each card sticks a little lower than the last, so the
            one above stays visible as a band once it's been passed. */}
        <div className="mt-14 flex flex-col gap-5 lg:mt-20 lg:gap-0">
          {PILLARS.map((pillar, i) => (
            <div
              key={pillar.title}
              className="lg:sticky lg:pb-6"
              style={{
                // 7rem clears the sticky header; each card lands 4.5rem below
                // the previous so its number strip stays on screen.
                top: `calc(7rem + ${i * 4.5}rem)`,
                zIndex: i + 1,
              }}
            >
              <div className={`sff-block flex flex-col gap-3 p-7 sm:flex-row sm:gap-8 sm:p-9 ${pillar.field}`}>
                <span className="font-display text-[46px] leading-none text-red sm:w-24 sm:shrink-0">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-display text-[clamp(1.5rem,2.6vw,2.1rem)] leading-[1.05] text-red-bright">
                    {pillar.title}
                  </h3>
                  <p className="mt-3 max-w-2xl text-[15px] font-medium leading-[1.55] text-red sm:text-[16px]">
                    {pillar.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-2xl bg-red p-7 lg:mt-16">
          <p className="text-[16px] font-medium leading-[1.6] text-yellow">
            <span className="font-display text-[20px] text-lime">The part we&apos;d rather say than hide:</span>{" "}
            if the person you&apos;re sending to isn&apos;t around, the shareable link does park your file on storage
            we rent — locked, and deleted on the schedule you choose. That route has a size cap, because it costs us
            real money. The six-digit route doesn&apos;t.
          </p>
        </div>
      </div>
    </section>
  );
}
