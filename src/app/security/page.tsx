import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Security — what protects you, and what doesn't — ShareFilesFree",
  description:
    "How ShareFilesFree keeps a file transfer safe: nothing stored, encrypted browser to browser, filenames that cannot lie about themselves. Including the things it deliberately cannot do.",
  alternates: { canonical: "/security" },
};

const LAST_UPDATED = "September 7, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "Your file never reaches us, so there is nothing here to steal",
    body: (
      <>
        <p>
          Most services that promise security are describing how well they guard the copy of your file they are
          holding. We are not holding one. The bytes go from your device to theirs over a direct connection, and this
          service runs no file storage at all — not a bucket with a short retention window, none.
        </p>
        <p>
          That is worth being precise about, because it changes what a breach here could even mean. If someone
          compromised our server tomorrow, there would be no files on it. There is no archive to leak, nothing to sell,
          and nothing for anyone to compel us to hand over. The strongest security property on this page is the one we
          got by not building something.
        </p>
      </>
    ),
  },
  {
    heading: "It is encrypted the whole way — and not because we say so",
    body: (
      <>
        <p>
          The connection between the two browsers is encrypted by the browsers themselves, using the same mechanism
          video calls use. It is not a feature we implemented and could get wrong: a browser will not open an
          unencrypted channel of this kind at all. There is no setting for it and no way for us to turn it off.
        </p>
        <p>
          When a direct connection cannot be made — strict office or mobile networks, roughly a fifth of the time — the
          data is bounced through a relay. The relay moves sealed traffic it cannot read. It sees that two devices are
          talking, not what they are saying.
        </p>
      </>
    ),
  },
  {
    heading: "A file cannot lie to you about what it is",
    body: (
      <>
        <p>
          There is an old trick where a file is named so that it <em>displays</em> backwards from a certain point. A
          program called <code>invoice&#8230;exe</code> can be made to appear on screen as <code>invoice&#8230;png</code>,
          in this site, in your downloads list, and in your file manager. You think you saved a picture and you run a
          program. It has been used in real attacks for over a decade.
        </p>
        <p>
          Filenames arriving here are stripped of the characters that make that possible, along with anything that
          could steer a file out of the folder you chose. If an arriving file is the kind that can run — an installer,
          a script, a document with macros — the page says so plainly next to it, before you save it.
        </p>
        <p>
          A received file is also handed to your browser in a form that cannot execute as a web page on this site.
          That closes a route where someone sends you a file that quietly becomes a convincing fake of this page, on
          the real address, with the real padlock.
        </p>
      </>
    ),
  },
  {
    heading: "The short code is small on purpose, so guessing is made expensive",
    body: (
      <>
        <p>
          A six-digit code is short because it has to be readable down a phone. That means it is guessable in
          principle, so the guessing is what gets restricted: wrong codes are rate-limited per network and in total,
          codes expire, and a code that has been claimed cannot be claimed again.
        </p>
        <p>
          A code that lives longer than the ten-minute default is a different problem, and gets a different answer. It
          carries a 128-bit secret alongside it — travelling inside the link or QR code you share, never read aloud —
          which is not guessable by any practical means. A wrong secret is answered exactly like a wrong code, so
          nobody can learn they found a real transfer and only need the key.
        </p>
      </>
    ),
  },
  {
    heading: "This page can only run its own code",
    body: (
      <>
        <p>
          The site tells your browser to refuse any script that did not come from this domain. If someone found a way
          to inject something into this page, it could not fetch its payload from elsewhere, could not send what it
          found anywhere but back here, and could not put this site inside a frame on another one.
        </p>
        <p>
          That rule is only as good as the code we do load, so the tools were changed to stop borrowing any. Text
          recognition previously downloaded its engine from a public code-hosting network the moment you used it —
          working code, arriving from a third party, into a page holding your documents. It is served from here now.
        </p>
        <p>
          The site is reachable over an encrypted connection only, and browsers are told to remember that, so a
          network you do not trust cannot quietly downgrade you to an unencrypted one.
        </p>
      </>
    ),
  },
  {
    heading: "The tools never upload anything either",
    body: (
      <>
        <p>
          Every one of the{" "}
          <Link href="/tools" className="link">
            free tools
          </Link>{" "}
          — merging, splitting, compressing, converting, recognising text — runs on your own machine. The contract you
          are merging, the passport photo you are compressing, and the spreadsheet you are converting do not travel
          anywhere. There is no queue on a server because there is no server doing the work.
        </p>
      </>
    ),
  },
  {
    heading: "No account means nothing about you to lose",
    body: (
      <>
        <p>
          There is no sign-up, so there is no password of yours here to leak, no email address on a list, and no
          history with your name attached. We keep counts — how many transfers, how many bytes — and nothing that
          describes a person. What is never collected cannot go missing.
        </p>
      </>
    ),
  },
  {
    heading: "What this cannot do, stated plainly",
    body: (
      <>
        <p>
          <strong>We cannot check a file for viruses.</strong> Not &ldquo;we have chosen not to&rdquo; — we cannot. The file goes
          straight from their device to yours and is never present on anything we run, so there is nothing for us to
          scan even in principle. That is the direct cost of the privacy on the rest of this page, and it is the
          honest reason to treat a file from someone you were not expecting exactly as you would treat an unexpected
          email attachment.
        </p>
        <p>
          <strong>A direct connection means each side can see the other&rsquo;s network address.</strong> That is what
          &ldquo;direct&rdquo; means — the two devices must know where to find each other. Anyone you send a file to could, with
          effort, learn roughly where you are connecting from, as you could of them. When the transfer is relayed
          instead, the relay&rsquo;s address stands in place of yours.
        </p>
        <p>
          <strong>Our server introduces the two devices, and you are trusting it to introduce them honestly.</strong>{" "}
          The encryption is between the two browsers, but the details they use to recognise each other pass through
          us. A service that chose to tamper with that step could place itself in the middle of a transfer. We do not,
          and the design keeps us out of the file itself — but a promise is what that is, and you should know which
          parts of this page are promises and which are structural. Every other item here is structural. This one is
          not, and we would rather say so than let it read as though it were.
        </p>
        <p>
          <strong>Both devices have to be open at the same time.</strong> Nothing waits on a server for later
          collection, because there is no server holding it.
        </p>
      </>
    ),
  },
  {
    heading: "Found something? Tell us",
    body: (
      <>
        <p>
          If you have found a security problem, we want to hear about it before anyone else does. Write to{" "}
          <a href="mailto:contact@sharefilesfree.com" className="link">
            contact@sharefilesfree.com
          </a>{" "}
          with enough detail to reproduce it. You will get a reply from a person, and you are welcome to say publicly
          that you reported it once it is fixed.
        </p>
        <p>
          Please do not test against other people&rsquo;s transfers. If you need a target, run both ends yourself —
          two tabs is enough to exercise everything described on this page.
        </p>
      </>
    ),
  },
];

export default function SecurityPage() {
  return (
    <LegalPage
      kicker="Security"
      title="What actually protects you here."
      lastUpdated={LAST_UPDATED}
      intro={
        <>
          <p>
            Everyone in this business writes &ldquo;bank-level encryption&rdquo; and moves on. This page is the
            specific version: what protects a file moving through here, how it works, and — at the bottom, not buried
            — the things this design cannot do for you.
          </p>
          <p>
            The distinction that matters throughout is between a property and a promise. Most of what follows is
            structural: true because of how the thing is built, and it would take a rewrite rather than a change of
            heart to make it untrue. Where something rests on us behaving well instead, it is marked as such.
          </p>
        </>
      }
      sections={SECTIONS}
      footnote={
        <>
          Want the shorter version of who we are and why this is free?{" "}
          <Link href="/about" className="link">
            Read the about page
          </Link>
          , or the{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>{" "}
          for exactly what is and isn&rsquo;t collected.
        </>
      }
    />
  );
}
