import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Minimalist white + pink identity. "brand" is anchored on the Dellys
        // logo's hot magenta-pink (#fd0267 = brand-500); 600 is tuned for
        // accessible white button text (~4.9:1). (Palette names kept stable so
        // existing class usages don't need touching.)
        brand: {
          50: "#fff1f6",
          100: "#ffe3ee",
          200: "#ffc6dd",
          300: "#ff97bf",
          400: "#fb5894",
          500: "#fd0267",
          600: "#de0058",
          700: "#b9004a",
          800: "#98033e",
          900: "#7e0a37",
        },
        // "mauve" is a clean, faintly-rosy neutral ink scale (text + hairlines).
        mauve: {
          50: "#f9f7f8",
          100: "#f1eef0",
          200: "#e5e0e4",
          300: "#cbc4ca",
          400: "#9d959c",
          500: "#756c74",
          600: "#554e54",
          700: "#3f3940",
          800: "#292429",
          900: "#181518",
        },
        // "sand" is now a whisper-pink for soft secondary surfaces, sitting
        // just off the pure-white page so it reads as warm, not grey.
        sand: {
          50: "#fff5fa",
          100: "#ffe9f1",
          200: "#ffd6e6",
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
