import type { MetadataRoute } from "next";
import { LOCALES, SITE_URL } from "@/lib/constants";

// Public, indexable routes per locale. Admin/dashboard/login are auth-gated and
// intentionally excluded (see robots.ts).
// "" = Program (booking) page · "/landing" = marketing landing.
const PUBLIC_PATHS = ["", "/landing", "/memberships"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      changeFrequency: path === "" ? ("daily" as const) : ("weekly" as const),
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  );
}
