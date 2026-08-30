import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { GridBackdrop } from "./landing/GridBackdrop";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

/**
 * Shared shell for /privacy and /terms so the two can't drift apart. Same
 * ruled, editorial language as the rest of the site — sections are separated
 * by hairlines and numbered in mono, rather than boxed into panels.
 */
export function LegalPage({
  kicker,
  title,
  lastUpdated,
  intro,
  sections,
  footnote,
}: {
  kicker: string;
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: LegalSection[];
  footnote?: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <GridBackdrop size={64} className="opacity-50" />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="flex items-center gap-4 border-b border-rule py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">{kicker}</span>
            <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.2em] text-ink-soft">
              Updated {lastUpdated}
            </span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-20 lg:grid-cols-12">
            <header className="lg:col-span-4">
              <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink lg:sticky lg:top-28">
                {title}
              </h1>
            </header>

            <div className="mt-10 lg:col-span-8 lg:mt-0">
              <div className="max-w-2xl text-[16px] leading-[1.75] text-ink-soft">{intro}</div>

              <div className="mt-12 border-t border-ink">
                {sections.map((section, i) => (
                  <section key={section.heading} className="border-b border-rule py-8">
                    <div className="flex items-baseline gap-4">
                      <span className="font-mono text-xs tabular-nums text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="font-display text-xl font-medium tracking-[-0.02em] text-ink">
                        {section.heading}
                      </h2>
                    </div>
                    <div className="mt-4 max-w-2xl space-y-4 text-[15px] leading-[1.75] text-ink-soft sm:pl-10 [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
                      {section.body}
                    </div>
                  </section>
                ))}
              </div>

              {footnote && <p className="mt-8 max-w-2xl border-l-2 border-rule-strong pl-5 text-sm leading-[1.7] text-ink-soft">{footnote}</p>}

              <Link href="/" className="sff-underline mt-12 inline-block text-sm font-medium text-ink">
                Back to ShareFilesFree
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
