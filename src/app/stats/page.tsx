import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { StatsBoard } from "@/components/StatsBoard";
import { AdSlot } from "@/components/ads/AdSlot";

export const metadata: Metadata = {
  title: "Live stats — how much ShareFilesFree has moved, and stored",
  description:
    "Real running totals from ShareFilesFree: bytes moved between people, files delivered, how often a transfer goes device to device, and the amount we have stored, which is zero.",
  alternates: { canonical: "/stats" },
};

/**
 * A public page rather than an admin one, on purpose.
 *
 * This service asks people to believe something unusual — that their file is
 * never uploaded anywhere — and the honest way to support a claim like that is
 * to publish the number that would expose it if it were false. Bytes moved next
 * to bytes stored says it in a way no paragraph on the About page can.
 *
 * The numbers themselves come from /api/metrics on the client, so this page
 * stays prerendered and edge-cached like every other page here. See StatsBoard.
 */
export default function StatsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <section className="relative overflow-hidden">
          <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
            <div className="flex items-center gap-4 py-4">
              <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">live numbers</span>
            </div>
            <div className="grid gap-x-12 py-16 sm:py-24 lg:grid-cols-12">
              <h1 className="col-span-full font-display text-[clamp(2.2rem,5vw,4.1rem)] leading-[1.06] tracking-[-0.015em] text-red lg:col-span-8">
                <span className="block">Everything we&rsquo;ve moved.</span>
                <span className="block text-accent">Nothing we&rsquo;ve kept.</span>
              </h1>
              <p
                className="sff-enter col-span-full mt-8 max-w-lg text-[17px] leading-[1.65] text-black lg:col-span-5"
                style={{ "--i": 4 } as React.CSSProperties}
              >
                Most services ask you to trust a privacy policy. This one can be checked against a number: the total
                we are holding, which has never been anything other than zero.
              </p>
            </div>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[900px] px-5 pb-16 sm:px-8 sm:pb-24">
          <StatsBoard />

          <div className="mt-16 flex flex-col gap-4 border-t border-rule pt-10">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">Why zero is possible</h2>
            <p className="max-w-2xl text-[15px] leading-[1.65] text-black">
              A file here goes straight from one browser to the other. Our server introduces the two devices and then
              steps out of the way — it never receives the file, so there is no bucket, no retention window and
              nothing to hand over. That is also why both devices have to be open at the same time, which is the real
              cost of the design and the one thing it asks of you.
            </p>
            <p className="max-w-2xl text-[15px] leading-[1.65] text-black">
              The trade-off, and what happens when a network refuses a direct connection, is written out on the{" "}
              <Link href="/about" className="link">
                about page
              </Link>
              , and what we do and do not hold is in the{" "}
              <Link href="/privacy" className="link">
                privacy policy
              </Link>
              .
            </p>
          </div>

          <AdSlot slotId="stats-footer" format="leaderboard" className="mt-16" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
