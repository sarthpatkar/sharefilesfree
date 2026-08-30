import Link from "next/link";
import { TOOLS } from "./tools/registry";
import { DonateLink } from "./DonateLink";
import { IconSend } from "./icons";

/**
 * Shared footer. Also does real SEO work: it links every tool page from every
 * page on the site, which is how the long tail of /tools/* routes gets
 * discovered and crawled without a separate link-building effort.
 */
export function SiteFooter() {
  const featured = TOOLS.slice(0, 10);

  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <IconSend className="h-4 w-4" />
              </span>
              <span className="font-display text-[17px] font-medium tracking-tight text-foreground">ShareFilesFree</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Send files between any two devices with a 6-digit code. No account, no app, no size-limit games.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted">Transfer</h3>
            <nav className="flex flex-col gap-2 text-sm">
              <Link href="/#send" className="w-fit text-muted transition-colors hover:text-foreground">
                Send a file
              </Link>
              <Link href="/receive" className="w-fit text-muted transition-colors hover:text-foreground">
                Receive a file
              </Link>
              <Link href="/#how" className="w-fit text-muted transition-colors hover:text-foreground">
                How it works
              </Link>
              <Link href="/#faq" className="w-fit text-muted transition-colors hover:text-foreground">
                FAQ
              </Link>
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted">Popular tools</h3>
            <nav className="flex flex-col gap-2 text-sm">
              {featured.slice(0, 5).map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`} className="w-fit text-muted transition-colors hover:text-foreground">
                  {tool.title}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-muted">More tools</h3>
            <nav className="flex flex-col gap-2 text-sm">
              {featured.slice(5, 10).map((tool) => (
                <Link key={tool.slug} href={`/tools/${tool.slug}`} className="w-fit text-muted transition-colors hover:text-foreground">
                  {tool.title}
                </Link>
              ))}
              <Link href="/tools" className="w-fit font-medium text-accent transition-colors hover:text-accent-hover">
                All {TOOLS.length} tools →
              </Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-muted sm:flex-row">
          <p>Files move directly between browsers — we never store or see them.</p>
          <nav className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <DonateLink />
          </nav>
        </div>
      </div>
    </footer>
  );
}
