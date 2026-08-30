import Link from "next/link";
import { TOOLS } from "./tools/registry";
import { DonateLink } from "./DonateLink";
import { IconSend } from "./icons";

/**
 * Shared footer. Also does real SEO work: it links every popular tool from
 * every page on the site, which is how the long tail of /tools/* routes gets
 * discovered and crawled without a separate link-building effort.
 */
export function SiteFooter() {
  const featured = TOOLS.slice(0, 10);

  return (
    <footer className="mt-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        <div className="grid gap-y-12 border-t border-ink py-14 sm:grid-cols-2 lg:grid-cols-12 lg:gap-x-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center bg-accent text-on-accent">
                <IconSend className="h-4 w-4" />
              </span>
              <span className="font-display text-[19px] font-bold leading-none tracking-[-0.02em] text-ink">
                ShareFilesFree
              </span>
            </div>
            <p className="max-w-xs text-[15px] leading-[1.65] text-ink-soft">
              Send files between any two devices with a 6-digit code. No account, no app, no size-limit games.
            </p>
          </div>

          <nav className="flex flex-col gap-3 lg:col-span-2" aria-labelledby="footer-transfer">
            <h2 id="footer-transfer" className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Transfer
            </h2>
            <Link href="/#send" className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink">
              Send a file
            </Link>
            <Link href="/receive" className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink">
              Receive a file
            </Link>
            <Link href="/#how" className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink">
              How it works
            </Link>
            <Link href="/#faq" className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink">
              FAQ
            </Link>
          </nav>

          <nav className="flex flex-col gap-3 lg:col-span-3" aria-labelledby="footer-tools-a">
            <h2 id="footer-tools-a" className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              Popular tools
            </h2>
            {featured.slice(0, 5).map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink"
              >
                {tool.title}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-col gap-3 lg:col-span-3" aria-labelledby="footer-tools-b">
            <h2 id="footer-tools-b" className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              More tools
            </h2>
            {featured.slice(5, 10).map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="sff-underline w-fit py-1 text-sm text-ink-soft hover:text-ink"
              >
                {tool.title}
              </Link>
            ))}
            <Link href="/tools" className="sff-underline w-fit py-1 text-sm font-medium text-accent">
              All {TOOLS.length} tools
            </Link>
          </nav>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-rule py-6 sm:flex-row sm:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
            Files move directly between browsers — we never store or see them
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="sff-underline py-1 text-xs text-ink-soft hover:text-ink">
              Privacy
            </Link>
            <Link href="/terms" className="sff-underline py-1 text-xs text-ink-soft hover:text-ink">
              Terms
            </Link>
            <DonateLink />
          </nav>
        </div>
      </div>
    </footer>
  );
}
