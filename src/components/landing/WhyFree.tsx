"use client";

import { Reveal, useSpotlight } from "./Reveal";
import { IconLock, IconPackage, IconBlocked, IconWarning } from "../icons";

const PILLARS = [
  {
    icon: IconPackage,
    title: "Most transfers cost us nothing",
    body: "When both devices are online, the file goes browser to browser — it never touches a server we pay for. That's why there's no size cap on this path and no reason to charge you for it.",
  },
  {
    icon: IconLock,
    title: "We can't read your files",
    body: "Peer-to-peer transfers are encrypted end to end by the browser itself. We only relay a 6-digit code and the handshake. There's no copy on our side to lose, sell, or hand over.",
  },
  {
    icon: IconBlocked,
    title: "No account means no profile",
    body: "There's no sign-up, so there's no email list, no password database, and no history tied to you. The thing we don't collect is the thing that can't leak.",
  },
  {
    icon: IconWarning,
    title: "Ads, not your wallet",
    body: "The plan is to pay for the servers with unobtrusive ads on this page — never by charging you, gating your file size, or upselling a \"Pro\" tier. If that ever changes, it'll say so right here.",
  },
];

function Pillar({ pillar, index }: { pillar: (typeof PILLARS)[number]; index: number }) {
  const ref = useSpotlight<HTMLDivElement>();
  return (
    <Reveal delay={index * 110}>
      <div
        ref={ref}
        className="sff-spotlight group relative h-full overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:-translate-y-1 hover:border-accent/50 hover:shadow-[0_18px_40px_-24px_rgba(20,35,29,0.4)]"
      >
        <div className="relative">
          <pillar.icon className="h-6 w-6 text-accent transition-transform duration-500 group-hover:scale-110" />
          <h3 className="mt-5 font-display text-lg font-medium tracking-tight text-foreground">{pillar.title}</h3>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{pillar.body}</p>
        </div>
      </div>
    </Reveal>
  );
}

export function WhyFree() {
  return (
    <section id="why" className="relative scroll-mt-20 border-t border-border py-24 sm:py-32">
      {/* A single soft wash so this band reads as its own chapter, not another white strip */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 0%, var(--glow), transparent 70%)" }}
      />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Why it&apos;s free</p>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="mt-4 max-w-2xl font-display text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground sm:text-[2.75rem]">
            The honest version of &ldquo;free forever&rdquo;.
          </h2>
        </Reveal>
        <Reveal delay={140}>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-muted">
            Every free file-sharing service is free for a reason. Here&apos;s ours, in plain terms — including the part
            most of them leave out.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {PILLARS.map((pillar, i) => (
            <Pillar key={pillar.title} pillar={pillar} index={i} />
          ))}
        </div>

        <Reveal delay={140}>
          <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted">
            One caveat we&apos;d rather say than hide: if the receiver isn&apos;t online, the &ldquo;share a link&rdquo;
            fallback <em>does</em> put the file on storage we rent, encrypted and auto-deleted on the expiry you pick.
            That path has a size cap because it costs real money. The direct code path doesn&apos;t.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
