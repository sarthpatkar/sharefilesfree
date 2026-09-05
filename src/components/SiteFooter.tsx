import Link from "next/link";
import { TOOLS } from "./tools/registry";
import { DonateLink } from "./DonateLink";
import { IconHeart, IconSend } from "./icons";

/**
 * Shared footer, on a mid-yellow field. Also does real work for search: it links
 * every popular tool from every page, which is how the long tail of
 * /tools/* routes gets found without a separate link-building effort.
 */
export function SiteFooter() {
  const featured = TOOLS.slice(0, 10);

  return (
    <footer className="mt-auto bg-y-mid">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8">
        <div className="grid gap-y-12 lg:grid-cols-12 lg:gap-x-12">
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center bg-red text-yellow">
                <IconSend className="h-5 w-5" />
              </span>
              <span className="font-display text-[19px] leading-none text-red">ShareFilesFree</span>
            </div>
            <p className="max-w-xs text-[15px] font-medium leading-[1.6] text-black">
              Send anything to anyone with six digits. No account, no app, no size limit.
            </p>
          </div>

          <nav className="flex flex-col gap-2.5 lg:col-span-2" aria-labelledby="footer-transfer">
            <h2 id="footer-transfer" className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-55">
              Transfer
            </h2>
            <Link href="/#send" className="sff-nudge w-fit text-[15px] font-semibold text-black">
              Send a file
            </Link>
            <Link href="/receive" className="sff-nudge w-fit text-[15px] font-semibold text-black">
              Receive a file
            </Link>
            <Link href="/#how" className="sff-nudge w-fit text-[15px] font-semibold text-black">
              How it works
            </Link>
            <Link href="/#faq" className="sff-nudge w-fit text-[15px] font-semibold text-black">
              FAQ
            </Link>
          </nav>

          <nav className="flex flex-col gap-2.5 lg:col-span-3" aria-labelledby="footer-tools-a">
            <h2 id="footer-tools-a" className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-55">
              Popular tools
            </h2>
            {featured.slice(0, 5).map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`} className="sff-nudge w-fit text-[15px] font-semibold text-black">
                {tool.title}
              </Link>
            ))}
          </nav>

          <nav className="flex flex-col gap-2.5 lg:col-span-3" aria-labelledby="footer-tools-b">
            <h2 id="footer-tools-b" className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-55">
              More tools
            </h2>
            {featured.slice(5, 10).map((tool) => (
              <Link key={tool.slug} href={`/tools/${tool.slug}`} className="sff-nudge w-fit text-[15px] font-semibold text-black">
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
            <Link href="/about" className="sff-nudge text-[14px] font-semibold text-yellow">
              About
            </Link>
            <Link href="/contact" className="sff-nudge text-[14px] font-semibold text-yellow">
              Contact
            </Link>
            <Link href="/privacy" className="sff-nudge text-[14px] font-semibold text-yellow">
              Privacy
            </Link>
            <Link href="/terms" className="sff-nudge text-[14px] font-semibold text-yellow">
              Terms
            </Link>
            <DonateLink />
          </nav>
        </div>

        {/* Colophon, set as an address block rather than one line: on a single
            line "Sindhudurg, Maharashtra, India" reads as three places you might
            have come from, where stacking them makes it one place, narrowing —
            which is what an address is.

            The explicit {" "} matter. JSX drops whitespace between elements that
            spans a newline, so the earlier one-line version had no real spaces in
            it at all — the icon's margin only made it look spaced, while the text
            content was "Made withlovefrom", which is what a screen reader read
            out and what you got if you copied it.

            The heart is the icon set's own, not an emoji, and hands the word
            "love" to assistive tech — an emoji would announce "red heart". */}
        <address className="mt-6 not-italic text-[11px] font-bold uppercase leading-[1.9] tracking-[0.16em] text-black">
          <span className="opacity-55">
            Made with{" "}
            <IconHeart aria-hidden className="inline-block h-3.5 w-3.5 align-[-2px] text-red" />
            <span className="sr-only">love</span>{" "}
            in
          </span>{" "}
          <br />
          <span className="text-[13px] tracking-[0.2em]">Sindhudurg</span>{" "}
          <br />
          <span className="opacity-55">Maharashtra, India</span>
        </address>
      </div>
    </footer>
  );
}
