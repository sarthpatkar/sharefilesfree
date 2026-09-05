import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ToolsShowcase } from "@/components/landing/ToolsShowcase";
import { WhyFree } from "@/components/landing/WhyFree";
import { Faq } from "@/components/landing/Faq";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { FAQ_ITEMS } from "@/components/landing/faqData";
import { AdSlot } from "@/components/ads/AdSlot";

/**
 * FAQPage structured data, generated from the same array the accordion
 * renders — this is what earns the expandable FAQ rows in Google results,
 * which is meaningful free traffic for a product with no ad budget.
 */
function FaqJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

/**
 * Organization data, with a real contact point.
 *
 * Two audiences read this. Search engines use it for the knowledge panel and
 * sitelinks; ad-network and marketplace reviewers use it as one more signal
 * that a site is a real operation with a way to reach someone rather than a
 * thin content farm. Both want the same thing, which is why one block serves
 * both — and why the contact address in it has to be the live one.
 */
function OrgJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShareFilesFree",
    url: "https://sharefilesfree.com",
    description:
      "Free peer-to-peer file transfer with no account and no size limit, plus browser-based file tools. Files pass directly between devices and are never stored.",
    contactPoint: {
      "@type": "ContactPoint",
      email: "contact@sharefilesfree.com",
      contactType: "customer support",
      availableLanguage: ["English"],
    },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

function AppJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ShareFilesFree",
    url: "https://sharefilesfree.com",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    description:
      "Send a file of any size to any device with a short code. No account, no app, and no size limit at all — files pass directly between browsers and are never stored. Plus 19 free tools that run on your own device.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export default function Page() {
  return (
    <>
      <FaqJsonLd />
      <AppJsonLd />
      <OrgJsonLd />
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <ToolsShowcase />
        {/* Below the fold by construction — nothing above it competes with the
            hero for the first paint. */}
        <AdSlot slotId="home-mid" format="leaderboard" className="px-5 py-10 sm:px-8" />
        <WhyFree />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
