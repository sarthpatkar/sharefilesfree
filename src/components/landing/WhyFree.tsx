"use client";

import { Reveal, SectionLabel } from "./Reveal";

const PILLARS = [
  {
    n: "01",
    title: "Most transfers cost us nothing",
    body: "When both devices are online the file goes browser to browser — it never touches a server we pay for. That's why there's no size cap on this path, and no reason to charge you for it.",
  },
  {
    n: "02",
    title: "We can't read your files",
    body: "Peer-to-peer transfers are encrypted end to end by the browser itself. We only relay a 6-digit code and the handshake. There's no copy on our side to lose, sell, or hand over.",
  },
  {
    n: "03",
    title: "No account means no profile",
    body: "There's no sign-up, so there's no email list, no password database, and no history tied to you. The thing we don't collect is the thing that can't leak.",
  },
  {
    n: "04",
    title: "Ads, not your wallet",
    body: "The plan is to pay for the servers with unobtrusive ads on this page — never by charging you, gating your file size, or upselling a “Pro” tier. If that ever changes, it'll say so right here.",
  },
];

export function WhyFree() {
  return (
    <section id="why" className="scroll-mt-20 border-b border-rule">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-20 sm:px-8 sm:py-28">
        <Reveal>
          <SectionLabel index="03">Why it&apos;s free</SectionLabel>
        </Reveal>

        <Reveal delay={90}>
          <h2 className="mt-10 max-w-3xl font-display text-[clamp(2rem,5vw,3.75rem)] font-medium leading-[1.02] tracking-[-0.012em] text-ink">
            The honest version of &ldquo;free forever&rdquo;.
          </h2>
        </Reveal>

        <Reveal delay={150}>
          <p className="mt-6 max-w-xl text-[16px] leading-[1.7] text-ink-soft">
            Every free file-sharing service is free for a reason. Here&apos;s ours, in plain terms — including the
            part most of them leave out.
          </p>
        </Reveal>

        {/* A ruled matrix: neighbours share hairlines, so nothing reads as a
            free-floating card. Hover inverts the whole cell to solid ink. */}
        <div className="mt-16 grid border-t border-ink sm:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <Reveal
              key={pillar.n}
              delay={i * 100}
              className="border-b border-rule sm:[&:nth-child(odd)]:border-r"
            >
              <div className="sff-cell group h-full px-0 py-9 hover:bg-ink sm:px-8 sm:[&]:first:pl-0">
                <span className="font-mono text-sm tabular-nums text-accent">{pillar.n}</span>
                <h3 className="mt-4 font-display text-2xl font-medium tracking-[-0.008em] text-ink transition-colors group-hover:text-paper">
                  {pillar.title}
                </h3>
                <p className="mt-3 max-w-md text-[15px] leading-[1.7] text-ink-soft transition-colors group-hover:text-paper/75">
                  {pillar.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={140}>
          <p className="mt-10 max-w-2xl border-l-2 border-accent pl-5 text-[15px] leading-[1.7] text-ink-soft">
            One caveat we&apos;d rather say than hide: if the receiver isn&apos;t online, the &ldquo;share a
            link&rdquo; fallback <em>does</em> put the file on storage we rent, encrypted and auto-deleted on the
            expiry you pick. That path has a size cap because it costs real money. The direct code path doesn&apos;t.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
