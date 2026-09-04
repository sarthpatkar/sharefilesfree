import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 flex-col justify-center px-5 py-24 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent">Error 404</p>
          <h1 className="mt-6 max-w-3xl font-display text-[clamp(2.1rem,4.6vw,3.5rem)] leading-[1.06] tracking-[-0.015em] text-red">
            <span className="block">This page isn&apos;t here.</span>
          </h1>
          <p
            className="sff-enter mt-7 max-w-md text-[17px] leading-[1.65] text-black"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            Either it never existed, or a shared link pointing here has expired or been removed — which is working
            as intended, since every link we issue deletes itself.
          </p>
          <div
            className="sff-enter mt-10 flex flex-wrap items-center gap-x-8 gap-y-4"
            style={{ "--i": 3 } as React.CSSProperties}
          >
            <Link
              href="/"
              className="sff-press inline-flex items-center bg-ink px-6 py-3.5 text-[15px] font-medium leading-none text-paper shadow-[5px_5px_0_var(--accent)] hover:bg-accent"
            >
              Back to ShareFilesFree
            </Link>
            <Link href="/tools" className="link py-2 text-[15px] font-medium text-red">
              Browse the tools
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
