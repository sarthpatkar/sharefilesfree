import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ReceivePanel } from "@/components/ReceivePanel";

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
      <SiteHeader variant="solid" />
      <main className="relative flex flex-1 flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="sff-grid absolute inset-0 opacity-60" />
          <div
            className="sff-aurora absolute -top-24 left-1/2 h-[420px] w-[620px] -translate-x-1/2 rounded-full blur-[120px]"
            style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 68%)", opacity: 0.14 }}
          />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
        </div>

        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 py-16 sm:py-24">
          <header className="sff-enter flex flex-col items-center gap-4 text-center" style={{ "--i": 0 } as React.CSSProperties}>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Receive</p>
            <h1 className="font-display text-3xl font-medium tracking-[-0.02em] text-foreground sm:text-4xl">
              Enter the code you were given.
            </h1>
            <p className="max-w-sm text-pretty text-muted">
              The file transfers straight from the sender&apos;s browser to yours — it never lands on a server in between.
            </p>
          </header>

          <section
            className="sff-enter-scale mt-10 rounded-2xl border border-border bg-card p-6 shadow-[0_2px_8px_rgba(20,35,29,0.05),0_24px_60px_-30px_rgba(20,35,29,0.28)] sm:p-10"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            <ReceivePanel initialCode={code} />
          </section>

          <p className="sff-enter mt-8 text-center text-sm text-muted" style={{ "--i": 2 } as React.CSSProperties}>
            Wanted to send instead?{" "}
            <Link href="/#send" className="font-medium text-accent transition-colors hover:text-accent-hover hover:underline">
              Drop a file here
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
