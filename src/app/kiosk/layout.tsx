import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import "../globals.css";

// The kiosk is an appliance, not a page of the website: it deliberately sits
// outside /[lang] so it inherits none of the site chrome (header, nav, pixel).
// That makes this a second root layout — it owns its own <html>/<body>.

const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dellys · Check-in",
  robots: { index: false, follow: false },
};

// Tablet-first: fill the screen, ignore pinch-zoom, sit under any notch.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16151b",
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" className={`${display.variable} ${sans.variable}`}>
      <body className="overflow-hidden bg-mauve-900 font-sans">{children}</body>
    </html>
  );
}
