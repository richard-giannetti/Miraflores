import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f2f7f5",
          100: "#dcebe4",
          500: "#2f7d63",
          600: "#256450",
          700: "#1d4f40",
        },
      },
    },
  },
  plugins: [],
};

export default config;
