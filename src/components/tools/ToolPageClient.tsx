"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getToolBySlug, TOOLS } from "./registry";
import { setHandoffFile } from "@/lib/handoff";
import { IconArrowLeft } from "../icons";

/** Client wrapper so the actual tool component (and its onSend→handoff wiring) can run interactively, while the route itself stays a Server Component for metadata/generateStaticParams. */
export function ToolPageClient({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  const router = useRouter();

  if (!tool) return null;

  function sendToTransfer(file: File) {
    setHandoffFile(file);
    // The landing page picks the file up from the handoff store and scrolls
    // to the send panel — see components/landing/Hero.tsx.
    router.push("/#send");
  }

  const related = TOOLS.filter((t) => t.slug !== slug && t.group === tool!.group).slice(0, 5);
  const others = TOOLS.filter((t) => t.slug !== slug && t.group !== tool!.group).slice(0, 6 - related.length);
  const suggestions = [...related, ...others];

  return (
    <div className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-14 sm:py-20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="sff-aurora absolute -top-20 left-1/2 h-[360px] w-[560px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.12 }}
        />
      </div>

      <Link
        href="/tools"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover"
      >
        <IconArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        All tools
      </Link>

      <header className="sff-enter flex flex-col items-center gap-3 text-center" style={{ "--i": 0 } as React.CSSProperties}>
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(20,35,29,0.05)]">
          <tool.icon className="h-7 w-7 text-accent" />
        </span>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">{tool.title}</h1>
        <p className="max-w-md text-pretty leading-relaxed text-muted">{tool.description}</p>
        <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Runs entirely in your browser — nothing is uploaded anywhere
        </p>
      </header>

      <section
        className="sff-enter-scale rounded-2xl border border-border bg-card p-6 shadow-[0_2px_8px_rgba(20,35,29,0.05),0_24px_60px_-30px_rgba(20,35,29,0.28)] sm:p-10"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <tool.Component onSend={sendToTransfer} />
      </section>

      <section className="sff-enter" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-[0.15em] text-muted">Related tools</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {suggestions.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="group flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-[0_8px_20px_-12px_rgba(20,35,29,0.4)]"
            >
              <t.icon className="h-4 w-4 shrink-0 text-accent transition-transform duration-300 group-hover:scale-110" />
              <span className="truncate">{t.title}</span>
            </Link>
          ))}
        </div>
        <Link href="/tools" className="mt-3 inline-block text-sm font-medium text-accent transition-colors hover:text-accent-hover hover:underline">
          See all {TOOLS.length} tools →
        </Link>
      </section>
    </div>
  );
}
