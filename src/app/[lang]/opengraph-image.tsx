import { ImageResponse } from "next/og";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/lib/constants";

// Branded social share card (Open Graph / Twitter). Generated at request time so
// there's no binary asset to maintain; one per locale.
export const alt = "Dellys — Studio de fitness în Chișinău";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "80px",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        {/* pink accent bar */}
        <div style={{ display: "flex", width: "120px", height: "10px", borderRadius: "9999px", background: "#fd0267" }} />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: "128px", fontWeight: 700, color: "#181518", letterSpacing: "-2px" }}>
            {dict.brand}
          </div>
          <div style={{ marginTop: "20px", fontSize: "40px", color: "#554e54", maxWidth: "900px", lineHeight: 1.3 }}>
            {dict.home.hero.subtitle}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "30px" }}>
          <span style={{ color: "#de0058", fontWeight: 700 }}>{dict.home.location.city}</span>
          <span style={{ color: "#9d959c" }}>dellys.md</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
