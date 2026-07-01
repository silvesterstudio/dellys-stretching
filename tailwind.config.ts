import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // White + ruby identity, extracted from the Dellys Home mockup.
        // "brand" is anchored on ruby #e0115f (brand-500); 600 is a hair darker
        // for accessible white button text. (Palette names kept stable so
        // existing token/class usages re-skin automatically.)
        brand: {
          50: "#fff1f5",
          100: "#ffe3ec",
          200: "#ffc8d9",
          300: "#ff9bb8",
          400: "#ff3d68",
          500: "#e0115f",
          600: "#cc0f56",
          700: "#a80d47",
          800: "#7a1e3a",
          900: "#5c1730",
        },
        // "mauve" is a cool, neutral ink scale (text + hairlines) from the mock
        // — near-black #16151b down to whisper-lavender surfaces.
        mauve: {
          50: "#f7f6f9",
          100: "#eceaef",
          200: "#e3e1e7",
          300: "#c9c7cf",
          400: "#94939c",
          500: "#7a7981",
          600: "#6c6b74",
          700: "#4a4954",
          800: "#2a2931",
          900: "#16151b",
        },
        // "sand" — whisper-pink soft surfaces (the offer band, warm callouts).
        sand: {
          50: "#fff5f8",
          100: "#ffe9f0",
          200: "#ffd6e3",
        },
      },
      fontFamily: {
        // Body = Manrope. Display = Space Grotesk, falling back per-glyph to
        // Manrope (which carries Cyrillic, since Space Grotesk has none) so
        // Russian headings still render cleanly.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: [
          "var(--font-display)",
          "var(--font-sans)",
          "ui-sans-serif",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
