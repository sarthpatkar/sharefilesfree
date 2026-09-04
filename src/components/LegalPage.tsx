import Link from "next/link";
import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

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

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="flex items-center gap-4 py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">{kicker}</span>
            <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.2em] text-red">
              Updated {lastUpdated}
            </span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-20 lg:grid-cols-12">
            <header className="lg:col-span-4">
              <h1 className="font-display text-[clamp(1.9rem,3.8vw,2.8rem)] leading-[1.06] tracking-[-0.015em] text-red lg:sticky lg:top-28">
                {title}
              </h1>
            </header>

            <div className="mt-10 lg:col-span-8 lg:mt-0">
              <div className="max-w-2xl text-[16px] leading-[1.75] text-black">{intro}</div>

              <div className="mt-12">
                {sections.map((section, i) => (
                  <section key={section.heading} className=" py-8">
                    <div className="flex items-baseline gap-4">
                      <span className="font-mono text-xs tabular-nums text-accent">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h2 className="font-display text-[1.15rem] tracking-[-0.015em] text-red">
                        {section.heading}
                      </h2>
                    </div>
                    <div className="mt-4 max-w-2xl space-y-4 text-[15px] leading-[1.75] text-black sm:pl-10 [&_a]:text-black [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
                      {section.body}
                    </div>
                  </section>
                ))}
              </div>

              {footnote && <p className="mt-8 max-w-2xl-2-strong pl-5 text-sm leading-[1.7] text-black">{footnote}</p>}

              <Link href="/" className="link mt-12 inline-block text-sm font-medium text-red">
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
