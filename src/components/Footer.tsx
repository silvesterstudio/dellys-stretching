import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC } from "@/lib/dc";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoMark } from "./LogoMark";

export function Footer({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const f = dict.home.footer;
  const base = `/${lang}`;
  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: ".13em",
    textTransform: "uppercase",
    color: DC.faint,
  };
  const link: React.CSSProperties = {
    fontSize: 14.5,
    color: "#4A4954",
    textDecoration: "none",
  };
  const nav = [
    { href: `${base}#discipline`, label: dict.nav.disciplines },
    { href: `${base}#program`, label: dict.nav.schedule },
    { href: `${base}#preturi`, label: dict.nav.prices },
    { href: `${base}#faq`, label: dict.nav.faq },
  ];

  return (
    <footer style={{ borderTop: `1px solid ${DC.border2}`, fontFamily: DC.sans }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px 40px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: 40,
          }}
        >
          <div style={{ maxWidth: 280 }}>
            <LogoMark height={40} />
            <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6, color: DC.muted }}>
              {f.tagline}
            </p>
            <div style={{ marginTop: 20 }}>
              <LanguageSwitcher current={lang} />
            </div>
          </div>

          <div>
            <div style={label}>{f.studio}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
              {nav.map((n) => (
                <a key={n.href} href={n.href} style={link}>
                  {n.label}
                </a>
              ))}
            </div>
          </div>

          <div>
            <div style={label}>{f.contact}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginTop: 16 }}>
              <span style={{ fontSize: 14.5, color: "#4A4954" }}>{f.addr}</span>
              <a href={`tel:${f.phone.replace(/\s/g, "")}`} style={link}>
                {f.phone}
              </a>
              <a href={`mailto:${f.email}`} style={link}>
                {f.email}
              </a>
              <a href="https://facebook.com/Caracas.md" target="_blank" rel="noopener noreferrer" style={link}>
                Facebook
              </a>
              <a href="https://instagram.com/caracas.md" target="_blank" rel="noopener noreferrer" style={link}>
                Instagram
              </a>
            </div>
          </div>

          <div>
            <div style={label}>{f.hours}</div>
            <div style={{ marginTop: 16, fontSize: 14.5, lineHeight: 1.6, color: "#4A4954" }}>
              {f.hoursVal}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${DC.border2}`,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            fontSize: 13,
            color: DC.faint,
          }}
        >
          <span>© 2026 Dellys. {f.rights}</span>
          <span>Chișinău, Moldova</span>
        </div>
      </div>
    </footer>
  );
}
