import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — ShareFilesFree",
  description: "How ShareFilesFree handles your files and data.",
};

const LAST_UPDATED = "August 29, 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <Link href="/" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">
        ← Back to ShareFilesFree
      </Link>
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-sm text-black/50 dark:text-white/50">Last updated: {LAST_UPDATED}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-black/80 dark:text-white/80">
        <p>
          ShareFilesFree (“we”, “the service”) is built around a simple idea: you shouldn’t need an
          account to send a file. This policy explains what little data we do handle, and why.
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">No accounts, no personal profiles</h2>
          <p>
            You never create an account, log in, or give us your name or email to use ShareFilesFree.
            We have no user database, no login credentials to leak, and nothing tying a transfer to your
            identity beyond what’s described below.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">Direct (peer-to-peer) transfers</h2>
          <p>
            When both the sender and receiver are online at the same time, your file travels directly
            between your browsers using WebRTC, encrypted in transit. It never touches our servers or
            gets stored anywhere. Our signaling server only relays connection setup information (a short
            room code and technical handshake data) so your two browsers can find each other — it never
            sees the file itself.
          </p>
          <p>
            If a direct connection can’t be established (for example, due to a restrictive network), the
            transfer relays through Cloudflare’s TURN service instead. That data passes through
            Cloudflare’s infrastructure in transit but is not stored or inspected by us.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">“Share a link” transfers</h2>
          <p>
            If you choose to generate a shareable link instead (for a receiver who isn’t online right
            now), your file is uploaded once to Cloudflare R2 storage. It is:
          </p>
          <ul className="list-disc pl-6">
            <li>given an unguessable, randomly generated link — we don’t index it or make it discoverable;</li>
            <li>automatically deleted after the expiry you choose (up to 7 days), or immediately if you enable “delete after first download”;</li>
            <li>optionally protected by a password you set, which we store only as a one-way cryptographic hash — we cannot recover it, and neither can anyone who gains access to our storage;</li>
            <li>deleted immediately, for everyone, if someone uses the “Report this file” link on the download page.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">What we log</h2>
          <p>
            To prevent abuse (e.g. someone trying to flood the service with uploads), we temporarily
            track IP addresses against simple rate limits in server memory. This data is not persisted
            to a database, not sold, and not used for advertising profiling. If a file is reported as
            abusive, we may retain a basic record of that report (filename and reporting IP) to review
            patterns of misuse.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">Advertising & analytics</h2>
          <p>
            ShareFilesFree is free to use and supported by advertising rather than charging users
            directly. When ads are active, our ad partner (Google AdSense) may use cookies or similar
            technology to serve and measure ads — see{" "}
            <a
              href="https://policies.google.com/technologies/partner-sites"
              className="text-emerald-600 hover:underline dark:text-emerald-400"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google’s own policy
            </a>{" "}
            on this. Any analytics we use are chosen to avoid tracking cookies and individual profiling
            where possible.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">Children’s privacy</h2>
          <p>ShareFilesFree isn’t directed at children, and we don’t knowingly collect data from them.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">Changes to this policy</h2>
          <p>
            We may update this policy as the service evolves. Meaningful changes will update the “Last
            updated” date above.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-white">Contact</h2>
          <p>
            Questions about this policy or a data request: <span className="font-mono">privacy@sharefilesfree.com</span>.
          </p>
        </section>
      </div>
    </main>
  );
}
