import type { Metadata } from "next";
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
    heading: "“Share a link” transfers",
    body: (
      <>
        <p>
          If you choose to generate a shareable link instead (for a receiver who isn&rsquo;t online right now), your
          file is uploaded once to Cloudflare R2 storage. It is:
        </p>
        <ul>
          <li>given an unguessable, randomly generated link — we don&rsquo;t index it or make it discoverable;</li>
          <li>
            automatically deleted after the expiry you choose (up to 7 days), or immediately if you enable
            &ldquo;delete after first download&rdquo;;
          </li>
          <li>
            optionally protected by a password you set, which we store only as a one-way cryptographic hash — we
            cannot recover it, and neither can anyone who gains access to our storage;
          </li>
          <li>
            deleted immediately, for everyone, if someone uses the &ldquo;Report this file&rdquo; link on the
            download page.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: "What we log",
    body: (
      <p>
        To prevent abuse (e.g. someone trying to flood the service with uploads), we temporarily track IP addresses
        against simple rate limits in server memory. This data is not persisted to a database, not sold, and not used
        for advertising profiling. If a file is reported as abusive, we may retain a basic record of that report
        (filename and reporting IP) to review patterns of misuse.
      </p>
    ),
  },
  {
    heading: "Advertising & analytics",
    body: (
      <p>
        ShareFilesFree is free to use and supported by advertising rather than charging users directly. When ads are
        active, our ad partner (Google AdSense) may use cookies or similar technology to serve and measure ads — see{" "}
        <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer">
          Google&rsquo;s own policy
        </a>{" "}
        on this. Any analytics we use are chosen to avoid tracking cookies and individual profiling where possible.
      </p>
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
        <span className="font-mono text-ink">privacy@sharefilesfree.com</span>.
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
