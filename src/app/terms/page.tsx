import type { Metadata } from "next";
import Link from "next/link";
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
        ShareFilesFree lets you transfer files directly between two devices without creating an account. Files pass
        browser to browser and are never stored by us. It&rsquo;s provided free of charge and supported by
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
          We hold no copy of anything you send, so we cannot inspect, retrieve, or remove a file after the fact —
          there is nothing on our side to remove. What we can do is block usage patterns we reasonably believe
          violate these terms, without prior notice. This is a small, automated service without a moderation team,
          and responsibility for what you transfer rests entirely with you.
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
    heading: "Which law applies",
    body: (
      <>
        <p>
          ShareFilesFree is operated from India, and these terms are governed by Indian law. Any dispute arising from
          them is subject to the exclusive jurisdiction of the competent courts in Maharashtra, India.
        </p>
        <p>
          That holds wherever you are using the service from. It doesn&rsquo;t take away rights your own country
          gives you that can&rsquo;t be contracted out of — consumer protections in particular usually survive a
          clause like this one — and it isn&rsquo;t meant to. It exists so that if something ever does go wrong,
          both of us already know where it gets sorted out.
        </p>
      </>
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
      <>
        <p>
          Anything at all: <span className="font-mono text-ink">contact@sharefilesfree.com</span>.
        </p>
        <p>
          For a formal complaint, a grievance officer is named on the{" "}
          <Link href="/contact" className="link">
            contact page
          </Link>{" "}
          as required by Rule 3(2) of India&rsquo;s IT (Intermediary Guidelines and Digital Media Ethics Code) Rules,
          2021. Complaints are acknowledged within 24 hours and resolved within 15 days.
        </p>
      </>
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
