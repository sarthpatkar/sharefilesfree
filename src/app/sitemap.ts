import type { MetadataRoute } from "next";
import { TOOLS } from "@/components/tools/registry";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only the evergreen marketing/tool pages belong here.
  return [
    { url: "https://sharefilesfree.com/", changeFrequency: "weekly", priority: 1 },
    { url: "https://sharefilesfree.com/tools", changeFrequency: "weekly", priority: 0.9 },
    ...TOOLS.map((tool) => ({
      url: `https://sharefilesfree.com/tools/${tool.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: "https://sharefilesfree.com/receive", changeFrequency: "monthly", priority: 0.5 },
    { url: "https://sharefilesfree.com/privacy", changeFrequency: "yearly", priority: 0.2 },
    { url: "https://sharefilesfree.com/terms", changeFrequency: "yearly", priority: 0.2 },
  ];
}
