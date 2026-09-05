import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy — ShareFilesFree",
  description: "How ShareFilesFree handles your files and data.",
};

const LAST_UPDATED = "August 29, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "No accounts, no personal profiles",
    body: (
      <p>
        You never create an account, log in, or give us your name or email to use ShareFilesFree. We have no user
        database, no login credentials to leak, and nothing tying a transfer to your identity beyond what&rsquo;s
        described below.
      </p>
    ),
  },
  {
    heading: "Direct (peer-to-peer) transfers",
    body: (
      <>
        <p>
          When both the sender and receiver are online at the same time, your file travels directly between your
          browsers using WebRTC, encrypted in transit. It never touches our servers or gets stored anywhere. Our
          signaling server only relays connection setup information (a short room code and technical handshake data)
          so your two browsers can find each other — it never sees the file itself.
        </p>
        <p>
          If a direct connection can&rsquo;t be established (for example, due to a restrictive network), the transfer
          relays through Cloudflare&rsquo;s TURN service instead. That data passes through Cloudflare&rsquo;s
          infrastructure in transit but is not stored or inspected by us.
        </p>
      </>
    ),
  },
  {
    heading: "The one thing we log",
    body: (
      <p>
        <>
        <p>
          One thing: your IP address, held in server memory and counted against rate limits — how many codes one
          connection has asked for in the last minute, and how many wrong codes it has guessed. That is what stops
          one person flooding the service for everyone else.
        </p>
        <p>
          It is never written to a database, never sold, and never used to build a profile. Entries are swept
          automatically once their window has passed, so nothing survives more than about an hour, and a restart of
          the server erases all of it.
        </p>
        <p>
          An IP address counts as personal data under India&rsquo;s Digital Personal Data Protection Act, so we treat
          it as such and name it here rather than calling it &ldquo;technical data&rdquo;. It is also the only
          personal data we have. There are no accounts, no email addresses, no files, no filenames and no transfer
          history — not because we delete them, but because the way this service is built means they never exist.
        </p>
        </>
      </p>
    ),
  },
  {
    heading: "Advertising & analytics",
    body: (
      <>
        <p>
          ShareFilesFree is free because it is supported by advertising, not because we charge you in some other way.
          Ads are the only revenue this site has.
        </p>
        <p>
          This is the part of the page where the most data changes hands, so it is worth being direct about it. When
          ads are switched on, our ad partner (Google AdSense) sets cookies and similar identifiers in your browser
          to choose and measure the ads you see. That processing is theirs, it can follow you between sites, and it
          is a materially bigger data story than anything else described on this page. See{" "}
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
            Google&rsquo;s own policy
          </a>{" "}
          for what they do with it.
        </p>
        <p>
          What ads never get is your file, its name, its size, or who you sent it to. None of that reaches our
          servers, so there is nothing for us to pass on even if we wanted to.
        </p>
        <p>
          Any analytics we add will be chosen to avoid tracking cookies and individual profiling where possible, and
          this page will be updated before it appears rather than after.
        </p>
      </>
    ),
  },
  {
    heading: "Wherever you're reading this from",
    body: (
      <>
        <p>
          This service is operated from India and used from everywhere. Two different sets of rules follow from that,
          and they apply at the same time.
        </p>
        <p>
          India&rsquo;s Digital Personal Data Protection Act applies to us because we are here. Your rights under it,
          and the grievance route required by India&rsquo;s IT Rules, are open to you whatever country you are in —
          see the{" "}
          <Link href="/contact" className="link">
            contact page
          </Link>
          .
        </p>
        <p>
          If you are in the UK or the European Economic Area, the GDPR applies to us in respect of your data. Our
          lawful basis for handling the one thing we handle — your IP address, against rate limits — is legitimate
          interest: keeping the service working for everyone by preventing abuse. You have the right to ask what we
          hold about you, to have it erased, and to object. In practice the answer will be short, because after an
          hour there is nothing left to hold.
        </p>
        <p>
          One commitment while we are on the subject: advertising in the EEA and UK requires a proper consent
          mechanism, not a notice bar. No ads run anywhere on this site today. They will not be switched on for
          visitors in those regions until that mechanism is in place.
        </p>
      </>
    ),
  },
  {
    heading: "Children’s privacy",
    body: <p>ShareFilesFree isn&rsquo;t directed at children, and we don&rsquo;t knowingly collect data from them.</p>,
  },
  {
    heading: "Changes to this policy",
    body: (
      <p>
        We may update this policy as the service evolves. Meaningful changes will update the &ldquo;Last
        updated&rdquo; date above.
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        Questions about this policy or a data request:{" "}
        <span className="font-mono text-ink">contact@sharefilesfree.com</span>. For a formal complaint, the{" "}
        <Link href="/contact" className="link">
          grievance officer
        </Link>{" "}
        is named on the contact page, as India&rsquo;s IT Rules require.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Privacy"
      title="Privacy Policy"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          ShareFilesFree (&ldquo;we&rdquo;, &ldquo;the service&rdquo;) is built around a simple idea: you
          shouldn&rsquo;t need an account to send a file. This policy explains what little data we do handle, and why.
        </p>
      }
      sections={SECTIONS}
    />
  );
}
