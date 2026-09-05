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
          ShareFilesFree is built and operated by one independent developer in India. It is not a company, has taken
          no investment, and answers to nobody but the people using it.
        </p>
        <p>
          For anything at all —{" "}
          <Link href="/contact" className="link">
            get in touch
          </Link>
          .
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
