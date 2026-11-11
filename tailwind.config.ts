import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF3F9",
          100: "#D8E3F0",
          200: "#B3C7DE",
          300: "#84A3C7",
          400: "#527DAD",
          500: "#2F6395",
          600: "#1E4A78",
          700: "#16305A",
          800: "#16305A",
          900: "#0F2140",
          950: "#0A1628",
        },
        teal: {
          50: "#F0FDFB",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
