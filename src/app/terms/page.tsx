import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use — ShareFilesFree",
  description: "The terms for using ShareFilesFree.",
};

const LAST_UPDATED = "August 29, 2026";

const SECTIONS: LegalSection[] = [
  {
    heading: "The service",
    body: (
      <p>
        ShareFilesFree lets you transfer files between devices without creating an account, either directly
        (peer-to-peer) or via a temporary shared link. It&rsquo;s provided free of charge and supported by
        advertising.
      </p>
    ),
  },
  {
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to use ShareFilesFree to transfer or share:</p>
        <ul>
          <li>malware, viruses, or anything designed to damage or gain unauthorized access to a system;</li>
          <li>content that is illegal to possess or distribute in your jurisdiction;</li>
          <li>content that infringes someone else&rsquo;s intellectual property or privacy rights;</li>
          <li>anything used to harass, defraud, or impersonate another person.</li>
        </ul>
        <p>
          Every shared link includes a &ldquo;Report this file&rdquo; option that immediately disables it. We may also
          disable links or block usage patterns we reasonably believe violate these terms, without prior notice — this
          is a small, automated service without a moderation team, so enforcement is necessarily limited and
          best-effort.
        </p>
      </>
    ),
  },
  {
    heading: "No warranty",
    body: (
      <p>
        ShareFilesFree is provided &ldquo;as is,&rdquo; without warranties of any kind. We don&rsquo;t guarantee
        uninterrupted availability, that transfers will always succeed, or that files will be retained for any
        specific duration beyond what&rsquo;s stated in the product itself. Don&rsquo;t rely on it as your only copy
        of anything important.
      </p>
    ),
  },
  {
    heading: "Limitation of liability",
    body: (
      <p>
        To the fullest extent permitted by law, ShareFilesFree and its operator are not liable for any indirect,
        incidental, or consequential damages arising from your use of the service, including loss of data or files.
      </p>
    ),
  },
  {
    heading: "Changes",
    body: (
      <p>
        We may change these terms or the service itself (including discontinuing it) at any time. Meaningful changes
        to these terms will update the &ldquo;Last updated&rdquo; date above.
      </p>
    ),
  },
  {
    heading: "Contact",
    body: (
      <p>
        Questions, or to report abuse beyond the in-product report link:{" "}
        <span className="font-mono text-ink">abuse@sharefilesfree.com</span>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal"
      title="Terms of Use"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          By using ShareFilesFree, you agree to these terms. If you don&rsquo;t agree, please don&rsquo;t use the
          service.
        </p>
      }
      sections={SECTIONS}
      footnote="This is a general-purpose starting template, not a substitute for advice from a qualified lawyer — worth a proper legal review once the service carries real traffic or revenue."
    />
  );
}
