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
        kine: {
          50: "#f0fdf9",
          100: "#ccfbee",
          200: "#99f6de",
          300: "#5eeac7",
          400: "#2dd4aa",
          500: "#14b890",
          600: "#0d9274",
          700: "#0f745e",
          800: "#115c4b",
          900: "#124c3f",
          950: "#042b25",
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
