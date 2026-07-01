import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Material Theme Builder · seed #769CDF ──────────────────────────
        // Mapped onto the existing kine- scale so every component updates
        kine: {
          50:  "#EBF0FF", // primary 95
          100: "#D6E3FF", // primaryContainer
          200: "#AAC7FF", // primaryFixedDim
          300: "#86ACF0", // primary 70
          400: "#6B91D3", // primary 60
          500: "#415F91", // primary (main)
          600: "#284777", // onPrimaryContainer  ← buttons, main accent
          700: "#194683", // primary 30
          800: "#0A305F", // onPrimary dark
          900: "#001B3E", // primary 10
          950: "#00102B", // primary 5
        },

        // ── Material semantic tokens ────────────────────────────────────────
        md: {
          surface:           "#F9F9FF",
          "surface-variant": "#E0E2EC",
          "surface-dim":     "#D9D9E0",
          "on-surface":      "#191C20",
          "on-surface-var":  "#44474E",
          outline:           "#74777F",
          "outline-var":     "#C4C6D0",
          secondary:         "#565F71",
          "sec-container":   "#DAE2F9",
          "on-sec":          "#FFFFFF",
          tertiary:          "#705575",
          "ter-container":   "#FAD8FD",
          "on-ter":          "#FFFFFF",
          error:             "#BA1A1A",
          "err-container":   "#FFDAD6",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
