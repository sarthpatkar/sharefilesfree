/*
 * Four reasons the product is free, set as plain type.
 *
 * This used to be cards — a swipeable carousel on narrow screens and a
 * sticky stack on wide ones, roughly 190 lines with an IntersectionObserver
 * driving both. All of it is gone on instruction: no cards in this section.
 *
 * The replacement is deliberately dumber. Four parallel reasons want a layout
 * that implies no ranking and no sequence, and a two-column grid of headings
 * does that better than a stack, which always reads as "the last one wins".
 * There is no client state left, so this is a server component now.
 */
const PILLARS = [
  {
    title: "Most sends cost us nothing",
    body: "When you're both online the file goes straight across, never touching a server we rent. That's why there's no size cap here, and no reason to charge you for one.",
  },
  {
    title: "We can't read your files",
    body: "It's locked before it leaves you and opened only on their screen. There's no copy on our side to lose, to sell, or to be asked to hand over.",
  },
  {
    title: "No account, no profile",
    body: "Nothing to sign up for means no email list, no password to leak, and no history with your name on it. What we don't collect can't go missing.",
  },
  {
    title: "Ads pay, you don't",
    body: "The plan is quiet advertising on this page — never charging you, never capping your file size, never dangling a “Pro” tier. If that has to change, it'll say so right here.",
  },
];

export function WhyFree() {
  return (
    <section id="why" className="scroll-mt-20 bg-y-soft">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          Why it&apos;s free
        </p>

        <div className="mt-8 grid gap-x-14 gap-y-6 lg:grid-cols-12">
          <h2 className="font-display text-[clamp(2rem,4.2vw,3.3rem)] leading-[1.06] text-red-bright lg:col-span-6">
            Free, and here&apos;s exactly how.
          </h2>
          <p className="max-w-xl self-end text-[17px] font-medium leading-[1.6] text-black lg:col-span-6">
            Everything free is free for a reason, and you deserve ours before you hand over a file. Four of them, in
            plain language — including the part most people leave out.
          </p>
        </div>

        {/* Four parallel reasons. Nothing boxed: the ordinal and the space
            around each one carry the structure. */}
        <ol className="mt-14 grid gap-x-14 gap-y-12 sm:grid-cols-2 sm:mt-16 lg:gap-y-16">
          {PILLARS.map((pillar, i) => (
            <li key={pillar.title} className="max-w-md">
              <span className="font-display text-[26px] leading-none text-red opacity-25">0{i + 1}</span>
              <h3 className="mt-2 font-display text-[21px] leading-[1.2] text-red-bright">{pillar.title}</h3>
              <p className="mt-3 text-[15.5px] font-medium leading-[1.6] text-black">{pillar.body}</p>
            </li>
          ))}
        </ol>

        {/* The one real trade-off, on a red field rather than in a box — the
            colour change is the emphasis, so nothing needs a border. */}
        <div className="mt-16 max-w-2xl bg-red px-7 py-6 lg:mt-20">
          <p className="text-[15.5px] font-medium leading-[1.6] text-yellow">
            <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-lime-max">The part we&apos;d rather say than hide:</span>{" "}
            both devices have to be open at the same time. We store nothing, anywhere, so there is no copy sitting on
            a server waiting for someone to collect it later. Leave the tab open and your code lasts an hour; close
            it and the transfer is gone. That is the price of the rest of this page being true.
          </p>
        </div>
      </div>
    </section>
  );
}
