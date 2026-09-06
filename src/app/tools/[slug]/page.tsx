import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/components/tools/registry";
import { TOOL_CONTENT } from "@/components/tools/toolContent";
import { ToolPageClient } from "@/components/tools/ToolPageClient";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export function generateStaticParams() {
  return TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) return {};
  return {
    title: tool.seoTitle,
    description: tool.description,
    alternates: { canonical: `/tools/${tool.slug}` },
    openGraph: { title: tool.seoTitle, description: tool.description, url: `/tools/${tool.slug}` },
    twitter: { card: "summary_large_image", title: tool.seoTitle, description: tool.description },
  };
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) notFound();

  // SoftwareApplication markup per tool page — these are the pages meant to
  // rank for "free merge pdf" style queries, so each one describes itself.
  const json = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.title,
    url: `https://sharefilesfree.com/tools/${tool.slug}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    description: tool.description,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  };

  // Breadcrumb trail, matching the Home / Tools / [tool] path a visitor
  // actually clicks through — this is what earns the breadcrumb trail shown
  // under the result in search, in place of the raw URL.
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://sharefilesfree.com/" },
      { "@type": "ListItem", position: 2, name: "Tools", item: "https://sharefilesfree.com/tools" },
      { "@type": "ListItem", position: 3, name: tool.title, item: `https://sharefilesfree.com/tools/${tool.slug}` },
    ],
  };

  // FAQ and step markup, so the questions can surface directly in search results
  // rather than only inside the page. Emitted only where real content exists —
  // marking up an empty page would be the exact thing Google penalises.
  const content = TOOL_CONTENT[slug];
  const graph: object[] = [json, breadcrumbs];
  if (content) {
    graph.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: content.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: { "@type": "Answer", text: faq.a },
      })),
    });
    graph.push({
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: `How to ${tool.title.toLowerCase()}`,
      description: tool.description,
      step: content.steps.map((step, i) => ({ "@type": "HowToStep", position: i + 1, text: step })),
    });
  }

  return (
    <>
      {graph.map((node, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }} />
      ))}
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ToolPageClient slug={slug} />
      </main>
      <SiteFooter />
    </>
  );
}
