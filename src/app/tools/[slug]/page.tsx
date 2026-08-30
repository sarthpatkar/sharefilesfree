import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/components/tools/registry";
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <ToolPageClient slug={slug} />
      </main>
      <SiteFooter />
    </>
  );
}
