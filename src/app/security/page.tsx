import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";
import { TOOLS } from "@/components/tools/registry";

export const metadata: Metadata = {
  title: "Is it safe? — How ShareFilesFree protects your files",
  description:
    "Your file goes straight to the person you send it to. We never store it, never see it, and tell you if something you receive could harm your device. Plus the things we honestly can't do.",
  alternates: { canonical: "/security" },
};

const LAST_UPDATED = "September 8, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Your file goes to them, not to us",
    body: (
      <>
        <p>
          When you send a file here, it travels straight from your device to theirs. It does not stop on our
          computers along the way, because we do not run anywhere for it to stop.
        </p>
        <p>
          That one fact does most of the work on this page. There is no copy of your file here to be stolen, sold,
          leaked, or handed to anyone who asks. If someone broke into our servers today, they would find no files,
          because there have never been any.
        </p>
      </>
    ),
  },
  {
    heading: "Nobody can read it on the way — not even us",
    body: (
      <>
        <p>
          Your file is scrambled the moment it leaves your device and only unscrambled on theirs. Your browser does
          this itself. It is not something we built, so it is not something we can switch off, and there is no
          setting that turns it off by accident.
        </p>
        <p>
          Sometimes two devices cannot reach each other directly, usually on office or mobile networks. The file
          then takes a longer route, still sealed the whole way. Whatever passes it along can see that two devices
          are talking. It cannot see what they are saying.
        </p>
      </>
    ),
  },
  {
    heading: "You can check the connection yourself",
    body: (
      <>
        <p>
          Your two devices have to be introduced to each other, and that introduction happens through us. So we
          give you a way to confirm it went to the right person without taking our word for anything.
        </p>
        <p>
          Once a transfer connects, both screens show a short code. When nobody is in between, both show the same
          one. Read it to each other and you have checked it yourself. Most people never will, and that is fine —
          it is there for the times it matters.
        </p>
      </>
    ),
  },
  {
    heading: "We tell you when a file could harm your device",
    body: (
      <>
        <p>
          Some files are documents and photos. Others are programs, and opening one lets it do things to your
          computer. When something arrives that can run — an app, an installer, a script, a document that carries
          hidden instructions — we say so clearly, right next to it, before you save it.
        </p>
        <p>
          We also make sure a file cannot lie about what it is. There is a long-running trick that makes a program
          appear on screen with a photo&rsquo;s name, so you open it believing it is a picture. Files arriving here
          cannot do that. What you read is what you are actually saving.
        </p>
      </>
    ),
  },
  {
    heading: "Only your code opens your transfer",
    body: (
      <>
        <p>
          Your six-digit code works once, expires on its own, and stops working the moment the right person has
          used it. Someone typing in random numbers hoping to find a live transfer gets shut out quickly.
        </p>
        <p>
          If you need longer than a few minutes, you get a link or a QR code instead. Those carry a much longer key
          inside them — far too long to guess, which is why it travels in the link rather than being read out loud.
        </p>
      </>
    ),
  },
  {
    heading: "The tools never take your file either",
    body: (
      <>
        <p>
          All {TOOLS.length} of the{" "}
          <Link href="/tools" className="link">
            free tools
          </Link>{" "}
          work inside your own browser. The contract you are merging, the ID photo you are shrinking, the
          spreadsheet you are converting — none of it is uploaded anywhere. There is no waiting for a server,
          because no server is doing the work.
        </p>
      </>
    ),
  },
  {
    heading: "No account means nothing of yours to lose",
    body: (
      <>
        <p>
          There is no sign-up here. No password of yours for anyone to steal, no email address on a list, no
          history with your name on it. We count how many files move through, and nothing about who moved them.
        </p>
      </>
    ),
  },
  {
    heading: "What we cannot do for you",
    body: (
      <>
        <p>
          <strong>We cannot check files for viruses.</strong> Not a choice we made — the file never reaches us, so
          there is nothing on our side to check. That is the flip side of everything above. Treat a file from
          someone you were not expecting the same way you would treat a surprise email attachment: if you are not
          sure who sent it, do not open it.
        </p>
        <p>
          <strong>The other person can see roughly where you are connecting from.</strong> That is what a direct
          connection means — the two devices have to find each other. They cannot see your name or your files list,
          only the general location your internet connection reports, in the same way any website you visit can.
        </p>
        <p>
          <strong>You both need to be online at the same time.</strong> Nothing sits on a server waiting to be
          collected later, because nothing is stored. If the other person cannot be there now, send a link that
          lasts up to two hours and keep your tab open.
        </p>
      </>
    ),
  },
  {
    heading: "Found a problem? Please tell us",
    body: (
      <>
        <p>
          If you find something wrong, we would much rather hear it from you first. Write to{" "}
          <a href="mailto:contact@sharefilesfree.com" className="link">
            contact@sharefilesfree.com
          </a>{" "}
          and describe what you found. A person will read it and reply.
        </p>
        <p>
          Please do not test on other people&rsquo;s transfers. Open the site in two tabs and send a file to
          yourself — that is enough to try anything described here.
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      kicker="Is it safe?"
      title="Nobody sees your file. Not even us."
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          <p>
            Plenty of sites say &ldquo;secure&rdquo; and leave it there. Here is the plain version: what happens to
            your file, what we can see, and what we cannot do for you.
          </p>
          <p>
            The last part matters as much as the rest. Nothing here asks you to simply trust us — where something
            could come down to that, we give you a way to check it instead.
          </p>
        </>
      }
      sections={SECTIONS}
      footnote={
        <>
          More on who builds this and how it stays free is on the{" "}
          <Link href="/about" className="link">
            about page
          </Link>
          . What we do and do not collect is in the{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>
          .
        </>
      }
    />
  );
}
