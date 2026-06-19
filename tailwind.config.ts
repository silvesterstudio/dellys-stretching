import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Soft feminine palette — rose/mauve with warm neutrals.
        brand: {
          50: "#fdf2f6",
          100: "#fce7ef",
          200: "#fbcfe0",
          300: "#f8a8c6",
          400: "#f272a3",
          500: "#e84d86",
          600: "#d42f6b",
          700: "#b21f54",
          800: "#931d48",
          900: "#7b1c40",
        },
        mauve: {
          50: "#f8f6fa",
          100: "#efeaf3",
          200: "#ddd3e6",
          300: "#c3b1d2",
          400: "#a589b9",
          500: "#8b69a1",
          600: "#735386",
          700: "#5f446e",
          800: "#503a5b",
          900: "#45334e",
        },
        sand: {
          50: "#faf8f5",
          100: "#f3ede5",
          200: "#e7dacb",
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
