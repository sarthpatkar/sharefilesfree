import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // No point indexing internal API routes.
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://sharefilesfree.com/sitemap.xml",
  };
}
