import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ReceivePanel } from "@/components/ReceivePanel";
import { GridBackdrop } from "@/components/landing/GridBackdrop";

export const metadata: Metadata = {
  title: "Receive a file — enter your 6-digit code — ShareFilesFree",
  description:
    "Enter the 6-digit code from the sender to receive a file directly in your browser. No account, no app install, no waiting on an upload.",
};

export default async function ReceivePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <GridBackdrop size={64} className="opacity-60" />

        <div className="relative mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8">
          <div className="flex items-center gap-4 border-b border-rule py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">Receive</span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-24 lg:grid-cols-12">
            <header className="lg:col-span-5">
              <h1 className="font-display text-[clamp(2.4rem,6vw,4.5rem)] font-medium leading-[1.04] tracking-[-0.015em] text-ink">
                <span className="block overflow-hidden pb-[0.13em]">
                  <span className="sff-line" style={{ "--i": 0 } as React.CSSProperties}>
                    Enter the code
                  </span>
                </span>
                <span className="block overflow-hidden pb-[0.13em]">
                  <span className="sff-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>
                    you were given.
                  </span>
                </span>
              </h1>
              <p
                className="sff-enter mt-7 max-w-sm text-[16px] leading-[1.7] text-ink-soft"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                The file transfers straight from the sender&apos;s browser to yours — it never lands on a server in
                between, and there&apos;s nothing to install on either end.
              </p>
              <p className="sff-enter mt-8 text-sm text-ink-soft" style={{ "--i": 4 } as React.CSSProperties}>
                Wanted to send instead?{" "}
                <Link href="/#send" className="sff-underline font-medium text-ink">
                  Drop a file here
                </Link>
                .
              </p>
            </header>

            <div
              className="sff-enter mt-14 border-t border-ink pt-12 lg:col-span-7 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0"
              style={{ "--i": 5 } as React.CSSProperties}
            >
              <ReceivePanel initialCode={code} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
