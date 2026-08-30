import type { Metadata } from "next";
import { DownloadPanel } from "@/components/DownloadPanel";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { GridBackdrop } from "@/components/landing/GridBackdrop";

// Shared links are single-use and private — they should never be indexed.
export const metadata: Metadata = {
  title: "Download a shared file — ShareFilesFree",
  robots: { index: false, follow: false },
};

export default async function DownloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <SiteHeader />
      <main className="relative flex flex-1 flex-col overflow-hidden">
        <GridBackdrop size={64} className="opacity-50" />

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <div className="flex items-center gap-4 border-b border-rule py-4">
            <span className="h-1.5 w-1.5 shrink-0 bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-soft">
              Someone shared a file with you
            </span>
          </div>

          <div className="grid gap-x-16 py-16 sm:py-24 lg:grid-cols-12">
            <header className="lg:col-span-5">
              <h1 className="font-display text-[clamp(2.2rem,5vw,3.5rem)] font-medium leading-[1.02] tracking-[-0.03em] text-ink">
                <span className="block overflow-hidden pb-[0.06em]">
                  <span className="sff-line" style={{ "--i": 0 } as React.CSSProperties}>
                    Your file is
                  </span>
                </span>
                <span className="block overflow-hidden pb-[0.06em]">
                  <span className="sff-line text-accent" style={{ "--i": 1 } as React.CSSProperties}>
                    ready.
                  </span>
                </span>
              </h1>
              <p
                className="sff-enter mt-6 max-w-sm text-[16px] leading-[1.7] text-ink-soft"
                style={{ "--i": 3 } as React.CSSProperties}
              >
                This link was created by whoever sent it to you. Files are deleted automatically once the link
                expires — or immediately after the first download, if the sender chose that.
              </p>
            </header>

            <div
              className="sff-enter mt-12 border-t border-ink pt-10 lg:col-span-7 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0"
              style={{ "--i": 4 } as React.CSSProperties}
            >
              <DownloadPanel token={token} />
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
