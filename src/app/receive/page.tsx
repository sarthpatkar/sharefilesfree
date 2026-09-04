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
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">

        <div className="relative mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8">
          <div className="flex items-center gap-4 py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">Receive</span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-24 lg:grid-cols-12">
            <header className="lg:col-span-5">
              <h1 className="font-display text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.06] tracking-[-0.015em] text-red">
                <span className="block">Enter the code</span>
                <span className="block text-accent">you were given.</span>
              </h1>
              <p
                className="sff-enter mt-7 max-w-sm text-[16px] leading-[1.7] text-black"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                Whoever sent this is holding it on their screen right now. Type the six digits and it comes straight to you — it never sits on a server in between, and there is nothing to install.
              </p>
              <p className="sff-enter mt-8 text-sm text-black" style={{ "--i": 4 } as React.CSSProperties}>
                Wanted to send instead?{" "}
                <Link href="/#send" className="link font-medium text-red">
                  Drop a file here
                </Link>
                .
              </p>
            </header>

            <div
              className="sff-enter mt-14 pt-12 lg:col-span-7 lg:mt-0-0 lg:pl-16 lg:pt-0"
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
