"use client";

const PILLARS = [
  {
    field: "bg-yellow",
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

export function WhyFree() {
  return (
    <section id="why" className="scroll-mt-20 bg-y-soft">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <p className="inline-block bg-red px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.18em] text-yellow">
          Why it&apos;s free
        </p>

        <h2 className="mt-8 max-w-3xl font-display text-[clamp(2.4rem,5.6vw,4.6rem)] leading-[1.0] text-red-bright">
          Free, and here&apos;s exactly how.
        </h2>

        <p className="mt-6 max-w-xl text-[17px] font-medium leading-[1.6] text-red">
          Everything free is free for a reason, and you deserve ours before you hand over a file. Four of them, in
          plain language — including the part most people leave out.
        </p>

        {/* Four fields, each a different colour. The colour change is the
            divider; nothing is boxed by a rule. */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <div key={pillar.title} className={`sff-block-sm p-7 ${pillar.field}`}>
              <span className="font-display text-[40px] leading-none text-red opacity-30">0{i + 1}</span>
              <h3 className="mt-2 font-display text-[26px] leading-[1.05] text-red">{pillar.title}</h3>
              <p className="mt-3 max-w-md text-[15px] font-medium leading-[1.55] text-red">{pillar.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 max-w-2xl bg-red p-7">
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
