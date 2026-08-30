import Link from "next/link";
import { TOOLS } from "./tools/registry";
import { DonateLink } from "./DonateLink";
import { IconSend } from "./icons";

/**
 * Shared footer, on a gold field. Also does real work for search: it links
 * every popular tool from every page, which is how the long tail of
 * /tools/* routes gets found without a separate link-building effort.
 */
export function SiteFooter() {
  const featured = TOOLS.slice(0, 10);

  return (
    <footer className="mt-auto bg-gold">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center bg-red text-yellow">
                <IconSend className="h-5 w-5" />
              </span>
              <span className="font-display text-[19px] leading-none text-red">ShareFilesFree</span>
            </div>
            <p className="max-w-xs text-[15px] font-medium leading-[1.6] text-red">
              Send anything to anyone with six digits. No account, no app, no size limit.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5 lg:col-span-2" aria-labelledby="footer-transfer">
            <h2 id="footer-transfer" className="font-display text-[15px] leading-none text-red opacity-60">
              Transfer
            </h2>
            <Link href="/#send" className="sff-nudge w-fit text-[15px] font-semibold text-red">
              Send a file
            </Link>
            <Link href="/receive" className="sff-nudge w-fit text-[15px] font-semibold text-red">
              Receive a file
            </Link>
            <Link href="/#how" className="sff-nudge w-fit text-[15px] font-semibold text-red">
              How it works
            </Link>
            <Link href="/#faq" className="sff-nudge w-fit text-[15px] font-semibold text-red">
              FAQ
            </Link>
          </nav>

          <nav className="flex flex-col gap-2.5 lg:col-span-3" aria-labelledby="footer-tools-a">
            <h2 id="footer-tools-a" className="font-display text-[15px] leading-none text-red opacity-60">
              Popular tools
            </h2>
            {featured.slice(0, 5).map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`} className="sff-nudge w-fit text-[15px] font-semibold text-red">
                {tool.title}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-col gap-2.5 lg:col-span-3" aria-labelledby="footer-tools-b">
            <h2 id="footer-tools-b" className="font-display text-[15px] leading-none text-red opacity-60">
              More tools
            </h2>
            {featured.slice(5, 10).map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`} className="sff-nudge w-fit text-[15px] font-semibold text-red">
                {tool.title}
              </Link>
            ))}
            <Link href="/tools" className="link mt-1 w-fit text-[15px] text-red">
              All {TOOLS.length} tools
            </Link>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 bg-red px-6 py-5 sm:flex-row sm:items-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-lime">
            Your files go straight to the other person — we never keep a copy
          </p>
          <nav className="flex items-center gap-6">
            <Link href="/privacy" className="sff-nudge text-[14px] font-semibold text-yellow">
              Privacy
            </Link>
            <Link href="/terms" className="sff-nudge text-[14px] font-semibold text-yellow">
              Terms
            </Link>
            <DonateLink />
          </nav>
        </div>
      </div>
    </footer>
  );
}
