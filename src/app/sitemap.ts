import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only the evergreen marketing/tool pages belong here — /download/[token] and
  // /receive?code=... are single-use links, not content worth indexing.
  return [
    { url: "https://sharefilesfree.com/", changeFrequency: "weekly", priority: 1 },
    { url: "https://sharefilesfree.com/receive", changeFrequency: "monthly", priority: 0.5 },
  ];
}
