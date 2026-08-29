import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // No point indexing a one-time shared-link page or internal API routes.
        disallow: ["/download/", "/api/"],
      },
    ],
    sitemap: "https://sharefilesfree.com/sitemap.xml",
  };
}
