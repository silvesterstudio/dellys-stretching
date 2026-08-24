import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, auth-gated areas hold no SEO value and shouldn't be crawled.
      // Romanian now sits at the bare path; Russian keeps its /ru prefix.
      disallow: ["/admin", "/dashboard", "/ru/admin", "/ru/dashboard"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
