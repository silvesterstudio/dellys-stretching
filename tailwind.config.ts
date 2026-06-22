import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimalist palette: one muted-rose accent over a warm-neutral ink
        // scale and near-white surfaces. (Palette names kept stable so existing
        // class usages don't need touching.)
        brand: {
          50: "#fdf2f5",
          100: "#fbe6ec",
          200: "#f6ccd8",
          300: "#eea7bd",
          400: "#e27a9c",
          500: "#d4517f",
          600: "#bd3a68",
          700: "#9e2b54",
          800: "#822548",
          900: "#6d2240",
        },
        // "mauve" is now a warm-neutral ink scale (text + soft surfaces).
        mauve: {
          50: "#f7f6f4",
          100: "#ecebe7",
          200: "#dcdad4",
          300: "#c2bfb6",
          400: "#9d9890",
          500: "#79746c",
          600: "#5c5851",
          700: "#46423c",
          800: "#322f2a",
          900: "#1f1d1a",
        },
        sand: {
          50: "#faf9f7",
          100: "#f3f1ed",
          200: "#e8e5df",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
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
