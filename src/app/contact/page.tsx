import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Contact & Grievance Officer — ShareFilesFree",
  description:
    "How to reach ShareFilesFree: general contact, privacy requests, and the grievance officer designated under India's IT Rules, 2021.",
};

const LAST_UPDATED = "September 5, 2026";

/**
 * One published address for everything, deliberately.
 *
 * Nothing in Rule 3(2) asks for a dedicated grievance mailbox — it asks for the
 * officer's name and contact details, and one working address is contact
 * details. Three addresses that all land in the same inbox would be theatre.
 *
 * The domain also runs a catch-all, so anything sent to support@, abuse@,
 * legal@, privacy@ or a misspelling of any of them still arrives. That matters
 * more than usual here: a complaint bouncing because someone typed "grievence@"
 * is the one delivery failure that can't be afforded.
 */
const CONTACT_EMAIL = "contact@sharefilesfree.com";

/**
 * PLACEHOLDER — replace before this page goes live.
 *
 * Rule 3(2) of the IT (Intermediary Guidelines and Digital Media Ethics Code)
 * Rules, 2021 requires an intermediary to publish the NAME and contact details
 * of a grievance officer, not just an address to write to. It applies to every
 * intermediary regardless of size, and satisfying it is a condition of the
 * safe-harbour protection in section 79 of the IT Act — which is what makes
 * running an anonymous transfer service viable at all.
 *
 * A real person's name has to go here, and for a solo operator that person is
 * the operator. That is a genuine personal cost of running this lawfully and
 * should be a deliberate decision, not something filled in by default — which
 * is why it is left blank rather than guessed at.
 */
const GRIEVANCE_OFFICER = {
  name: "[ your full name ]",
  email: CONTACT_EMAIL,
};

const SECTIONS: LegalSection[] = [
  {
    heading: "One address for everything",
    body: (
      <p>
        Anything at all — how the service works, a bug, a suggestion, a privacy request, or a formal complaint:{" "}
        <span className="font-mono text-ink">{CONTACT_EMAIL}</span>. It is one person reading these, so a reply may
        take a few days.
      </p>
    ),
  },
  {
    heading: "Privacy and data requests",
    body: (
      <>
        <p>
          Same address, and see the{" "}
          <Link href="/privacy" className="link">
            privacy policy
          </Link>{" "}
          for what is and isn&rsquo;t held.
        </p>
        <p>
          Worth setting expectations honestly: there is very little to request. We hold no account, no email address,
          no file, and no transfer history — the only personal data that touches our servers is your IP address, kept
          in memory for a few minutes to enforce rate limits, and never written to a database.
        </p>
      </>
    ),
  },
  {
    heading: "Grievance Officer",
    body: (
      <>
        <p>
          Designated under Rule 3(2) of the Information Technology (Intermediary Guidelines and Digital Media Ethics
          Code) Rules, 2021.
        </p>
        <ul>
          <li>
            <strong>Name:</strong> {GRIEVANCE_OFFICER.name}
          </li>
          <li>
            <strong>Email:</strong> <span className="font-mono text-ink">{GRIEVANCE_OFFICER.email}</span>
          </li>
          <li>
            <strong>Address:</strong> available on written request to the address above.
          </li>
        </ul>
        <p>
          Complaints are acknowledged within 24 hours and resolved within 15 days, as the Rules require. Please
          include enough detail to identify what you are complaining about.
        </p>
      </>
    ),
  },
  {
    heading: "Reporting misuse",
    body: (
      <>
        <p>
          We want to be straightforward about what we can and cannot do here, because it is unusual.
        </p>
        <p>
          ShareFilesFree does not host anything. Files pass directly between two people&rsquo;s browsers and are never
          received, stored, or readable by us, so there is no file on our side to inspect, remove, or hand over —
          not as a policy, but as a fact of how it is built. If you have been sent something unlawful, the material
          is on the sender&rsquo;s device and yours, and law enforcement is the right route.
        </p>
        <p>
          What we can act on is abuse of the service itself — patterns of traffic, attempts to break the pairing
          system, or anything that suggests the site is being used as infrastructure for something else. Write to the
          grievance officer above, and we will respond to any lawful order from a court or authorised government
          agency.
        </p>
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <LegalPage
      kicker="Contact"
      title="Contact"
      lastUpdated={LAST_UPDATED}
      intro={
        <p>
          One person builds and runs this. Here is how to reach them, and who to write to formally when that is what
          is needed.
        </p>
      }
      sections={SECTIONS}
      footnote="This address must be live and read before the site is promoted — an unmonitored grievance contact is the same as not having one."
    />
  );
}
