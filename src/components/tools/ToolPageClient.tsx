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
    <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
      <div className="flex items-center gap-4 border-b border-rule py-4">
        <Link href="/tools" className="sff-underline inline-flex items-center gap-2 py-1 text-sm text-ink-soft hover:text-ink">
          <IconArrowLeft className="h-4 w-4" />
          All tools
        </Link>
        <span className="hidden h-px flex-1 bg-rule sm:block" />
        <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft sm:ml-0">
          {tool.group}
        </span>
      </div>

      {/* Header and working area sit on the page directly — no wrapper panel,
          so the tool's own drop zone is the only bounded box on screen. */}
      <div className="grid gap-x-16 py-14 lg:grid-cols-12 lg:py-20">
        <header className="lg:col-span-5">
          <div className="sff-enter" style={{ "--i": 0 } as React.CSSProperties}>
            <tool.icon className="h-8 w-8 text-accent" />
            <h1 className="mt-6 font-display text-[clamp(2.2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.012em] text-ink">
              {tool.title}
            </h1>
            {tool.caveat && (
              <span className="mt-4 inline-block border border-rule px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft">
                {tool.caveat}
              </span>
            )}
            <p className="mt-5 max-w-md text-[16px] leading-[1.7] text-ink-soft">{tool.description}</p>
            <p className="mt-6 flex items-start gap-3 border-l-2 border-accent pl-4 text-sm text-ink-soft">
              Runs entirely in your browser — nothing is uploaded anywhere, so there is no queue and no size limit.
            </p>
          </div>
        </header>

        <div
          className="sff-enter mt-12 border-t border-ink pt-10 lg:col-span-7 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <tool.Component onSend={sendToTransfer} />
        </div>
      </div>

      <section className="border-t border-rule py-14">
        <div className="flex items-center gap-4">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">Related tools</h2>
          <span className="h-px flex-1 bg-rule" />
        </div>
        <div className="mt-5 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((t) => (
            <Link
              key={t.slug}
              href={`/tools/${t.slug}`}
              className="sff-cell group flex items-center gap-3 border-b border-rule px-0 py-4 hover:bg-ink sm:px-5 sm:[&:nth-child(2n+1)]:border-r lg:[&:nth-child(2n+1)]:border-r-0 lg:[&:not(:nth-child(3n))]:border-r"
            >
              <t.icon className="h-4 w-4 shrink-0 text-accent" />
              <span className="truncate text-sm text-ink transition-colors group-hover:text-paper">{t.title}</span>
            </Link>
          ))}
        </div>
        <Link href="/tools" className="sff-underline mt-6 inline-block text-sm font-medium text-ink">
          See all {TOOLS.length} tools
        </Link>
      </section>
    </div>
  );
}
