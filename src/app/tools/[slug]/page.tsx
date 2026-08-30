import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TOOLS, getToolBySlug } from "@/components/tools/registry";
import { ToolPageClient } from "@/components/tools/ToolPageClient";

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
  if (!getToolBySlug(slug)) notFound();
  return <ToolPageClient slug={slug} />;
}
