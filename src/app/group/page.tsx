import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GroupPanel } from "@/components/GroupPanel";
import { MAX_DEVICES } from "@/lib/ads";
import { AdSlot } from "@/components/ads/AdSlot";

export const metadata: Metadata = {
  title: `Send a file to several devices at once — up to ${MAX_DEVICES} — ShareFilesFree`,
  description: `Share one file with up to ${MAX_DEVICES} devices from a single code, link or QR. Everyone gets their own copy straight from your device. No account, no upload, no size limit.`,
  alternates: { canonical: "/group" },
};

export default function GroupPage() {
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <div className="relative mx-auto w-full max-w-[1400px] flex-1 px-5 sm:px-8">
          <div className="flex items-center gap-4 py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-red">Group share</span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-24 lg:grid-cols-12">
            <header className="lg:col-span-5">
              <h1 className="font-display text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.06] tracking-[-0.015em] text-red">
                <span className="block">One code.</span>
                <span className="block text-accent">Everyone&rsquo;s device.</span>
              </h1>
              <p
                className="sff-enter mt-7 max-w-sm text-[16px] leading-[1.7] text-black"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                Pick a file, say how many devices should get it, and share the code, the link or the QR. Up to{" "}
                {MAX_DEVICES} devices can join and each one receives its own copy straight from this device as it
                arrives — nothing is uploaded, and a phone that joins late still gets the whole thing.
              </p>

              <div className="sff-enter mt-10 flex flex-col gap-4" style={{ "--i": 4 } as React.CSSProperties}>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">How this stays private</p>
                <p className="max-w-sm text-[14px] leading-[1.6] text-black opacity-70">
                  A group code is six characters out of a billion possible combinations, not six digits out of a
                  million, because a code that lets in several devices has to be much harder to stumble onto than one
                  that lets in a single person. Leave the share open for longer than ten minutes and the code alone
                  stops being enough — it travels as a link carrying a key nobody can guess.
                </p>
                <p className="max-w-sm text-[14px] leading-[1.6] text-black opacity-70">
                  You can see every device that joins, each with its own code to compare, and you can close the
                  remaining places or disconnect a device at any point.{" "}
                  <Link href="/security" className="link font-medium text-red">
                    How the whole thing is secured
                  </Link>
                  .
                </p>
              </div>

              <p className="sff-enter mt-8 text-sm text-black" style={{ "--i": 5 } as React.CSSProperties}>
                Only sending to one person?{" "}
                <Link href="/#send" className="link font-medium text-red">
                  Use the normal send
                </Link>
                .
              </p>
            </header>

            <div
              className="sff-enter mt-14 pt-12 lg:col-span-7 lg:mt-0 lg:pl-16 lg:pt-0"
              style={{ "--i": 6 } as React.CSSProperties}
            >
              <GroupPanel />
            </div>
          </div>
          <AdSlot slotId="group-page" format="leaderboard" className="pb-14" />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
