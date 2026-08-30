import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ToolsShowcase } from "@/components/landing/ToolsShowcase";
import { WhyFree } from "@/components/landing/WhyFree";
import { Faq } from "@/components/landing/Faq";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { FAQ_ITEMS } from "@/components/landing/faqData";

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

function AppJsonLd() {
  const json = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ShareFilesFree",
    url: "https://sharefilesfree.com",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    description:
      "Send any file to any device with a six-digit code. No account, no app, no size limit. Plus 19 free tools to fix your file before it goes.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}

export default function Page() {
  return (
    <>
      <FaqJsonLd />
      <AppJsonLd />
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Hero />
        <HowItWorks />
        <ToolsShowcase />
        <WhyFree />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
