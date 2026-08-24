import type { MetadataRoute } from "next";
import { LOCALES, SITE_URL } from "@/lib/constants";
import { localePath, languageAlternates } from "@/i18n/config";

// Public, indexable routes per locale. Admin/dashboard/login are auth-gated and
// intentionally excluded (see robots.ts).
// "" = studio chooser (site root) · "/program" = the booking schedule for the
// chosen studio · "/landing" = marketing landing.
const PUBLIC_PATHS = ["/", "/program", "/landing", "/memberships"] as const;

// Romanian sits at the bare path and Russian under /ru — the same shape the
// middleware serves, so nothing here points at a URL that redirects.
export default function sitemap(): MetadataRoute.Sitemap {
  return LOCALES.flatMap((locale) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}${localePath(locale, path)}`,
      changeFrequency: path === "/" ? ("daily" as const) : ("weekly" as const),
      priority: path === "/" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          Object.entries(languageAlternates(path)).map(([l, p]) => [l, `${SITE_URL}${p}`]),
        ),
      },
    })),
  );
}
