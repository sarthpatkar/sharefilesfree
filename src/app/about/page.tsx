import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "About ShareFilesFree — who runs it and how it works",
  description:
    "ShareFilesFree sends files straight between two browsers, with no account and no size limit. Who builds it, how it stays free, and what it deliberately does not do.",
};

const LAST_UPDATED = "September 5, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "What this is",
    body: (
      <>
        <p>
          ShareFilesFree moves a file from one device to another. The sender picks a file and gets a short code; the
          receiver types it in; the two browsers open a direct connection and the file goes across. There is no
          account, no app, and no size limit.
        </p>
        <p>
          Alongside it are {" "}
          <Link href="/tools" className="link">
            free file tools
          </Link>{" "}
          — merging and splitting PDFs, conversions, compression, OCR and more. Every one of them runs on your own
          device rather than on a server.
        </p>
      </>
    ),
  },
  {
    heading: "We store nothing. That is the whole design.",
    body: (
      <>
        <p>
          Your file is never uploaded to us, because there is nowhere for it to go: this service operates no file
          storage at all. The bytes travel browser to browser, encrypted in transit. Our server introduces the two
          devices to each other and then has nothing further to do with the transfer.
        </p>
        <p>
          It also means distance stops mattering. A file sent from Tokyo to London goes from the one device to the
          other — it is not uploaded to a datacentre in a third country and downloaded back out. There is no
          data-residency question to answer, because nothing comes to rest anywhere.
        </p>
        <p>
          That decision costs something and we would rather say so than bury it: <strong>both devices have to be
          open at the same time.</strong> If you close the page, the transfer stops, because your file was waiting on
          your own machine the whole time. Nothing is held for later collection.
        </p>
        <p>
          What it buys is everything else on this page. No size limit is real rather than a marketing line, because a
          transfer that never touches our machines costs us nothing however big it is. There is no copy of your file
          to leak, to sell, or for anyone to demand.
        </p>
      </>
    ),
  },
  {
    heading: "How it stays free",
    body: (
      <>
        <p>
          Advertising, and nothing else. There is no paid tier, no subscription, and no plan to add one. We do not
          charge for size, speed, or the number of transfers, because none of those cost us anything to provide.
        </p>
        <p>
          What that means in practice: you will see a short ad before a code appears and before a transfer starts,
          and banner ads on the pages themselves. You will never see one standing between you and a tool, or between
          you and a file someone sent you.
        </p>
      </>
    ),
  },
  {
    heading: "Who runs it",
    body: (
      <>
        <p>
          ShareFilesFree is built and run by <strong>Sarth Patkar</strong>, one developer in India. No company, no
          investors, no growth team — and nobody to answer to except the people using it.
        </p>
        <p>
          Every decision here follows from one rule: <strong>the safest copy of your file is the one that was never
          made.</strong> So we don&rsquo;t make one. Your file goes straight to the person you sent it to, and
          nothing is left behind to leak, to sell, or for anyone to demand later.
        </p>
        <p>
          One address reaches it all — <span className="font-mono text-ink">contact@sharefilesfree.com</span>, or
          the{" "}
          <Link href="/contact" className="link">
            contact page
          </Link>
          , which also names the grievance officer required under India&rsquo;s IT Rules.
        </p>
      </>
    ),
  },
  {
    heading: "What we will not do",
    body: (
      <ul>
        <li>Ask you to create an account, or collect an email address.</li>
        <li>Charge you, cap your file size, or invent a paid tier.</li>
        <li>Put an ad between you and a tool, or between you and a download.</li>
        <li>Keep a copy of your file, because we have nowhere to keep one.</li>
      </ul>
    ),
  },
];

export default function AboutPage() {
  return (
    <LegalPage
      kicker="About"
      title="About ShareFilesFree"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          A file-sharing service that never receives your files, and a set of tools that never receive them either.
          Here is what that means, and what it costs.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
