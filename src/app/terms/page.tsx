import type { Metadata } from "next";
import Link from "next/link";
import { IconArrowLeft } from "@/components/icons";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Terms of Use — ShareFilesFree",
  description: "The terms for using ShareFilesFree.",
};

const LAST_UPDATED = "August 29, 2026";

export default function TermsPage() {
  return (
    <>
      <SiteHeader variant="solid" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <Link href="/" className="group inline-flex items-center gap-1.5 text-sm text-accent transition-colors hover:text-accent-hover">
        <IconArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" /> Back to ShareFilesFree
      </Link>
      <h1 className="font-display text-3xl font-medium tracking-tight text-foreground">Terms of Use</h1>
      <p className="text-sm text-muted">Last updated: {LAST_UPDATED}</p>

      <div className="flex flex-col gap-6 text-sm leading-relaxed text-foreground">
        <p>By using ShareFilesFree, you agree to these terms. If you don’t agree, please don’t use the service.</p>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">The service</h2>
          <p>
            ShareFilesFree lets you transfer files between devices without creating an account, either
            directly (peer-to-peer) or via a temporary shared link. It’s provided free of charge and
            supported by advertising.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
          <p>You agree not to use ShareFilesFree to transfer or share:</p>
          <ul className="list-disc pl-6">
            <li>malware, viruses, or anything designed to damage or gain unauthorized access to a system;</li>
            <li>content that is illegal to possess or distribute in your jurisdiction;</li>
            <li>content that infringes someone else’s intellectual property or privacy rights;</li>
            <li>anything used to harass, defraud, or impersonate another person.</li>
          </ul>
          <p>
            Every shared link includes a “Report this file” option that immediately disables it. We may
            also disable links or block usage patterns we reasonably believe violate these terms, without
            prior notice — this is a small, automated service without a moderation team, so enforcement is
            necessarily limited and best-effort.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">No warranty</h2>
          <p>
            ShareFilesFree is provided “as is,” without warranties of any kind. We don’t guarantee
            uninterrupted availability, that transfers will always succeed, or that files will be
            retained for any specific duration beyond what’s stated in the product itself. Don’t rely on
            it as your only copy of anything important.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Limitation of liability</h2>
          <p>
            To the fullest extent permitted by law, ShareFilesFree and its operator are not liable for any
            indirect, incidental, or consequential damages arising from your use of the service, including
            loss of data or files.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Changes</h2>
          <p>
            We may change these terms or the service itself (including discontinuing it) at any time.
            Meaningful changes to these terms will update the “Last updated” date above.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>
            Questions, or to report abuse beyond the in-product report link:{" "}
            <span className="font-mono">abuse@sharefilesfree.com</span>.
          </p>
        </section>

        <p className="text-xs text-muted">
          This is a general-purpose starting template, not a substitute for advice from a qualified
          lawyer — worth a proper legal review once the service carries real traffic or revenue.
        </p>
      </div>
      </main>
      <SiteFooter />
    </>
  );
}
